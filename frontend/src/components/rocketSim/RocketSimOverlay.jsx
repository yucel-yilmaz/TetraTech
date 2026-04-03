import React from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { motion, AnimatePresence } from 'framer-motion';
import { useRocketSimStore } from './rocketSimStore';
import { clamp, fmt, gravityAt, airDensityAt, G_SEA } from './rocketSimPhysics';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import PublicIcon from '@mui/icons-material/Public';
import SpeedIcon from '@mui/icons-material/Speed';
import WarningIcon from '@mui/icons-material/Warning';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import ReplayIcon from '@mui/icons-material/Replay';

const FADE_UP = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 150 } }
};
const STAGGER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
};

const MetricCard = ({ label, value, unit, isHero }) => (
  <motion.div
    variants={FADE_UP}
    style={{
      background: '#EEEBDD',
      border: '1px solid rgba(27, 23, 23, 0.15)',
      borderRadius: '4px',
      padding: '0.75rem 1rem',
      minWidth: '100px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
    }}
  >
    <span style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.1em', color: 'rgba(27, 23, 23, 0.6)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
      <span style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        fontWeight: 900,
        lineHeight: 1,
        color: isHero ? '#CE1212' : '#1B1717',
        fontSize: isHero ? '1.5rem' : '1.2rem',
      }}>
        {value}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(27, 23, 23, 0.5)', fontSize: '0.6rem', fontWeight: 800 }}>{unit}</span>
    </div>
  </motion.div>
);

