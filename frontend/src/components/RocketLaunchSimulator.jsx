import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Lucide Icons
import { 
  Rocket, Wind, Weight, Zap, Globe2, Activity, ShieldAlert,
  DownloadCloud, Share2, RefreshCcw, ChevronRight, Orbit
} from 'lucide-react';

// Leaflet Fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

// --- REALISTIC CONSTANTS ---
const G_SEA = 9.80665;
const R_EARTH = 6371000;
const RHO_SEA = 1.225;
const DT = 1 / 240; // Çok çok hassas (Micro-step) fizik entegrasyonu (Düşmedeki sekme sorununu %100 düzeltir)

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fmt = (n, d = 2) => Number(n).toFixed(d);
const somiglianaGravity = (lat) => {
  const latRad = lat * (Math.PI / 180);
  return 9.7803253359 * (1 + 0.0019318526 * Math.pow(Math.sin(latRad), 2)) / Math.sqrt(1 - 0.00669438 * Math.pow(Math.sin(latRad), 2));
};

const gravityAt = (h, lat) => somiglianaGravity(lat) * Math.pow(R_EARTH / (R_EARTH + Math.max(0, h)), 2);
const airDensityAt = (h) => RHO_SEA * Math.exp(-Math.max(0, h) / 8500);

// --- PARTICLE DYNAMICS ---
class Particle {
  constructor(x, y, vx, vy, life, size, type) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life; this.size = size; this.type = type; 
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.size *= 0.94; 
  }
}

// --- DESIGN SYSTEM VARIANTS ---
const STAGGER_CONTAINER = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } } };
const FADE_UP = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } } };

// --- COMPONENTS ---
const MagneticButton = ({ children, onClick, className, disabled }) => {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x:0, y:0 });
  const handleMouse = (e) => {
    if(disabled) return;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const x = (e.clientX - (left + width/2)) * 0.15;
    const y = (e.clientY - (top + height/2)) * 0.15;
    setPos({ x, y });
  };
  return (
    <motion.button 
      ref={ref} onMouseMove={handleMouse} onMouseLeave={() => setPos({x:0, y:0})}
      animate={{ x: pos.x, y: pos.y }} transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      onClick={onClick} disabled={disabled} className={className} whileTap={{ scale: 0.96 }}
    >
      {children}
    </motion.button>
  );
};

const CyberCard = ({ title, icon: Icon, children }) => (
  <motion.div variants={FADE_UP} className="glass-panel rounded-2xl overflow-hidden mb-6 group transition-all duration-500 hover:border-white/10 relative">
    <div className="absolute top-0 left-0 w-0 h-[1px] bg-[var(--color-plasma-blue)] transition-all duration-700 group-hover:w-full opacity-50" />
    <div className="px-5 py-4 border-b border-[var(--color-space-border)] flex items-center gap-3">
      <div className="p-2 rounded-lg bg-black/40 border border-white/5 group-hover:border-[var(--color-plasma-blue-dim)] transition-colors">
        <Icon className="w-4 h-4 text-[var(--color-plasma-blue)]" />
      </div>
      <h3 className="uppercase tracking-widest text-[11px] font-black text-white/90">{title}</h3>
    </div>
    <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-5 relative bg-transparent">
      {children}
    </div>
  </motion.div>
);

const InputGlass = ({ label, unit, value, onChange, min, step = "any", disabled }) => (
  <div className="flex flex-col gap-2 col-span-2 sm:col-span-1 relative">
    <label className="text-[10px] font-black tracking-widest uppercase text-white/50 flex justify-between select-none">
      <span>{label}</span>
      <span className="text-[var(--color-plasma-blue)] opacity-60 font-mono tracking-tighter">{unit}</span>
    </label>
    <input type="number" min={min} step={step} disabled={disabled} value={value} onChange={e => onChange(parseFloat(e.target.value)||0)}
      className="cyber-input w-full text-white text-[13px] rounded-xl px-4 py-3 font-mono border-white/10 bg-black/40" />
  </div>
);

