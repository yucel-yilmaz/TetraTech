import React, { useRef, useEffect } from 'react';
import { useRocketSimStore } from './rocketSimStore';
import { clamp, getAtmosphereLayer, Particle } from './rocketSimPhysics';

export default function RocketSimCanvas() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const simRef = useRef({
    alt: 0, velY: 0, accY: 0, x: 0, velX: 0,
    fuel: 0, t: 0, phase: 'IDLE',
    particles: [], stars: [],
    accum: 0, q: 0, mach: 0,
    layer: 'TROPOSFER',
    localEvents: null, lastUI: 0,
    activeIndex: 0, falling: [], shakeTime: 0, flipStart: 0, crashTime: 0,
    cameraX: 0, cameraY: 0,
    prevActiveIndex: 0, sepFlashTime: 0,
    crashError: null // for debugging
  });

  useEffect(() => {
    simRef.current.stars = Array.from({ length: 350 }, () => ({
      x: Math.random(), y: Math.random(),
      size: Math.random() * 2 + 0.5,
      b: Math.random(),
      depth: Math.random() * 0.8 + 0.2,
    }));
  }, []);

  useEffect(() => {
    const unsub = useRocketSimStore.subscribe((state, prev) => {
      if (state.running && !prev.running) {
        simRef.current = {
          ...simRef.current,
          alt: 0, velY: 0, accY: 0, x: 0, velX: 0,
          t: 0, phase: 'IGNITION', particles: [],
          accum: 0, q: 0, mach: 0,
          layer: 'TROPOSFER', localEvents: null, lastUI: 0,
          activeIndex: 0, falling: [], shakeTime: 0, flipStart: 0, crashTime: 0,
          cameraX: 0, cameraY: 0,
          prevActiveIndex: 0, sepFlashTime: 0
        };
      }
      if (!state.running && prev.running && state.phase === 'IDLE') {
        simRef.current = {
          ...simRef.current,
          alt: 0, velY: 0, accY: 0, x: 0, velX: 0,
          t: 0, phase: 'IDLE', particles: [],
          accum: 0, q: 0, mach: 0,
          layer: 'TROPOSFER', localEvents: null, lastUI: 0,
          activeIndex: 0, falling: [], shakeTime: 0, flipStart: 0, crashTime: 0,
          cameraX: 0, cameraY: 0,
          prevActiveIndex: 0, sepFlashTime: 0
        };
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let lastTime = performance.now();

    const loop = (time) => {
      const sim = simRef.current;
      const W = canvas.width || 800;
      const H = canvas.height || 600;
      try {
        const state = useRocketSimStore.getState();
        const { params, running } = state;
        const parts = params.parts || [];

        let dtFrameRaw = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        let dtFrame = state.isPaused ? 0 : dtFrameRaw * state.timeScale;

        if (sim.sepFlashTime > 0) {
          sim.sepFlashTime -= dtFrame;
        }

        sim.accum += dtFrame;

        if (running && state.trajectory && state.phase !== 'CALCULATING') {
          sim.t += dtFrame;
          const tick = Math.min(Math.floor(sim.t / 0.016666), state.trajectory.length - 1);
          const frame = state.trajectory[tick];

          if (frame) {
            sim.alt = frame.alt;
            sim.velY = frame.velY;
            sim.accY = frame.accY;
            sim.x = frame.x;
            sim.velX = frame.velX;
            sim.fuel = frame.fuel;
            sim.mach = frame.mach || 0;
            sim.q = frame.q || 0;
            sim.layer = getAtmosphereLayer(sim.alt);

            const prevIdx = sim.activeIndex;
            const nextIdx = frame.activeIndex !== undefined ? frame.activeIndex : 0;
            
            if (nextIdx > prevIdx) {
              sim.sepFlashTime = 1.0; // 1 saniye gerçek dünya (yavaşlatılmış olarak 6-7 saniye sürer)
              
              // Ayrılma Şarapnelleri (Soğuk Gaz ve Patlayıcı Pim Çıkışı)
              for(let i=0; i<40; i++) {
                sim.particles.push(new Particle(
                   (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 20,
                   (Math.random() - 0.5) * 350, (Math.random() - 0.5) * 100,
                   Math.random() * 2 + 1, Math.random() * 15 + 10, 1
                ));
              }
            }
            
            sim.activeIndex = nextIdx;
            sim.prevActiveIndex = prevIdx;
            sim.falling = frame.falling || [];

            if (sim.phase !== frame.phase) {
              if (frame.phase === 'CRASH' && sim.phase !== 'CRASH') {
                sim.shakeTime = 2.0;
                sim.crashTime = time;
                for (let i = 0; i < 120; i++) {
                  sim.particles.push(new Particle(
                    (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 500, -Math.random() * 400 - 100,
                    Math.random() * 2.0 + 0.5,
                    Math.random() * 25 + 15,
                    1
                  ));
                  sim.particles.push(new Particle(
                    (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 30,
                    (Math.random() - 0.5) * 200, -Math.random() * 150,
                    Math.random() * 1.5 + 0.5,
                    Math.random() * 30 + 20,
                    0
                  ));
                }
              }
              sim.phase = frame.phase;
              state.setPhase(frame.phase);
            }

            if (!sim.localEvents) sim.localEvents = [...(state.futureEvents || [])];
            while (sim.localEvents.length > 0 && sim.localEvents[0].time <= sim.t) {
              const ev = sim.localEvents.shift();
              state.addLog(ev.msg);
            }

            if (sim.phase === 'IGNITION' && Math.random() < 0.7) {
              const altRatio = clamp(sim.alt / 30000, 0, 1);
              const spread = 8 + altRatio * 120;
              const speed = 120 + altRatio * 180;
              sim.particles.push(new Particle(
                (Math.random() - 0.5) * spread, 0,
                (Math.random() - 0.5) * spread * 0.15,
                Math.random() * speed + speed * 0.5,
                Math.random() * 0.3 + 0.08,
                Math.random() * (5 + altRatio * 8) + 2,
                sim.alt > 25000 ? 3 : 1
              ));
              if (Math.random() < 0.2) {
                sim.particles.push(new Particle(
                  (Math.random() - 0.5) * spread * 2, 10,
                  (Math.random() - 0.5) * 15,
                  Math.random() * 30 + 40,
                  Math.random() * 0.6 + 0.3,
                  Math.random() * 12 + 6,
                  0
                ));
              }
            }
          }

          const now = Date.now();
          if (!sim.lastUI || now - sim.lastUI > 100 || sim.phase === 'TOUCHDOWN') {
            sim.lastUI = now;
            state.setMetrics((m) => ({
              alt: sim.alt, velY: sim.velY, accY: sim.accY,
              xDist: sim.x, velX: sim.velX,
              fuel: sim.fuel, t: sim.t,
              maxAlt: Math.max(m.maxAlt, sim.alt),
              maxVel: Math.max(m.maxVel, Math.sqrt(sim.velY ** 2 + sim.velX ** 2)),
              maxQ: Math.max(m.maxQ || 0, sim.q),
              q: sim.q, layer: sim.layer, mach: sim.mach,
            }));
          }
        } else if (!running) {
          sim.localEvents = null;
          sim.alt = 0;
          sim.t = 0;
          sim.crashError = null; // Clear error when reset
        }

        sim.particles.forEach((p) => p.update(dtFrame));
        sim.particles = sim.particles.filter((p) => p.life > 0 && p.size > 0.3);

        // ─── CANVAS SETUP ───
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
        }
        const W = rect.width;
        const H = rect.height;

        let rawTotalH = 0;
        let rawPayloadH = 0;
        for (let i = sim.activeIndex; i < parts.length; i++) {
          const isP = parts[i]?.type === 'payload';
          const pw1 = clamp(14 + Number(parts[i]?.diameter || 0.15) * 100, 12, 50);
          const ph1 = isP ? pw1 * 3.5 : clamp(50 + Number(parts[i]?.diameter || 0.15) * 400, 40, 150);
          rawTotalH += ph1;
          if (isP) rawPayloadH = ph1;
        }

        sim.cameraX += (sim.x - sim.cameraX) * 0.08;

        const autoZoom = rawTotalH > 0 ? clamp((H * 0.55) / rawTotalH, 0.15, 2.0) : 1.0;
        const zoom = autoZoom;
        const ppm = zoom;

        const totalH = rawTotalH * zoom;
        const payloadH = rawPayloadH * zoom;
        
        let cameraYTarget = H / 2.2;
        if (sim.falling.length > 0) {
          const lowestFalling = Math.min(...sim.falling.filter(f => !f.landed).map(f => f.y));
          const altDiff = sim.alt - lowestFalling;
          if (altDiff > 0 && altDiff < 5000) {
            cameraYTarget = H / 2.2 - clamp(altDiff * ppm * 0.15, 0, H * 0.15);
          }
        }
        if (!sim.cameraY) sim.cameraY = cameraYTarget;
        sim.cameraY += (cameraYTarget - sim.cameraY) * 0.03;
        
        const noseToEngine = totalH - payloadH / 2;
        const baseEnginePosition = sim.cameraY;
        const baseEngineY = baseEnginePosition + noseToEngine;
        const gY = baseEngineY + sim.alt * ppm;

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        if (sim.shakeTime > 0) {
          const mag = Math.min(sim.shakeTime * 15, 20);
          const shakeX = (Math.random() - 0.5) * mag * zoom;
          const shakeY = (Math.random() - 0.5) * mag * zoom;
          ctx.translate(shakeX, shakeY);
          sim.shakeTime -= dtFrame;
        }

        // ─── GÖKYÜZÜ ───
        const altFactor = clamp(sim.alt / 35000, 0, 1);
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
        skyGrad.addColorStop(0, `rgb(${18 - 14 * altFactor}, ${58 - 46 * altFactor}, ${128 - 114 * altFactor})`);
        skyGrad.addColorStop(1, `rgb(${188 - 168 * altFactor}, ${222 - 200 * altFactor}, ${245 - 225 * altFactor})`);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        const sunGlow = ctx.createRadialGradient(W * 0.78, H * 0.16, 0, W * 0.78, H * 0.16, H * 0.38);
        sunGlow.addColorStop(0, `rgba(255, 244, 215, ${0.22 - altFactor * 0.1})`);
        sunGlow.addColorStop(0.34, `rgba(255, 211, 145, ${0.14 - altFactor * 0.08})`);
        sunGlow.addColorStop(1, 'rgba(255, 200, 120, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, W, H);

        const horizonHaze = ctx.createLinearGradient(0, H * 0.5, 0, H);
        horizonHaze.addColorStop(0, 'rgba(255,255,255,0)');
        horizonHaze.addColorStop(1, `rgba(255, 232, 204, ${0.16 * (1 - altFactor)})`);
        ctx.fillStyle = horizonHaze;
        ctx.fillRect(0, H * 0.5, W, H * 0.5);

        // ─── YILDIZLAR ───
        if (altFactor > 0.04) {
          const starlight = clamp((altFactor - 0.04) * 3, 0, 1);
          sim.stars.forEach((s) => {
            ctx.globalAlpha = starlight * s.b * (0.4 + 0.6 * Math.sin(time / 500 + s.x * 100));
            ctx.fillStyle = '#ffffff';
            const px = ((s.x * W + sim.cameraX * s.depth * 0.5) % W + W) % W;
            const dy = ((s.y * H + (sim.alt / 80) * s.depth) % H + H) % H;
            ctx.beginPath(); ctx.arc(px, dy, s.size, 0, Math.PI * 2); ctx.fill();
          });
          ctx.globalAlpha = 1.0;
        }

        // ─── ZEMİN ───
        if (gY < H + 400) {
          ctx.globalAlpha = clamp(1 - sim.alt / 2500, 0, 1);
          const pX = W / 2 - (sim.x - sim.cameraX) * zoom;

          ctx.fillStyle = '#8a7553';
          ctx.beginPath(); ctx.moveTo(0, gY);
          const hX = (pX * 0.1) % 400;
          for (let i = -400; i < W + 400; i += 200) {
            ctx.quadraticCurveTo(i + hX + 100, gY - 50 * zoom, i + hX + 200, gY);
          }
          ctx.lineTo(W, H + 400); ctx.lineTo(0, H + 400); ctx.fill();

          ctx.fillStyle = '#57d984';
          ctx.fillRect(0, gY, W, H + 400 - gY);

          ctx.fillStyle = '#6b7280'; ctx.fillRect(pX - 70 * zoom, gY - 8 * zoom, 140 * zoom, 8 * zoom);
          ctx.fillStyle = '#4b5563'; ctx.fillRect(pX - 85 * zoom, gY, 170 * zoom, H + 400 - gY);
          ctx.fillStyle = '#1f2937'; ctx.fillRect(pX - 35 * zoom, gY - 140 * zoom, 10 * zoom, 140 * zoom);

          ctx.fillStyle = '#1e293b';
          ctx.fillStyle = '#1e293b';
          ctx.beginPath(); ctx.moveTo(pX - 25 * zoom, gY - 120 * zoom); ctx.lineTo(pX - 12 * zoom, gY - 128 * zoom); ctx.lineTo(pX - 25 * zoom, gY - 110 * zoom); ctx.fill();
          ctx.beginPath(); ctx.moveTo(pX - 25 * zoom, gY - 60 * zoom); ctx.lineTo(pX - 12 * zoom, gY - 68 * zoom); ctx.lineTo(pX - 25 * zoom, gY - 50 * zoom); ctx.fill();
          const smokeBloom = ctx.createRadialGradient(pX, gY + 12 * zoom, 0, pX, gY + 12 * zoom, 120 * zoom);
          smokeBloom.addColorStop(0, `rgba(216, 221, 227, ${0.16 * (1 - altFactor)})`);
          smokeBloom.addColorStop(1, 'rgba(216,221,227,0)');
          ctx.fillStyle = smokeBloom;
          ctx.beginPath();
          ctx.ellipse(pX, gY + 18 * zoom, 150 * zoom, 44 * zoom, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }

        // ─── AYRILMA FLASH EFEKTİ ───
        if (sim.sepFlashTime > 0) {
          sim.sepFlashTime -= dtFrame;
          const flashAlpha = clamp(sim.sepFlashTime * 2, 0, 0.4);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const flashGrad = ctx.createRadialGradient(W/2, baseEngineY, 0, W/2, baseEngineY, 60 * zoom);
          flashGrad.addColorStop(0, `rgba(255, 255, 200, ${flashAlpha})`);
          flashGrad.addColorStop(0.5, `rgba(255, 200, 100, ${flashAlpha * 0.5})`);
          flashGrad.addColorStop(1, 'rgba(255, 150, 50, 0)');
          ctx.fillStyle = flashGrad;
          ctx.beginPath();
          ctx.arc(W/2, baseEngineY, 60 * zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ─── DÜŞEN KADEMELER ───
        sim.falling.forEach(f => {
          const fp = parts.find(px => px.id === f.id) || { diameter: 0.15 };
          const fallW = clamp(14 + Number(fp.diameter) * 100, 12, 50) * zoom;
          const fallH = clamp(50 + Number(fp.diameter) * 400, 40, 150) * zoom;
          const fallY = baseEngineY - (f.y - sim.alt) * ppm;
          const fallX = W / 2 + (f.x - sim.x) * zoom;

          if (fallY < -200 || fallY > H + 200 || fallX < -200 || fallX > W + 200) return;

          if (!f.landed && Math.random() < 0.6) {
            sim.particles.push(new Particle(
              (fallX - W/2) + (Math.random() - 0.5) * fallW * 0.3,
              (fallY - baseEngineY) + (Math.random() - 0.5) * fallH * 0.3,
              (Math.random() - 0.5) * 8,
              Math.random() * 15 + 5,
              Math.random() * 1.2 + 0.5,
              Math.random() * 5 + 3,
              0
            ));
          }

          let fallAlpha = 1.0;
          if (f.landed) {
            fallAlpha = 0.5;
          } else {
            if (fallY < 50) {
              fallAlpha = clamp(fallY / 50, 0, 1);
            }
          }
          
          ctx.save();
          ctx.globalAlpha = fallAlpha;
          // Parçanın merkezi, motorun alt sınırı (fallY) + kendi boyunun yarısı kadar AŞAĞIDA olmalı.
          ctx.translate(fallX, fallY + fallH / 2 + (15 * zoom));
          ctx.rotate(f.rot);

          const fallShade = ctx.createLinearGradient(-fallW / 2, 0, fallW / 2, 0);
          fallShade.addColorStop(0, 'rgba(0,0,0,0.4)');
          fallShade.addColorStop(0.3, 'rgba(255,255,255,0.7)');
          fallShade.addColorStop(1, 'rgba(0,0,0,0.25)');
          
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(-fallW / 2, -fallH / 2, fallW, fallH);
          ctx.fillStyle = fallShade;
          ctx.fillRect(-fallW / 2, -fallH / 2, fallW, fallH);

          ctx.fillStyle = '#111827';
          ctx.fillRect(-fallW / 2, -fallH * 0.3, fallW, fallH * 0.04);
          ctx.fillRect(-fallW / 2, fallH * 0.1, fallW, fallH * 0.04);

          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(-fallW * 0.35, fallH / 2); ctx.lineTo(-fallW * 0.45, fallH / 2 + fallH * 0.08);
          ctx.lineTo(fallW * 0.45, fallH / 2 + fallH * 0.08); ctx.lineTo(fallW * 0.35, fallH / 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(80, 50, 20, 0.4)';
          ctx.fillRect(-fallW / 2, -fallH / 2 - 2, fallW, 4);

          ctx.restore();
        });

        // ─── ANA ROKET (TİLT & STABİLİZASYON) ───
        let tilt = 0;
        const windStr = Number(params.windSpeed || 0);
        const activeParts = parts.slice(sim.activeIndex);
        const mainPart = activeParts[activeParts.length - 1]; // En üstteki (ana) parça
        const isStabilized = mainPart?.noTumble === true;
        
        if (sim.phase === 'IGNITION' && sim.alt > 10 && sim.velY > 5) {
          tilt = Math.atan2(sim.velX, sim.velY) * 0.7;
          if (windStr > 10 && !isStabilized) {
            tilt += Math.sin(time / 200) * (windStr - 10) * 0.002;
          }
        } else if (sim.phase === 'COAST' || sim.phase === 'DESCENT') {
          if (isStabilized && sim.alt > 100000) {
            // Yörünge Stabilizasyonu: Uzayda dik dur (Takla Atma)
            tilt = 0;
          } else {
            if (!sim.flipStart) sim.flipStart = time;
            const flipElapsed = (time - sim.flipStart) / 1000;
            const flipAngle = clamp(flipElapsed * 0.9, 0, Math.PI * 0.85);
            const flipDir = sim.velX >= 0 ? 1 : -1;
            tilt = flipAngle * flipDir;
            if (windStr > 5) {
              tilt += Math.sin(time / 150) * (windStr - 5) * 0.004;
            }
          }
        } else {
          sim.flipStart = 0;
        }

        if (sim.phase === 'CRASH') {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const crashGlow = ctx.createRadialGradient(W/2, baseEngineY, 0, W/2, baseEngineY, 80 * zoom);
          crashGlow.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
          crashGlow.addColorStop(0.3, 'rgba(255, 100, 0, 0.5)');
          crashGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
          ctx.fillStyle = crashGlow;
          ctx.beginPath();
          ctx.arc(W/2, baseEngineY, 80 * zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
        // ─── ROKET GÖVDESİ & KADEMELER ÇİZİMİ ───
        let currentStackY = 0;
        
        ctx.save();
        ctx.translate(W / 2, baseEngineY);
        ctx.rotate(tilt);

        // Önce tüm gövde parçalarını çiz
        activeParts.forEach((p, idx) => {
          const isPayload = p.type === 'payload';
          const pW = clamp(14 + Number(p.diameter) * 100, 12, 50) * zoom;
          const pH = isPayload ? pW * 3.5 : (clamp(50 + Number(p.diameter) * 400, 40, 150) * zoom);

          ctx.save();
          ctx.translate(0, -currentStackY);

          if (!isPayload) {
            // Motor Gövdesi
            const bodyShade = ctx.createLinearGradient(-pW / 2, 0, pW / 2, 0);
            bodyShade.addColorStop(0, 'rgba(0,0,0,0.55)');
            bodyShade.addColorStop(0.3, 'rgba(255,255,255,0.7)');
            bodyShade.addColorStop(1, 'rgba(0,0,0,0.35)');
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(-pW / 2, -pH, pW, pH);
            ctx.fillStyle = bodyShade;
            ctx.fillRect(-pW / 2, -pH, pW, pH);

            ctx.fillStyle = '#111827';
            ctx.fillRect(-pW / 2, -pH * 0.8, pW, pH * 0.06);
            if (idx === 0) ctx.fillRect(-pW / 2, -pH * 0.4, pW, pH * 0.06);

            // Motor Nozzle
            ctx.fillStyle = '#374151';
            const nzH = pH * 0.08;
            ctx.beginPath();
            ctx.moveTo(-pW * 0.3, 0); ctx.lineTo(-pW * 0.4, nzH); ctx.lineTo(pW * 0.4, nzH); ctx.lineTo(pW * 0.3, 0);
            ctx.fill();
            
            // Finler (Sadece en alt kademe)
            if (idx === 0 && sim.activeIndex === 0) {
              ctx.fillStyle = '#1e293b';
              const finW = pW * 0.55;
              const finH = pH * 0.25;
              ctx.beginPath(); ctx.moveTo(-pW / 2, -finH - pH * 0.1); ctx.lineTo(-pW / 2 - finW, 0); ctx.lineTo(-pW / 2, 0); ctx.fill();
              ctx.beginPath(); ctx.moveTo(pW / 2, -finH - pH * 0.1); ctx.lineTo(pW / 2 + finW, 0); ctx.lineTo(pW / 2, 0); ctx.fill();
            }
          } else {
            // Payload Gövdesi 
            const bodyH = pH * 0.4;
            const pbShade = ctx.createLinearGradient(-pW / 2, 0, pW / 2, 0);
            pbShade.addColorStop(0, 'rgba(0,0,0,0.55)');
            pbShade.addColorStop(0.3, 'rgba(255,255,255,0.8)');
            pbShade.addColorStop(1, 'rgba(0,0,0,0.35)');
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-pW / 2, -bodyH, pW, bodyH);
            ctx.fillStyle = pbShade;
            ctx.fillRect(-pW / 2, -bodyH, pW, bodyH);
          }
          
          currentStackY += pH;
          ctx.restore();
        });

        // ─── FINAL BURUN KONİSİ (AERODİNAMİK KAPAK) ───
        // Roketin tüm boyu bittikten sonra, en tepeye 4px OVERLAP ile burnu konduruyoruz.
        const topPart = activeParts[activeParts.length - 1];
        if (topPart) {
            const topW = clamp(14 + Number(topPart.diameter || 0.15) * 100, 12, 50) * zoom;
            const topH = topPart.type === 'payload' ? topW * 3.5 : clamp(50 + Number(topPart.diameter || 0.15) * 400, 40, 150) * zoom;
            const coneH = topW * 1.8;
            const bodyH_for_cone = topPart.type === 'payload' ? topH * 0.4 : 0;
            
            ctx.save();
            // BURUN KONUMU: Tüm stack'in en tepesinin 4 piksel aşağısı (Overlap garantisi)
            ctx.translate(0, -currentStackY + (topPart.type === 'payload' ? (topH - bodyH_for_cone) : 0) + 4); 

            const noseGrad = ctx.createLinearGradient(-topW / 2, -coneH * 0.5, topW / 2, -coneH * 0.5);
            noseGrad.addColorStop(0, '#1e293b'); 
            noseGrad.addColorStop(0.4, '#475569');
            noseGrad.addColorStop(1, '#0f172a');
            
            ctx.fillStyle = noseGrad;
            ctx.beginPath();
            ctx.moveTo(-topW / 2, 0);
            ctx.bezierCurveTo(-topW / 2, -coneH * 0.7, -topW / 6, -coneH, 0, -coneH);
            ctx.bezierCurveTo(topW / 6, -coneH, topW / 2, -coneH * 0.7, topW / 2, 0);
            ctx.closePath();
            ctx.fill();

            // Metalik Parlama
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.ellipse(0, -coneH * 0.8, topW * 0.15, coneH * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
        ctx.restore();




        }

        // ─── PARTİKÜL & MOTOR IŞIMASI ───
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';

        sim.particles.forEach((p) => {
          const fAlpha = clamp(p.life / p.maxLife, 0, 1);
          ctx.beginPath();
          ctx.arc(W / 2 + p.x, baseEngineY + p.y + 10 * zoom, Math.max(0.1, p.size), 0, Math.PI * 2);
          if (p.type === 1) {
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = `rgba(255, ${Math.floor(190 * fAlpha)}, ${Math.floor(40 * fAlpha)}, ${fAlpha})`;
          } else if (p.type === 3) {
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = `rgba(${Math.floor(80 * fAlpha)}, ${Math.floor(140 * fAlpha)}, 255, ${fAlpha * 0.7})`;
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(140, 140, 145, ${fAlpha * 0.35})`;
          }
          ctx.fill();
        });

        ctx.globalCompositeOperation = 'source-over';

        // ─── KADEME AYRILMA TEPKİSİ (Yumuşak Parlama) ───
        if (sim.sepFlashTime > 0) {
           ctx.save();
           ctx.globalCompositeOperation = 'screen';
           const flashA = clamp(sim.sepFlashTime * 1.5, 0, 1);
           const pW = 40 * zoom; 

           const sepGlow = ctx.createRadialGradient(W / 2, baseEngineY, 0, W / 2, baseEngineY, pW * 5);
           sepGlow.addColorStop(0, `rgba(255, 255, 255, ${flashA * 0.9})`);
           sepGlow.addColorStop(0.3, `rgba(255, 200, 50, ${flashA * 0.5})`);
           sepGlow.addColorStop(1, `rgba(255, 50, 0, 0)`);

           ctx.fillStyle = sepGlow;
           ctx.beginPath();
           ctx.ellipse(W / 2, baseEngineY - 5, pW * 5, pW * 2, 0, 0, Math.PI * 2);
           ctx.fill();
           ctx.restore();
        }

        if (sim.phase === 'IGNITION') {
          const lowestPart = activeParts[0];
          const pW = clamp(14 + Number(lowestPart?.diameter || 0.15) * 100, 12, 50) * zoom;
          ctx.globalCompositeOperation = 'screen';
          
          const plumeExpand = clamp(1 + (sim.alt / 25000), 1, 4.0);
          const glowR = (pW * 2.5 + Math.random() * 6) * (plumeExpand * 0.7);

          const plumeLength = clamp(120 * zoom * plumeExpand, 90 * zoom, 260 * zoom);
          const plumeWidth = pW * (1.25 + plumeExpand * 0.24);
          const corePlume = ctx.createLinearGradient(W / 2, baseEngineY - 8 * zoom, W / 2, baseEngineY + plumeLength);
          if (sim.alt > 35000) {
            corePlume.addColorStop(0, 'rgba(255,255,255,0.98)');
            corePlume.addColorStop(0.24, 'rgba(150,220,255,0.82)');
            corePlume.addColorStop(1, 'rgba(25,74,210,0)');
          } else {
            corePlume.addColorStop(0, 'rgba(255,255,255,0.98)');
            corePlume.addColorStop(0.2, 'rgba(255,227,160,0.96)');
            corePlume.addColorStop(0.55, 'rgba(255,132,30,0.72)');
            corePlume.addColorStop(1, 'rgba(140,35,0,0)');
          }
          ctx.fillStyle = corePlume;
          ctx.beginPath();
          ctx.moveTo(W / 2 - pW * 0.2, baseEngineY + 1 * zoom);
          ctx.quadraticCurveTo(W / 2 - plumeWidth, baseEngineY + plumeLength * 0.34, W / 2 - plumeWidth * 0.42, baseEngineY + plumeLength);
          ctx.quadraticCurveTo(W / 2, baseEngineY + plumeLength * 1.08, W / 2 + plumeWidth * 0.42, baseEngineY + plumeLength);
          ctx.quadraticCurveTo(W / 2 + plumeWidth, baseEngineY + plumeLength * 0.34, W / 2 + pW * 0.2, baseEngineY + 1 * zoom);
          ctx.closePath();
          ctx.fill();

          const shockAlpha = clamp(0.3 * (1 - sim.alt / 22000), 0.08, 0.3);
          ctx.strokeStyle = `rgba(255,255,255,${shockAlpha})`;
          ctx.lineWidth = Math.max(1.1, 2.2 * zoom);
          for (let i = 0; i < 3; i++) {
            const ringY = baseEngineY + 18 * zoom + i * 22 * zoom * plumeExpand;
            ctx.beginPath();
            ctx.ellipse(W / 2, ringY, pW * (0.22 + i * 0.1), 6 * zoom + i * 3 * zoom, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          
          const glow = ctx.createRadialGradient(W / 2, baseEngineY, 0, W / 2, baseEngineY, glowR);
          glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          if (sim.alt > 35000) {
            glow.addColorStop(0.2, 'rgba(100, 200, 255, 0.7)');
            glow.addColorStop(1, 'rgba(0, 50, 255, 0)');
          } else {
            glow.addColorStop(0.2, 'rgba(255, 200, 50, 0.8)');
            glow.addColorStop(0.5, 'rgba(255, 100, 0, 0.4)');
            glow.addColorStop(1, 'rgba(255, 50, 0, 0)');
          }
          
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.ellipse(W / 2, baseEngineY + glowR * 0.4, glowR * 0.8, glowR * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();


        const vignette = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.12, W / 2, H * 0.46, H * 0.82);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(7, 12, 20, 0.22)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, W, H);
        // Rapor verisi hazır mı kontrol et
        if (state.running && state.trajectory && sim.t >= state.trajectory.length * 0.016666 && sim.phase !== 'CRASH') {
           if (!state.showReportButton) state.setShowReportButton(true);
        } else {
           if (state.showReportButton) state.setShowReportButton(false);
        }

        frameRef.current = requestAnimationFrame(loop);
      } catch (err) {
        sim.crashError = err.message + ' | ' + err.stack;
        ctx.resetTransform();
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'white';
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sim.crashError.substring(0, 150), W/2, H/2);
        console.error('[RocketSimCanvas] Render loop crashed:', err);
        frameRef.current = requestAnimationFrame(loop);
      }
    };

    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const phase = useRocketSimStore(s => s.phase);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0, display: 'block' }} />
      
      {/* CRASH OVERLAY */}
      {phase === 'CRASH' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(127, 29, 29, 0.6)', backdropFilter: 'blur(4px)', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '16px', padding: '2rem 3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', boxShadow: '0 0 80px rgba(255,0,0,0.3)', animation: 'pulse 2s ease-in-out infinite', pointerEvents: 'auto' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              SİMÜLASYON BAŞARISIZ
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(252, 165, 165, 0.7)', textAlign: 'center' }}>Roket yere çakılarak imha oldu ve tüm veriler kayboldu!</div>
          </div>
        </div>
      )}
    </>
  );
}