// ═══════════════════════ TELEMETRY OVERLAY ═══════════════════════
export function RocketSimTelemetryOverlay() {
  const { metrics, params } = useRocketSimStore();
  const totalFuel = params.parts.reduce((acc, p) => acc + (p.fuelMass || 0), 0);

  return (
    <motion.div
      variants={STAGGER}
      initial="hidden"
      animate="show"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1.25rem', zIndex: 20, pointerEvents: 'none' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <MetricCard
          label="İRTİFA"
          value={metrics.alt > 1000 ? fmt(metrics.alt / 1000, 2) : fmt(metrics.alt, 0)}
          unit={metrics.alt > 1000 ? 'KM' : 'M'}
          isHero
        />
        <MetricCard
          label="HIZ"
          value={fmt(Math.sqrt(metrics.velY ** 2 + (metrics.velX || 0) ** 2), 0)}
          unit="M/S"
        />
        <MetricCard
          label="MACH"
          value={fmt(metrics.mach || 0, 2)}
          unit=""
        />
        <MetricCard
          label="G-KUVVETİ"
          value={fmt(metrics.accY / G_SEA, 2)}
          unit="G"
        />
        <MetricCard
          label="SAPMA"
          value={metrics.xDist > 100 ? fmt(metrics.xDist / 1000, 2) : fmt(metrics.xDist, 1)}
          unit={metrics.xDist > 100 ? 'KM' : 'M'}
        />
        <MetricCard label="T+" value={fmt(metrics.t, 1)} unit="S" />


      </div>

      {/* Yakıt barı */}
      <motion.div
        variants={FADE_UP}
        style={{
          background: '#EEEBDD',
          border: '1px solid rgba(27, 23, 23, 0.15)',
          borderRadius: '4px',
          padding: '1rem',
          width: '14rem',
          pointerEvents: 'auto',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.1em', color: '#1B1717', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            YAKIT
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem', fontWeight: 900, color: '#CE1212' }}>
            {fmt(metrics.fuel, 1)} <span style={{ fontSize: '0.55rem', color: 'rgba(27,23,23,0.5)' }}>KG</span>
          </span>
        </div>
        <div style={{ height: '8px', width: '100%', background: 'rgba(27,23,23,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: '#CE1212',
              transition: 'width 75ms',
              width: `${clamp((metrics.fuel / totalFuel) * 100, 0, 100)}%`
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════ ENVIRONMENT HUD ═══════════════════════
export function RocketSimEnvironmentHud() {
  const { metrics } = useRocketSimStore();

  return (
    <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-end' }}>
      {/* Kármán Çizgisi Uyarısı */}
      <AnimatePresence>
        {metrics.alt > 100000 && (
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            style={{
              background: '#1B1717',
              border: '1px solid #CE1212',
              padding: '0.6rem 1.2rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <span style={{ color: '#EEEBDD', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>KÁRMÁN ÇİZGİSİ — UZAY</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Max-Q Uyarısı */}
      <AnimatePresence>
        {metrics.q > 10000 && (
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            style={{
              background: '#CE1212',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(206,18,18,0.2)',
            }}
          >
            <span style={{ color: '#EEEBDD', fontWeight: 900, fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>MAX-Q</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Çevre Bilgi Paneli */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          background: '#EEEBDD',
          border: '1px solid rgba(27, 23, 23, 0.15)',
          padding: '1.25rem',
          borderRadius: '4px',
          width: '16rem',
          marginTop: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(27, 23, 23, 0.1)' }}>
          <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 900, color: 'rgba(27, 23, 23, 0.6)', letterSpacing: '0.1em' }}>KATMAN</span>
          <span style={{ color: '#1B1717', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{metrics.layer}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0' }}>
          <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 900, color: 'rgba(27, 23, 23, 0.6)', letterSpacing: '0.1em' }}>DİN. BASINÇ</span>
          <span style={{ color: '#1B1717', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 800 }}>
            {fmt(metrics.q / 1000, 2)} <span style={{ fontSize: '0.55rem', color: 'rgba(27,23,23,0.5)' }}>kPa</span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0' }}>
          <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 900, color: 'rgba(27, 23, 23, 0.6)', letterSpacing: '0.1em' }}>YERÇEKİMİ</span>
          <span style={{ color: '#1B1717', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 800 }}>
            {fmt(gravityAt(metrics.alt), 3)} <span style={{ fontSize: '0.55rem', color: 'rgba(27,23,23,0.5)' }}>m/s²</span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0' }}>
          <span style={{ fontSize: '0.55rem', textTransform: 'uppercase', fontWeight: 900, color: 'rgba(27, 23, 23, 0.6)', letterSpacing: '0.1em' }}>HAVA YOĞUNLUĞU</span>
          <span style={{ color: '#1B1717', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', fontWeight: 800 }}>
            {fmt(airDensityAt(metrics.alt), 4)} <span style={{ fontSize: '0.55rem', color: 'rgba(27,23,23,0.5)' }}>kg/m³</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════ LIVE LOG CONSOLE ═══════════════════════
export function RocketSimLogConsole() {
  const logs = useRocketSimStore((s) => s.logs);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '1.25rem',
        left: '1.25rem',
        width: '20rem',
        maxHeight: '200px',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column-reverse',
        justifyContent: 'flex-start',
        gap: '0.375rem',
        zIndex: 20,
        overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 25%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 25%)',
      }}
    >
      <AnimatePresence>
        {logs.map((log) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -15, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(27,23,23,0.15)',
              borderLeft: '4px solid #CE1212',
              padding: '0.6rem 0.8rem',
              borderRadius: '2px',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#CE1212', fontSize: '0.55rem', whiteSpace: 'nowrap', fontWeight: 900 }}>
              T+{fmt(log.time, 1)}s
            </span>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: '#1B1717', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>{log.msg}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════ TACTICAL REPORT MODAL ═══════════════════════
export function RocketSimReportModal() {
  const { reportModalOpen, setReportModalOpen, reportData, metrics } = useRocketSimStore();

  if (!reportModalOpen || !reportData) return null;

  const handleExportPDF = async () => {
    const element = document.getElementById('tactical-report-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#EEEBDD'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`TETRA-SIM-REPORT-${fmt(metrics.t,0)}.pdf`);
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("PDF oluşuturuluken bir sorun oluştu.");
    }
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid rgba(27,23,23,0.1)', paddingBottom: '0.5rem' }}>
      <Icon style={{ color: '#CE1212', fontSize: '1.1rem' }} />
      <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.1em', color: '#1B1717', textTransform: 'uppercase' }}>{title}</h3>
    </div>
  );

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(27, 23, 23, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        id="tactical-report-content"
        style={{
          background: '#EEEBDD',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(27,23,23,0.1)'
        }}
      >
        {/* MODAL HEADER */}
        <div style={{ background: '#1B1717', color: '#EEEBDD', padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, letterSpacing: '0.2em' }}>MİSYON SONRASI TELEMETRİ ANALİZİ</h2>
            <p style={{ margin: 0, fontSize: '0.6rem', opacity: 0.6, letterSpacing: '0.1em' }}>T_ID: #{(Math.random()*10000).toString(16).toUpperCase()}-SIM | TETRA TECH AEROSPACE</p>
          </div>
          <button 
            onClick={() => setReportModalOpen(false)}
            style={{ background: 'transparent', border: '1px solid rgba(238, 235, 221, 0.2)', color: '#EEEBDD', padding: '8px', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* SOL KOLON: KİNEMATİK */}
          <div>
            <SectionTitle icon={SignalCellularAltIcon} title="Kinematik Göstergeler" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(27,23,23,0.03)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(27,23,23,0.5)', marginBottom: '4px' }}>MAX İRTİFA (APOGEE)</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{fmt(metrics.maxAlt, 0)} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>M</span></div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(27,23,23,0.03)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(27,23,23,0.5)', marginBottom: '4px' }}>MAX HIZ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{fmt(metrics.maxVel, 1)} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>M/S</span></div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(27,23,23,0.03)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(27,23,23,0.5)', marginBottom: '4px' }}>MAX DİN. BASINÇ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{fmt(metrics.maxQ / 1000, 2)} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>KPA</span></div>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(27,23,23,0.03)', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.55rem', fontWeight: 800, color: 'rgba(27,23,23,0.5)', marginBottom: '4px' }}>UÇUŞ SÜRESİ</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{fmt(metrics.t, 1)} <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>S</span></div>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <SectionTitle icon={SpeedIcon} title="Kademe Performansları" />
              {reportData.kademeler && reportData.kademeler.length > 0 ? (
                reportData.kademeler.map((k, i) => (
                  <div key={i} style={{ marginBottom: '8px', padding: '0.75rem', borderLeft: '3px solid #CE1212', background: 'white' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900 }}>{i+1}. KADEME AYRILMASI</div>
                    <div style={{ fontSize: '0.6rem', color: 'rgba(27,23,23,0.6)', marginTop: '4px' }}>
                      T+{k.ayrilma_zamani_s}s | {fmt(k.ayrilma_irtifasi_m, 0)}m | {k.ayrilma_hizi_ms}m/s
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.6rem', opacity: 0.5 }}>Kademe ayrılma verisi yok.</div>
              )}
            </div>
          </div>

          {/* SAĞ KOLON: ÇEVRESEL / ENKAZ */}
          <div>
            <SectionTitle icon={PublicIcon} title="Enkaz ve Etki Analizi" />
            <div style={{ padding: '1rem', background: '#1B1717', color: '#EEEBDD', borderRadius: '4px', marginBottom: '1.5rem' }}>
               <div style={{ fontSize: '0.55rem', fontWeight: 800, opacity: 0.5, marginBottom: '8px' }}>VARIŞ / ETKİ KOORDİNATI</div>
               <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', fontWeight: 900, color: '#CE1212' }}>
                 TTH-COORD ANALİZİ: {fmt(metrics.xDist, 0)}m RANGE
               </div>
               <p style={{ fontSize: '0.6rem', margin: '8px 0 0 0', opacity: 0.7, lineHeight: 1.4 }}>
                 Roket ana gövdesi fırlatma rampasından yaklaşık {fmt(metrics.xDist, 0)} metre uzağa iniş gerçekleştirdi.
               </p>
            </div>

            <SectionTitle icon={WarningIcon} title="Sistem Uyarıları" />
            <div style={{ fontSize: '0.65rem', color: '#1B1717', fontWeight: 600 }}>
              {reportData.uyarilar && reportData.uyarilar.length > 0 ? (
                reportData.uyarilar.map((u, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: '#CE1212' }}>[!]</span> {u}
                  </div>
                ))
              ) : (
                <div style={{ color: 'green' }}>✓ Herhangi bir anomali tespit edilmedi.</div>
              )}
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div style={{ background: 'white', padding: '1.25rem 2rem', borderTop: '1px solid rgba(27,23,23,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
           <button 
             style={{ background: 'transparent', border: '1.5px solid #1B1717', color: '#1B1717', padding: '0.6rem 1.25rem', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', borderRadius: '4px' }}
             onClick={handleExportPDF}
           >
             PDF DIŞA AKTAR
           </button>
           <button 
             style={{ background: '#1B1717', border: 'none', color: '#EEEBDD', padding: '0.6rem 1.25rem', fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer', borderRadius: '4px' }}
             onClick={() => setReportModalOpen(false)}
           >
             PENCEREYİ KAPAT
           </button>
        </div>
      </motion.div>
    </div>
  );
}

export function RocketSimEndScreen() {
  const { showReportButton, setReportModalOpen } = useRocketSimStore();

  return (
    <AnimatePresence>
      {showReportButton && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(27,23,23,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            pointerEvents: 'auto'
          }}
        >
          <motion.div
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            style={{
              background: '#EEEBDD',
              padding: '3rem 4rem',
              borderRadius: '8px',
              textAlign: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              border: '2px solid rgba(206, 18, 18, 0.1)'
            }}
          >
             <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1B1717', margin: 0, letterSpacing: '2px' }}>
               SİMÜLASYON TAMAMLANDI
             </h2>
             <p style={{ fontSize: '0.85rem', color: 'rgba(27,23,23,0.6)', fontWeight: 700, margin: 0, maxWidth: '300px' }}>
               Faydalı yük hedeflenen kinetik davranış sergiledi. Taktik veri paketi derlendi.
             </p>
             <motion.button
               onClick={() => setReportModalOpen(true)}
               style={{
                 background: '#CE1212',
                 color: '#EEEBDD',
                 border: 'none',
                 borderRadius: '4px',
                 padding: '1rem 2rem',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '0.8rem',
                 cursor: 'pointer',
                 fontWeight: 900,
                 fontSize: '1rem',
                 letterSpacing: '0.1em',
                 boxShadow: '0 8px 16px rgba(206, 18, 18, 0.3)',
               }}
               whileHover={{ scale: 1.05, background: '#e01515' }}
               whileTap={{ scale: 0.95 }}
             >
               <DownloadIcon style={{ fontSize: '1.5rem' }} />
               VERİLERİ GÖRMEK İÇİN TIKLA
             </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
