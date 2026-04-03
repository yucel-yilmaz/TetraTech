import React from 'react';
import RocketSimCanvas from './RocketSimCanvas';
import RocketSimSidebar from './RocketSimSidebar';
import { RocketSimTelemetryOverlay, RocketSimEnvironmentHud, RocketSimLogConsole, RocketSimEndScreen } from './RocketSimOverlay';
import RocketSimReport from './RocketSimReport';
import { RocketSimTimeControl } from './RocketSimTimeControl';
import { useRocketSimStore } from './rocketSimStore';

export default function RocketSimPage({ isMissionMode = false }) {
  React.useEffect(() => {
    return () => {
      useRocketSimStore.getState().resetSim();
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
      borderRadius: '4px',
    }}>
      {/* Sol: Simülasyon Canvas + Overlay'ler */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '4px 0 0 4px' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
          <RocketSimCanvas />
          <RocketSimTelemetryOverlay />
          <RocketSimEnvironmentHud />
          <RocketSimLogConsole />
          <RocketSimReport />
          <RocketSimEndScreen />
        </div>
        
        {/* Alt: Zaman ve Hız Kontrol Dock'u */}
        <div style={{ background: '#EEEBDD', borderTop: '1px solid rgba(27,23,23,0.15)', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 -4px 12px rgba(0,0,0,0.02)' }}>
          <RocketSimTimeControl />
        </div>
      </div>

      {/* Sağ: Parametre Paneli (TetraTech UI) */}
      <RocketSimSidebar isMissionMode={isMissionMode} />
    </div>
  );
}
