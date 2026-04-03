import { create } from 'zustand';
import { simUrl } from '../../lib/endpoints';

const defaultParams = {
  windSpeed: 5,
  temperature: 15,
  pressure: 1013,
  parts: [
    { id: 'stage1', type: 'motor', name: '1. Kademe', dryMass: 120, fuelMass: 400, thrust: 15000, burnTime: 20, sepAlt: 3000, cd: 0.45, diameter: 0.30 },
    { id: 'stage2', type: 'motor', name: '2. Kademe', dryMass: 40, fuelMass: 120, thrust: 5000, burnTime: 25, sepAlt: 12000, cd: 0.40, diameter: 0.20 },
    { id: 'payload', type: 'payload', name: 'Burun Konisi', dryMass: 15, cd: 0.25, diameter: 0.15, fuelMass: 0, thrust: 0, burnTime: 0, sepAlt: 0 }
  ]
};

const initialMetrics = {
  alt: 0, velY: 0, accY: 0, xDist: 0, velX: 0,
  fuel: 0, t: 0, maxAlt: 0, maxVel: 0, maxQ: 0,
  q: 0, layer: 'TROPOSFER', mach: 0,
};

export const useRocketSimStore = create((set) => ({
  params: defaultParams,
  updateParam: (key, value) => set((s) => ({ params: { ...s.params, [key]: value } })),
  updateParts: (parts) => set((s) => ({ params: { ...s.params, parts } })),

  running: false,
  phase: 'IDLE',
  timeScale: 1.0,
  isPaused: false,
  metrics: initialMetrics,
  logs: [],
  trajectory: null,
  futureEvents: null,
  reportData: null,
  showReportButton: false,
  setShowReportButton: (show) => set({ showReportButton: show }),
  reportModalOpen: false,
  setReportModalOpen: (open) => set({ reportModalOpen: open }),

  addLog: (msg) => set((s) => ({
    logs: [{ id: Math.random().toString(36).substr(2, 9), time: s.metrics.t, msg }, ...s.logs].slice(0, 60)
  })),

  setPhase: (phase) => set({ phase }),
  setRunning: (running) => set({ running }),
  setTimeScale: (scale) => set({ timeScale: scale }),
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  setMetrics: (updater) => set((s) => ({
    metrics: typeof updater === 'function' ? updater(s.metrics) : updater
  })),

  resetSim: () => set((s) => {
    const totalFuel = s.params.parts.reduce((acc, p) => acc + (p.fuelMass || 0), 0);
    return {
      running: false,
      phase: 'IDLE',
      isPaused: false,
      timeScale: 1.0,
      trajectory: null,
      futureEvents: null,
      reportData: null,
      showReportButton: false,
      reportModalOpen: false,
      logs: [{ id: 'reset', time: 0, msg: 'Simülasyon sıfırlandı. Katmanlı uçuşa hazır.' }],
      metrics: { ...initialMetrics, fuel: totalFuel }
    };
  }),

  initiateLaunch: async () => {
    set({
      running: true,
      phase: 'CALCULATING',
      reportData: null,
      showReportButton: false,
      reportModalOpen: false,
      logs: [{ id: 'calc', time: 0, msg: 'Python fizik sunucusuna çok-kademeli analiz yollanıyor...' }]
    });
    try {
      const state = useRocketSimStore.getState();
      const res = await fetch(simUrl('/simulate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.params)
      });
      const data = await res.json();
      if (!Array.isArray(data?.trajectory) || data.trajectory.length === 0) {
        throw new Error('Bos veya gecersiz trajektori');
      }
      
      const totalFuel = state.params.parts.reduce((acc, p) => acc + (p.fuelMass || 0), 0);

      const initLogs = [{ id: 'launch', time: 0, msg: 'SİMÜLASYON YÜKLENDI — Tüm kademeler hazır!' }];
      if (data.uyarilar) {
         data.uyarilar.forEach((u, i) => initLogs.push({ id: 'uyari_'+i, time: 0, msg: u }));
      }

      set((s) => ({
        phase: 'IGNITION',
        trajectory: data.trajectory,
        futureEvents: data.events,
        reportData: {
           ozet: data.ozet,
           kademeler: data.kademeler,
           uyarilar: data.uyarilar,
           enkaz_analizi: data.enkaz_analizi || []
        },
        logs: initLogs,
        metrics: { ...s.metrics, fuel: totalFuel, t: 0, maxAlt: 0, maxVel: 0, maxQ: 0 }
      }));
    } catch (e) {
      set({
        running: false,
        phase: 'IDLE',
        logs: [{ id: 'err', time: 0, msg: 'SUNUCU ÇEVRİMDIŞI — server.py fizik sunucusunu başlatın (port 5000).' }]
      });
    }
  }
}));