const MetricHud = ({ label, value, unit, isHero }) => (
  <motion.div variants={FADE_UP} className="glass-panel border-white/5 rounded-2xl p-5 min-w-[140px] flex flex-col justify-end group transition-all relative overflow-hidden active:scale-95 cursor-default hover:bg-white/[0.02]">
    <div className="absolute -left-20 -top-20 w-40 h-40 bg-[var(--color-plasma-blue)] rounded-full blur-[80px] opacity-0 group-hover:opacity-10 transition-opacity duration-700" />
    <span className="text-[9px] font-black tracking-widest text-white/40 uppercase mb-3 drop-shadow-md">{label}</span>
    <div className="flex items-baseline gap-1.5 z-10">
      <span className={`data-value font-black drop-shadow-lg leading-none ${isHero ? 'text-[var(--color-plasma-blue)] text-5xl tracking-tighter' : 'text-white text-3xl'}`}>
        {value}
      </span>
      <span className="data-value text-white/40 text-[10px] font-black">{unit}</span>
    </div>
  </motion.div>
);

// --- MAIN ARCHITECTURE ---
export default function RocketLaunchSimulator() {
  const [dryMass, setDryMass] = useState(50);
  const [fuelMass, setFuelMass] = useState(150); // Artırıldı ki atmosfere rahat çıkılsın
  const [length, setLength] = useState(2.5);
  const [diameter, setDiameter] = useState(0.15);
  const [cd, setCd] = useState(0.4);
  const [maxThrust, setMaxThrust] = useState(3000); // Daha güçlü motor (uzay sınırı için)
  const [burnTime, setBurnTime] = useState(12);
  const [windSpeed, setWindSpeed] = useState(5);
  const [startPos, setStartPos] = useState([28.5721, -80.6480]); 

  const refArea = Math.PI * Math.pow(diameter / 2, 2);
  const sideArea = length * diameter;

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('IDLE'); 
  
  const [metrics, setMetrics] = useState({ 
    alt: 0, velY: 0, accY: 0, xDist: 0, velX: 0, fuel: fuelMass, t: 0, maxAlt: 0, maxVel: 0, finalPos: [...startPos], q: 0, layer: 'TROPOSPHERE'
  });

  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const simRef = useRef({ alt: 0, velY: 0, accY: 0, x: 0, velX: 0, accX: 0, fuel: 0, t: 0, phase: 'IDLE', particles: [], stars: [], accum: 0, q: 0, layer: 'TROPOSPHERE' });

  useEffect(() => {
    simRef.current.stars = Array.from({length: 300}, () => ({
      x: Math.random(), y: Math.random(), size: Math.random()*2+1, b: Math.random(), depth: Math.random() * 0.8 + 0.2
    }));
  }, []);

  const resetSim = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    simRef.current = { alt: 0, velY: 0, accY: 0, x: 0, velX: 0, accX: 0, fuel: fuelMass, t: 0, phase: 'IDLE', particles: [], accum: 0, stars: simRef.current.stars, q: 0, layer: 'TROPOSPHERE' };
    setMetrics({ alt: 0, velY: 0, accY: 0, xDist: 0, velX: 0, fuel: fuelMass, t: 0, maxAlt: 0, maxVel: 0, finalPos: [...startPos], q: 0, layer: 'TROPOSPHERE' });
    setPhase('IDLE'); setRunning(false);
  }, [fuelMass, startPos]);

  useEffect(() => { if(!running) setMetrics(m => ({ ...m, fuel: fuelMass, finalPos: [...startPos] })); }, [fuelMass, startPos, running]);

  const initiateLaunch = useCallback(() => {
    resetSim();
    simRef.current.fuel = fuelMass;
    simRef.current.phase = 'IGNITION';
    setPhase('IGNITION'); setRunning(true);
  }, [fuelMass, resetSim]);

  // --- PHYSICS ENGINE (High Fidelity) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); 
    
    let lastTime = performance.now();
    const fuelRate = fuelMass / burnTime;

    const loop = (time) => {
      let dtFrame = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const sim = simRef.current;
      sim.accum += dtFrame;

      // MICRO-STEP PHYSICS (No glitching)
      while (sim.accum >= DT) {
        if (sim.phase !== 'IDLE' && sim.phase !== 'TOUCHDOWN') {
          sim.t += DT;
          const mass = dryMass + sim.fuel;
          const g = gravityAt(sim.alt, startPos[0]); 
          const rho = airDensityAt(sim.alt);

          // Dynamics Pressure (q) = 1/2 * rho * v^2
          const vMag2 = sim.velY * sim.velY + sim.velX * sim.velX;
          sim.q = 0.5 * rho * vMag2;

          // Layer Calculation
          sim.layer = sim.alt > 100000 ? 'SPACE' : sim.alt > 85000 ? 'THERMOSPHERE' : sim.alt > 50000 ? 'MESOSPHERE' : sim.alt > 12000 ? 'STRATOSPHERE' : 'TROPOSPHERE';

          // Y Axis Dynamics
          let tY = 0;
          if (sim.phase === 'IGNITION') {
            if (sim.fuel > 0) { tY = maxThrust; sim.fuel -= fuelRate * DT; } 
            else { sim.fuel = 0; sim.phase = sim.velY > 0 ? 'COAST' : 'DESCENT'; setPhase(sim.phase); }
          }
          const dYMag = 0.5 * rho * (sim.velY * sim.velY) * cd * refArea;
          let dragY = sim.velY > 0 ? -dYMag : dYMag;
          
          // EULER INSTABILITY FIX: Drag should not overshoot velocity to opposite direction
          const maxDragY = (Math.abs(sim.velY) / DT) * mass;
          if (Math.abs(dragY) > maxDragY) dragY = dragY > 0 ? maxDragY : -maxDragY;

          sim.accY = (tY + dragY - (mass*g)) / mass;
          sim.velY += sim.accY * DT; 
          sim.alt += sim.velY * DT;

          // X Axis Dynamics
          const vRelX = windSpeed - sim.velX; 
          const dXMag = 0.5 * rho * (vRelX * vRelX) * cd * sideArea;
          let dragX = vRelX > 0 ? dXMag : -dXMag;
          
          // EULER INSTABILITY FIX (X): Prevent wind drag oscillation
          const maxDragX = (Math.abs(vRelX) / DT) * mass;
          if (Math.abs(dragX) > maxDragX) dragX = dragX > 0 ? maxDragX : -maxDragX;

          sim.accX = dragX / mass;
          sim.velX += sim.accX * DT; 
          sim.x += sim.velX * DT;

          // State Machine
          if (sim.phase === 'COAST' && sim.velY <= 0) { sim.phase = 'DESCENT'; setPhase('DESCENT'); }
          
          // Catch all floor collision (Prevents falling through or hovering)
          if (sim.alt <= 0 && sim.t > 0.5) { 
            sim.alt=0; sim.velY=0; sim.accY=0; sim.velX=0; sim.accX=0; 
            sim.phase='TOUCHDOWN'; setPhase('TOUCHDOWN'); 
          }

          // Emitters
          if (sim.phase === 'IGNITION') {
             for(let i=0; i<3; i++) {
               sim.particles.push(new Particle((Math.random()-0.5)*diameter*40, 0, (Math.random()-0.5)*15 - sim.velX*0.05, Math.random()*100+100, Math.random()*0.3+0.1, Math.random()*6+3, 1));
             }
             if (Math.random()<0.3) {
               sim.particles.push(new Particle((Math.random()-0.5)*diameter*60, 0, (Math.random()-0.5)*30 - sim.velX*0.15, Math.random()*50+60, Math.random()*0.8+0.5, Math.random()*15+8, 0));
             }
          }
        }
        sim.accum -= DT;
      }
      sim.particles.forEach(p => p.update(dtFrame)); sim.particles = sim.particles.filter(p => p.life>0 && p.size>0.5);

      // --- VISUAL RENDERING ---
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement.getBoundingClientRect();
      if (canvas.width !== rect.width*dpr || canvas.height !== rect.height*dpr) {
        canvas.width = rect.width*dpr; canvas.height = rect.height*dpr;
      }
      const W = rect.width, H = rect.height;
      ctx.resetTransform(); ctx.scale(dpr, dpr);

      // Sky
      const altFactor = clamp(sim.alt / 40000, 0, 1); 
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(1, `rgb(${142 - 142*altFactor}, ${202 - 190*altFactor}, ${230 - 200*altFactor})`); 
      skyGrad.addColorStop(0, `rgb(${40 - 40*altFactor}, ${110 - 110*altFactor}, ${210 - 210*altFactor})`); 
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);

      // Stars
      if (altFactor > 0.05) {
        ctx.fillStyle = '#ffffff';
        const starlight = clamp((altFactor - 0.05)*3, 0, 1);
        sim.stars.forEach(s => {
           ctx.globalAlpha = starlight * s.b * (0.4 + 0.6 * Math.sin(time/400 + s.x*100));
           const px = (s.x * W + sim.x * s.depth * 0.5) % W;
           const dy = (s.y * H + (sim.alt/100) * s.depth) % H;
           ctx.beginPath(); ctx.arc(px < 0 ? px+W : px, dy, s.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1.0;
      }

      // Ground Environment
      const gH = 100, gY = H - gH;
      const gAlpha = clamp(1 - (sim.alt / 2000), 0, 1);
      if (gAlpha > 0) {
        ctx.globalAlpha = gAlpha;
        const pX = (W/2) - (sim.x * 2.5); 
        
        ctx.fillStyle = '#8B7355'; // Hills
        ctx.beginPath();
        let hX = (pX * 0.1) % 400; 
        ctx.moveTo(0, gY);
        for(let i=-400; i<W+400; i+=200) ctx.quadraticCurveTo(i + hX + 100, gY-60, i + hX + 200, gY);
        ctx.fill();

        ctx.fillStyle = '#4ade80'; // Grass
        ctx.fillRect(0, gY, W, gH);

        // Substructure & Tower
        ctx.fillStyle = '#64748b'; ctx.fillRect(pX - 90, gY - 10, 180, 10);
        ctx.fillStyle = '#475569'; ctx.fillRect(pX - 110, gY, 220, gH);
        
        ctx.fillStyle = '#334155'; ctx.fillRect(pX - 45, gY - 180, 15, 180); 
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.moveTo(pX - 30, gY-150); ctx.lineTo(pX - 15, gY-160); ctx.lineTo(pX - 30, gY-140); ctx.fill();
        ctx.beginPath(); ctx.moveTo(pX - 30, gY-80); ctx.lineTo(pX - 15, gY-90); ctx.lineTo(pX - 30, gY-70); ctx.fill();

        ctx.globalAlpha = 1.0;
      }

      const rW = clamp(16 + diameter*20, 14, 40);
      const rH = clamp(70 + length*12, 60, 160);
      let rY = H * 0.45; if (sim.alt < 1000) rY = (gY - 10 - rH) - (sim.alt / 1000)*(H*0.4);
      let tilt = sim.alt>10 && sim.velY>5 ? Math.atan2(sim.velX, sim.velY) * 0.8 : 0;

      ctx.save(); ctx.translate(W/2, rY); ctx.rotate(tilt);

      // Rocket Detail
      ctx.fillStyle = '#f8fafc'; ctx.fillRect(-rW/2, rH*0.2, rW, rH*0.7);
      ctx.fillStyle = '#111827';
      ctx.fillRect(-rW/2, rH*0.35, rW, rH*0.1); 
      ctx.fillRect(-rW/2, rH*0.6, rW, rH*0.15); 
      ctx.fillRect(-rW/2, rH*0.2, rW*0.25, rH*0.7); 

      // 3D Shading
      const mat = ctx.createLinearGradient(-rW/2, 0, rW/2, 0);
      mat.addColorStop(0, 'rgba(0,0,0,0.6)'); mat.addColorStop(0.3, 'rgba(255,255,255,0.8)'); mat.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = mat; ctx.fillRect(-rW/2, rH*0.2, rW, rH*0.7);
      
      const noseGrad = ctx.createLinearGradient(-rW/2, 0, rW/2, 0);
      noseGrad.addColorStop(0, '#374151'); noseGrad.addColorStop(0.3, '#9ca3af'); noseGrad.addColorStop(1, '#1f2937');
      ctx.fillStyle = noseGrad; 
      ctx.beginPath(); ctx.moveTo(-rW/2, rH*0.2); ctx.quadraticCurveTo(0, -rW*1.5, rW/2, rH*0.2); ctx.fill();
      
      ctx.fillStyle = '#111827'; ctx.fillRect(-rW*0.7, rH*0.25, rW*1.4, 4); // Grid fins
      ctx.fillStyle = '#374151'; // Engine Bell
      ctx.beginPath(); ctx.moveTo(-rW*0.35, rH*0.9); ctx.lineTo(-rW*0.45, rH*1.05); ctx.lineTo(rW*0.45, rH*1.05); ctx.lineTo(rW*0.35, rH*0.9); ctx.fill();

      ctx.restore(); ctx.save();
      sim.particles.forEach(p => {
        const fAlpha = p.life/p.maxLife;
        if(p.type === 1) { 
           ctx.globalCompositeOperation = 'screen';
           ctx.fillStyle = `rgba(255, ${Math.floor(200*fAlpha)}, ${Math.floor(50*fAlpha)}, ${fAlpha})`;
        } else { 
           ctx.globalCompositeOperation = 'normal';
           ctx.fillStyle = `rgba(180, 180, 185, ${fAlpha * 0.4})`;
        }
        ctx.beginPath(); ctx.arc(W/2 + p.x, rY + rH + p.y, p.size, 0, Math.PI*2); ctx.fill();
      });
      
      if (sim.phase === 'IGNITION') {
        ctx.globalCompositeOperation = 'screen';
        const glowR = rW*2.5 + Math.random()*8;
        const pGlow = ctx.createRadialGradient(W/2, rY+rH+glowR*0.2, 0, W/2, rY+rH+glowR*0.2, glowR);
        pGlow.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); 
        pGlow.addColorStop(0.3, 'rgba(255, 180, 30, 0.6)');
        pGlow.addColorStop(1, 'rgba(255, 100, 0, 0)');
        ctx.fillStyle = pGlow; ctx.beginPath(); ctx.arc(W/2, rY+rH+glowR*0.2, glowR, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();

      if (Math.round(time) % 5 === 0 || sim.phase === 'TOUCHDOWN') {
        const dLon = (sim.x / R_EARTH) * (180/Math.PI) / Math.cos(startPos[0]*Math.PI/180);
        setMetrics(m => ({
          alt: sim.alt, velY: sim.velY, accY: sim.accY, xDist: sim.x, velX: sim.velX, fuel: sim.fuel, t: sim.t,
          maxAlt: Math.max(m.maxAlt, sim.alt), maxVel: Math.max(m.maxVel, Math.sqrt(sim.velY**2 + sim.velX**2)),
          finalPos: [startPos[0], startPos[1] + dLon], q: sim.q, layer: sim.layer
        }));
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [running, dryMass, fuelMass, length, diameter, cd, refArea, maxThrust, burnTime, windSpeed, startPos, sideArea]);

  // FIX: jsPDF imported explicitly correctly.
  const generatePDF = async () => {
    const el = document.getElementById('awwwards-report');
    if(!el) return;
    try {
      await new Promise(r => setTimeout(r, 200)); 
      const cvs = await html2canvas(el, { scale: 2, backgroundColor: '#020409', useCORS: true, allowTaint: true });
      const img = cvs.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pW = pdf.internal.pageSize.getWidth();
      pdf.addImage(img, 'JPEG', 0, 0, pW, (cvs.height*pW)/cvs.width);
      pdf.save(`OPENROCKET_SKYBOUNDARY_REPORT.pdf`);
    } catch(e) { 
      console.error("PDF Generate Error", e); 
      alert("PDF Error: " + e.message);
    }
  };

  return (
    <div className="flex w-full h-screen relative overflow-hidden text-slate-100 selection:bg-[var(--color-plasma-blue-dim)] selection:text-white">

      {/* --- HUD FOREGROUND --- */}
      <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="absolute top-0 left-0 w-full p-8 z-20 pointer-events-none flex justify-between items-start">
         <div className="flex gap-4">
           <MetricHud label="ALTITUDE (Y)" value={metrics.alt>1000 ? fmt(metrics.alt/1000, 2) : fmt(metrics.alt, 0)} unit={metrics.alt>1000 ? "KM" : "M"} isHero />
           <MetricHud label="DOWNRANGE (X)" value={fmt(metrics.xDist, 1)} unit="M" />
           <MetricHud label="VELOCITY" value={fmt(metrics.velY, 1)} unit="M/S" />
           <MetricHud label="DRIFT VEL" value={fmt(metrics.velX, 1)} unit="M/S" />
           <MetricHud label="G-FORCE" value={fmt(metrics.accY / G_SEA, 2)} unit="G" />
           <MetricHud label="T-MINUS" value={fmt(metrics.t, 1)} unit="S" />
         </div>

         {/* Propellant Mass */}
         <motion.div variants={FADE_UP} className="glass-panel rounded-2xl p-5 w-80 pointer-events-auto border-white/5 relative overflow-hidden">
            <div className="flex justify-between items-center mb-4 relative z-10">
               <span className="text-[10px] font-black tracking-widest text-[#00F0FF] uppercase flex items-center gap-2">
                 <Zap size={14} className="animate-pulse" /> Propellant Mass
               </span>
               <span className="font-mono text-2xl font-black">{fmt(metrics.fuel, 1)} <span className="text-sm text-white/40">KG</span></span>
            </div>
            <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden backdrop-blur-sm relative z-10">
               <div className="h-full bg-gradient-to-r from-[var(--color-plasma-blue)] to-white transition-all ease-linear"
                    style={{ width: `${clamp((metrics.fuel/fuelMass)*100, 0, 100)}%` }} />
            </div>
         </motion.div>
      </motion.div>

      {/* --- REAL-TIME ENVIRONMENTAL FACTORS OVERLAY --- */}
      <div className="absolute top-40 right-8 z-20 pointer-events-none flex flex-col gap-3 items-end">
         
         <AnimatePresence>
         {metrics.alt > 100000 && (
           <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }}
             className="glass-panel border-[#00FFF0]/50 bg-[#00FFF0]/10 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(0,255,240,0.3)]">
              <Orbit className="text-[#00F0FF] animate-spin-slow" size={18} />
              <span className="text-[#00F0FF] font-black text-xs tracking-[0.3em] uppercase">Karman Line (Space Boundary)</span>
           </motion.div>
         )}
         </AnimatePresence>

         <AnimatePresence>
         {metrics.q > 12000 && (
           <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 50, opacity: 0 }}
             className="glass-panel border-[#FF4B00]/50 bg-[#FF4B00]/20 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(255,75,0,0.3)]">
              <ShieldAlert className="text-[#FF4B00] animate-pulse" size={18} />
              <span className="text-[#FF4B00] font-black text-xs tracking-[0.3em] uppercase">Max-Q (High Dynamic Pressure)</span>
           </motion.div>
         )}
         </AnimatePresence>

         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-5 rounded-2xl flex flex-col items-end gap-1 border-white/10 w-56 mt-4 backdrop-blur-3xl shadow-glow">
            <span className="text-[9px] uppercase font-black text-white/40 tracking-widest">ENV_LAYER (Alt Dependent)</span>
            <span className="text-[#00FF66] font-mono text-xs font-black tracking-widest uppercase mb-1">{metrics.layer}</span>
            <div className="w-full h-[1px] bg-white/10 my-1" />
            <span className="text-[9px] uppercase font-black text-white/40 tracking-widest">DYNAMIC PRESSURE (Q)</span>
            <span className="text-white font-mono text-base font-bold text-shadow">{fmt(metrics.q / 1000, 2)} <span className="text-[9px] text-white/40 tracking-widest">kPa</span></span>
            <div className="w-full h-[1px] bg-white/10 my-1" />
            <span className="text-[9px] uppercase font-black text-white/40 tracking-widest">LOCAL GRAVITY (g)</span>
            <span className="text-white font-mono text-base font-bold">{fmt(gravityAt(metrics.alt, startPos[0]), 3)} <span className="text-[9px] text-white/40 tracking-widest">m/s²</span></span>
            <div className="w-full h-[1px] bg-white/10 my-1" />
            <span className="text-[9px] uppercase font-black text-white/40 tracking-widest">AIR DENSITY (ρ)</span>
            <span className="text-white font-mono text-base font-bold">{fmt(airDensityAt(metrics.alt), 4)} <span className="text-[9px] text-white/40 tracking-widest">kg/m³</span></span>
         </motion.div>
      </div>

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 block" />

      {/* --- ARCHITECTURE SIDEBAR --- */}
      <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', damping: 20, delay: 0.1 }}
                  className="w-[420px] rounded-r-3xl border-r border-white/5 bg-[#020409]/90 backdrop-blur-3xl shadow-glow z-30 flex flex-col h-full relative">
        <div className="px-8 pt-8 pb-6 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-plasma-blue)]/10 border border-[var(--color-plasma-blue)]/30 flex items-center justify-center relative overflow-hidden group">
            <Rocket className="text-[var(--color-plasma-blue)] z-10 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-white">SKYBOUNDARY</h1>
            <p className="text-[10px] uppercase font-mono text-[var(--color-plasma-blue)] tracking-[0.2em]">Open Dynamics Lab</p>
          </div>
        </div>

        <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="flex-1 overflow-y-auto px-8 pb-4 custom-scrollbar">
          <CyberCard title="Global Coordinates" icon={Globe2}>
            <div className={`col-span-2 rounded-xl overflow-hidden border border-white/10 ${running?'opacity-40 pointer-events-none':''} transition-opacity relative group`}>
               <MapContainer center={startPos} zoom={3} style={{ height: '200px', width: '100%', background: '#020409' }} zoomControl={false}>
                 <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png" />
                 <Marker position={startPos} />
                 <useMapEvents onClick={(e) => { if(!running) setStartPos([e.latlng.lat, e.latlng.lng]); }} />
               </MapContainer>
               <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-md rounded-lg p-3 text-[10px] font-mono tracking-widest text-[#00F0FF] flex justify-between uppercase border border-white/10">
                 <span>{startPos[0].toFixed(4)} N</span><span>{startPos[1].toFixed(4)} E</span>
               </div>
            </div>
          </CyberCard>

          <CyberCard title="Vessel Parameters" icon={Weight}>
            <InputGlass label="DRY MASS" unit="KG" min={1} value={dryMass} onChange={setDryMass} disabled={running} />
            <InputGlass label="FUEL MASS" unit="KG" min={1} value={fuelMass} onChange={setFuelMass} disabled={running} />
            <InputGlass label="LENGTH" unit="M" min={0.5} value={length} onChange={setLength} disabled={running} />
            <InputGlass label="DIAMETER" unit="M" min={0.05} value={diameter} onChange={setDiameter} disabled={running} />
          </CyberCard>

          <CyberCard title="Propulsion & Aero" icon={Wind}>
             <InputGlass label="MAX THRUST" unit="N" value={maxThrust} onChange={setMaxThrust} disabled={running} />
             <InputGlass label="BURN TIME" unit="S" value={burnTime} onChange={setBurnTime} disabled={running} />
             <InputGlass label="DRAG (Cd)" unit="COEF" step={0.05} value={cd} onChange={setCd} disabled={running} />
             <InputGlass label="WIND VECTOR" unit="M/S" step={1} value={windSpeed} onChange={setWindSpeed} disabled={running} />
          </CyberCard>
        </motion.div>

        <div className="p-8 bg-[#020409] border-t border-white/5 shrink-0 rounded-br-3xl flex flex-col gap-4">
          <div className="flex gap-4">
             <div className="flex-1 rounded-2xl font-black text-[11px] tracking-widest border border-white/10 flex items-center justify-center gap-2 bg-[#060a13]">
                {phase === 'TOUCHDOWN' ? <ShieldAlert size={14} className="text-[#00FF66]" /> : <Activity size={14} className="text-[#00F0FF] animate-pulse" />}
                <span className={phase === 'TOUCHDOWN' ? 'text-white' : 'text-[var(--color-plasma-blue)]'}>{phase}</span>
             </div>
             <MagneticButton onClick={resetSim} className="glass-panel px-6 py-5 rounded-2xl font-black text-[11px] tracking-widest hover:border-[var(--color-plasma-blue)] text-white/50 hover:text-white transition-colors flex items-center gap-2">
               <RefreshCcw size={14} /> RESET
             </MagneticButton>
          </div>
          {(!running && phase === 'IDLE') && (
            <MagneticButton onClick={initiateLaunch} className="w-full btn-launch rounded-2xl py-5 font-black text-sm tracking-widest flex items-center justify-center gap-3">
               <span>INITIATE SEQUENCE</span>
               <ChevronRight size={18} />
            </MagneticButton>
          )}
        </div>
      </motion.div>

      {/* --- POST FLIGHT REPORT --- */}
      <AnimatePresence>
        {phase === 'TOUCHDOWN' && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration: 0.6 }}
                      className="absolute inset-0 z-50 bg-[#020409]/95 backdrop-blur-[40px] flex items-center justify-center overflow-y-auto pt-20 pb-20">
            
            <motion.div id="awwwards-report" 
                        initial={{ scale: 0.95, y: 40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 25 }}
                        className="bg-[#060a13] border border-white/5 rounded-[2rem] p-12 max-w-4xl w-full shadow-glow relative overflow-hidden">
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '2rem 2rem' }} />

               <div className="flex justify-between items-end border-b border-white/5 pb-8 mb-10 relative z-10">
                 <div>
                   <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-plasma-blue-dim)] border border-[var(--color-plasma-blue)]/20 mb-6">
                     <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-plasma-blue)] animate-pulse" />
                     <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-plasma-blue)]">Mission Secured</span>
                   </div>
                   <h2 className="text-5xl font-black tracking-tighter text-white mb-2 leading-none">POST-FLIGHT <br/> <span className="text-[var(--color-plasma-blue)]">TELEMETRY_</span></h2>
                 </div>
                 <div className="text-right">
                   <p className="text-[10px] font-mono text-white/40 mb-1">HASH ID: #{(Math.random()*100000|0).toString(16).toUpperCase()}-SBY</p>
                   <p className="text-xs font-black tracking-widest text-white/80">SKYBOUNDARY LABS</p>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-10 relative z-10 mb-12">
                 <div className="space-y-6">
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-white/30 border-b border-white/5 pb-2">Kinematic Signature</h4>
                   <div className="flex justify-between items-end group">
                     <span className="text-xs font-bold text-white/60 tracking-wider">APOGEE (Y)</span>
                     <span className="font-mono text-3xl font-black text-white group-hover:text-[var(--color-plasma-blue)] transition-colors">{fmt(metrics.maxAlt, 2)}<span className="text-sm opacity-50">m</span></span>
                   </div>
                   <div className="flex justify-between items-end group">
                     <span className="text-xs font-bold text-white/60 tracking-wider">MAX VELOCITY</span>
                     <span className="font-mono text-3xl font-black text-white group-hover:text-[var(--color-plasma-blue)] transition-colors">{fmt(metrics.maxVel, 2)}<span className="text-sm opacity-50">m/s</span></span>
                   </div>
                   <div className="flex justify-between items-end group">
                     <span className="text-xs font-bold text-white/60 tracking-wider">TOTAL FLIGHT TIME</span>
                     <span className="font-mono text-3xl font-black text-white group-hover:text-[var(--color-plasma-blue)] transition-colors">{fmt(metrics.t, 1)}<span className="text-sm opacity-50">s</span></span>
                   </div>
                 </div>

                 <div className="space-y-6">
                   <h4 className="text-[10px] uppercase font-black tracking-widest text-white/30 border-b border-white/5 pb-2">Spatial Drift Analysis</h4>
                   <div className="flex justify-between items-end group">
                     <span className="text-xs font-bold text-white/60 tracking-wider">WIND VECTOR (X)</span>
                     <span className="font-mono text-xl font-bold text-white group-hover:text-[var(--color-thrust-orange)] transition-colors">{fmt(windSpeed, 1)}<span className="text-xs opacity-50">m/s E</span></span>
                   </div>
                   <div className="flex justify-between items-end group">
                     <span className="text-xs font-bold text-white/60 tracking-wider">DOWNRANGE DRIFT</span>
                     <span className="font-mono text-xl font-bold text-[var(--color-plasma-blue)]">{fmt(metrics.xDist, 2)}<span className="text-xs opacity-50">m</span></span>
                   </div>
                   <div className="bg-[#0c1322] rounded-xl p-4 border border-white/5">
                      <div className="flex justify-between text-[10px] font-black text-white/40 mb-2"><span>ORIGIN COORDINATE</span><span>TOUCHDOWN COORDINATE</span></div>
                      <div className="flex justify-between font-mono text-[11px] text-[#00FF66]">
                        <span>{fmt(startPos[0],4)}, {fmt(startPos[1],4)}</span>
                        <span>{fmt(metrics.finalPos[0],4)}, {fmt(metrics.finalPos[1],4)}</span>
                      </div>
                   </div>
                 </div>
               </div>

               <div className="flex gap-4 relative z-10" data-html2canvas-ignore="true">
                 <MagneticButton onClick={generatePDF} className="flex-1 py-5 rounded-2xl bg-white text-black font-black text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-[var(--color-plasma-blue)] transition-colors">
                   <DownloadCloud size={16} /> EXPORT SECURE PDF
                 </MagneticButton>
                 <MagneticButton onClick={resetSim} className="px-8 py-5 rounded-2xl glass-panel text-white font-black text-xs tracking-widest flex items-center justify-center gap-3 hover:border-white/20 transition-all">
                   <Share2 size={16} /> NEW DEPLOYMENT
                 </MagneticButton>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
