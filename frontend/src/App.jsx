import React, { useState, useEffect, Suspense } from 'react'
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, Popup, useMapEvents, useMap, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center, Stage } from '@react-three/drei'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'
import './App.css'
import RocketSimPage from './components/rocketSim/RocketSimPage'
import { apiUrl, getRocketModelUrl, simUrl, userModelUrl } from './lib/endpoints'

// MUI ICONS
import TerrainIcon from '@mui/icons-material/Terrain';
import WbCloudyIcon from '@mui/icons-material/WbCloudy';
import PublicIcon from '@mui/icons-material/Public';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AirIcon from '@mui/icons-material/Air';
import ShieldIcon from '@mui/icons-material/Shield';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LaunchIcon from '@mui/icons-material/Launch';
import HistoryIcon from '@mui/icons-material/History';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import MapIcon from '@mui/icons-material/Map';
import CloseIcon from '@mui/icons-material/Close';
import ArticleIcon from '@mui/icons-material/Article';
import TimerIcon from '@mui/icons-material/Timer';

function BlueprintRenderer({ parts }) {
  if (!parts || parts.length === 0) return <div style={{ padding: '2rem', textAlign: 'center' }}>Görsel data bulunamadı.</div>;

  const svgWidth = 500;
  const svgHeight = 750;
  const totalLength = parts.reduce((acc, p) => acc + (['nosecone', 'bodytube', 'transition'].includes(p.tag) ? (p.length || 0) : 0), 0) || 1;
  const maxRadius = Math.max(...parts.map(p => p.radius || 0)) || 1;

  const pY = 40;
  let scaleY = (svgHeight - pY * 2) / totalLength;
  const pX = svgWidth / 2;
  const scaleX = scaleY;

  // Fit horizontally if too wide
  if (maxRadius * 2 * scaleX > svgWidth - 80) {
    scaleY = (svgWidth - 80) / (maxRadius * 2);
  }

  let currentY = pY;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, color: '#1B1717', background: 'rgba(255,255,255,0.8)', padding: '5px 10px', borderRadius: '4px', fontWeight: 900, fontSize: '0.65rem', border: '1px solid #cecbbf' }}>
        TETRATECH 2D MÜHENDİSLİK BLUEPRİNT HARİTASI
      </div>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '100%', flex: 1 }}>
        <defs>
          <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.2" />
          </pattern>
          <pattern id="blueprint-grid-lg" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="none" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blueprint-grid)" />
        <rect width="100%" height="100%" fill="url(#blueprint-grid-lg)" />

        <line x1={pX} y1={10} x2={pX} y2={svgHeight - 10} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="5,5" />

        {parts.map((p, i) => {
          const w1 = (p.radius || 0.05) * scaleX * 2;
          let h = (p.length || 0) * scaleY;
          let isFin = false;
          let path = "";

          if (p.tag === 'nosecone') {
            path = `M ${pX} ${currentY} Q ${pX + w1 / 2} ${currentY + h / 1.5} ${pX + w1 / 2} ${currentY + h} L ${pX - w1 / 2} ${currentY + h} Q ${pX - w1 / 2} ${currentY + h / 1.5} ${pX} ${currentY} Z`;
          } else if (p.tag === 'transition') {
            const rFore = (p.extra?.foreradius || p.radius || 0) * scaleX;
            const rAft = (p.extra?.aftradius || p.radius || 0) * scaleX;
            path = `M ${pX - rFore} ${currentY} L ${pX + rFore} ${currentY} L ${pX + rAft} ${currentY + h} L ${pX - rAft} ${currentY + h} Z`;
          } else if (p.tag === 'bodytube') {
            path = `M ${pX - w1 / 2} ${currentY} L ${pX + w1 / 2} ${currentY} L ${pX + w1 / 2} ${currentY + h} L ${pX - w1 / 2} ${currentY + h} Z`;
          } else if (['trapezoidfinset', 'ellipticalfinset', 'freeformfinset'].includes(p.tag)) {
            isFin = true;
            const rootc = (p.extra?.rootchord || p.length || 0.1) * scaleY;
            const tipc = (p.extra?.tipchord || p.length * 0.5 || 0.05) * scaleY;
            const span = (p.extra?.span || 0.1) * scaleX;
            const swp = (p.extra?.sweepangle || 0);
            const swpOffset = Math.sin((swp * Math.PI) / 180) * span;

            const offsetY = currentY - rootc;
            const startXLeft = pX - w1 / 2;
            const startXRight = pX + w1 / 2;

            path = `M ${startXRight} ${offsetY} L ${startXRight + span} ${offsetY + swpOffset} L ${startXRight + span} ${offsetY + swpOffset + tipc} L ${startXRight} ${offsetY + rootc} Z 
                    M ${startXLeft} ${offsetY} L ${startXLeft - span} ${offsetY + swpOffset} L ${startXLeft - span} ${offsetY + swpOffset + tipc} L ${startXLeft} ${offsetY + rootc} Z`;
          } else if (['parachute', 'masscomponent', 'engineblock', 'innertube', 'streamer'].includes(p.tag)) {
            const compH = Math.max((p.length || 0.1) * scaleY, 5);
            const compW = Math.max((p.radius || 0.05) * scaleX * 1.5, 10);
            path = `M ${pX - compW / 2} ${currentY} L ${pX + compW / 2} ${currentY} L ${pX + compW / 2} ${currentY + compH} L ${pX - compW / 2} ${currentY + compH} Z`;
          }

          let fill = "rgba(59,130,246,0.1)";
          let stroke = "#2563eb";
          let sw = "2";
          let sd = "0";
          let offsetTxt = pX + w1 / 2 + 10;
          let drawLines = true;

          if (isFin) { stroke = "#1d4ed8"; fill = "rgba(29,78,216,0.2)"; drawLines = false; }
          if (p.tag === 'parachute' || p.tag === 'streamer') { stroke = "#ef4444"; fill = "rgba(239,68,68,0.1)"; sd = "4,4"; sw = "1.5"; offsetTxt = pX - w1 / 2 - 100; }
          if (p.tag === 'masscomponent') { stroke = "#f59e0b"; fill = "rgba(245,158,11,0.1)"; sd = "2,2"; sw = "1"; drawLines = false; }
          if (p.tag === 'engineblock') { stroke = "#64748b"; fill = "none"; sd = "2,2"; sw = "1"; offsetTxt = pX - w1 / 2 - 90; }

          const prevY = currentY;
          if (['nosecone', 'bodytube', 'transition'].includes(p.tag)) {
            currentY += h;
          }

          if (!path) return null;

          return (
            <g key={i}>
              <path d={path} fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={sd} />
              {(drawLines && h > 0 && ['nosecone', 'bodytube', 'parachute', 'engineblock'].includes(p.tag)) && (
                <g>
                  <line x1={pX} y1={prevY + 5} x2={offsetTxt - 5} y2={prevY + 5} stroke={stroke} strokeWidth="1" strokeDasharray="2,2" />
                  <text x={offsetTxt} y={prevY + 8} fill={stroke} fontSize="8" fontWeight="bold">{p.name.toUpperCase()} ({(p.mass * 1000).toFixed(0)}g)</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  );
}

function LiveTelemetryStream() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const messages = [
      "NOAA-GOES-16 uplink stabil...",
      "[SYS] Aktif K-Index hesaplanıyor...",
      "Data block RX: 0x4A2B...",
      "Manyetometre okuması: Normal",
      "Güneş rüzgar hızı: 450km/s TESPİT EDİLDİ",
      "X-Ray sensör kalibrasyon: OK",
      "[ALERT_SYS] X-Ray akışı ölçümü alındı",
      "GOES-18'den telemetri bekleniyor...",
      "Sinyal işleme modülü devrede.",
    ];

    const interval = setInterval(() => {
      const newMsg = `[${new Date().toISOString().substring(11, 19)}] ${messages[Math.floor(Math.random() * messages.length)]}`;
      setLogs(prev => {
        const updated = [...prev, newMsg];
        // 25 satıra kadar tutalım ki panel dolsun
        if (updated.length > 25) return updated.slice(updated.length - 25);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card static-card" style={{ background: '#0f172a', padding: '1rem', flex: 1, minHeight: '180px', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '4px' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#10b981', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
        <span>NOAA UYDU VERİ AKIŞI</span>
        <span className="pulse-led" style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: 'monospace', fontSize: '0.65rem', color: '#10b981', lineHeight: '1.4' }}>
        {logs.map((L, i) => {
          // En yeni gelen (sonuncu) %100 opak, geriye gittikçe solar
          const opacity = (i + 1) / logs.length;
          return (
            <div key={i} style={{ opacity: Math.max(0.2, opacity), whiteSpace: 'nowrap' }}>
              {L}
            </div>
          );
        })}
        {logs.length === 0 && <div style={{ opacity: 0.5 }}>Veri akışı bekleniyor...</div>}
      </div>
    </div>
  );
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
})

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '2rem', background: 'rgba(0,0,0,0.9)', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3>3D MOTORU ÇÖKTÜ</h3>
          <p>{this.state.error && this.state.error.toString()}</p>
          <button onClick={() => this.setState({ hasError: false })} style={{ marginTop: '1rem', padding: '0.5rem', background: 'white', color: 'black' }}>TEKRARDAN DENE</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapEventsComponent({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    },
  });
  return null;
}

const parseData = () => ({
  weather: { city: "-", coord: "-", temp: "-", feels_like: "-", temp_min: "-", temp_max: "-", humidity: "-", pressure: "-", wind: "-", clouds: "-", visibility: "-", desc: "Veri Bekleniyor..." },
  space: { time_tag: "-", mag_bz: "-", mag_bt: "-", mag_status: "-", kp_index: "-", g_scale: "-", xray_flux: "-", radio_scale: "-", alert: "Bekleniyor", flare_prob: "0%", ai_consensus: "Analiz Ediliyor..." },
  topo: { peaks: "-", towers: "-", residential: "-", industrial: "-", score: "-", terrain_info: "Henüz taranmadı", acoustic_risk: "-", civ_risk: "-", airspace_risk: "-", logistics: "-", water_safety: "-", names: [], hazards: [], suitability: "Bekleniyor", target_lat: null, target_lon: null },
  airspace: { status: "-", is_airspace_clear: false, status_message: "Bağlantı Bekleniyor", flights: [], notams: [], restricted_zones: [], wait_time: 0 }
})

function LocationMarker({ position, setPosition, setAnalyzedTopo }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lon], 10, { duration: 1.5 });
    }
  }, [position, map]);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition({ lat, lon: lng, lng });
      setAnalyzedTopo(null);
    },
  })
  return position === null ? null : <Marker position={[position.lat, position.lon]}></Marker>;
}

function AnalysisVisuals({ analyzedTopo }) {
  const map = useMap();
  useEffect(() => {
    if (analyzedTopo && analyzedTopo.target_lat && analyzedTopo.target_lon) {
      map.flyTo([parseFloat(analyzedTopo.target_lat), parseFloat(analyzedTopo.target_lon)], 11, { duration: 1.5 });
    }
  }, [analyzedTopo, map])

  if (!analyzedTopo || !analyzedTopo.target_lat || !analyzedTopo.target_lon) return null;

  const getColor = (t) => {
    if (t === 'residential') return '#38bdf8';
    if (t === 'industrial') return '#f59e0b';
    if (t === 'peak') return '#fbbf24';
    if (t === 'tower') return '#a78bfa';
    if (t === 'airport') return '#ef4444';
    return '#fff';
  }

  return (
    <>
      <Circle center={[parseFloat(analyzedTopo.target_lat), parseFloat(analyzedTopo.target_lon)]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.08, dashArray: '6, 8', weight: 1.5 }} radius={16000} />
      {analyzedTopo.hazards && analyzedTopo.hazards.map((h, idx) => (
        <CircleMarker key={idx} center={[h.lat, h.lon]} pathOptions={{ color: '#0f172a', fillColor: getColor(h.type), fillOpacity: 0.95, weight: 1.5 }} radius={5.5}>
          <Popup><strong style={{ color: '#0f172a', fontSize: '14px', textTransform: 'uppercase' }}>{h.name}</strong></Popup>
        </CircleMarker>
      ))}
    </>
  )
}

function ModelRenderer({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} dispose={null} />;
}

function HistoryGraphModal({ selectedItem, onClose, historyData }) {
  if (!selectedItem) return null;
  const formattedData = historyData ? [...historyData].map((d, i) => ({
    time: new Date(d.timestamp || d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    kp: parseFloat(d.kp_index || d.kp) || 0,
    timestamp: d.timestamp || d.time
  })) : [];

  const targetTime = selectedItem.timestamp || selectedItem.time;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(27,23,23,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#cecbbf', padding: '2rem', borderRadius: '4px', width: '90%', maxWidth: '1000px', display: 'flex', gap: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', position: 'relative' }} onClick={e => e.stopPropagation()}>

        {/* Kapat Butonu */}
        <button onClick={onClose} style={{ position: 'absolute', top: '-1px', right: '-1px', background: '#1B1717', color: '#EEEBDD', border: 'none', padding: '8px 16px', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', letterSpacing: '1px' }}>X Kapat</button>

        {/* SOL: DETAY */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '280px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#1B1717', borderBottom: '2px solid #1B1717', paddingBottom: '0.5rem', marginBottom: '1.5rem', letterSpacing: '1px' }}>SİMÜLASYON KAYDI DETAYI</h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.6)', letterSpacing: '1px' }}>KAYIT ZAMANI</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1B1717', fontFamily: 'monospace' }}>{new Date(targetTime).toLocaleString()}</div>
          </div>

          <div style={{ background: '#fff', padding: '1rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.6)', letterSpacing: '1px' }}>ÖLÇÜLEN KP İNDEKSİ</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: parseFloat(selectedItem.kp_index || selectedItem.kp) >= 5 ? '#CE1212' : '#1B1717' }}>{selectedItem.kp_index || selectedItem.kp}</div>
          </div>

          <div style={{ background: '#fff', padding: '1rem', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.6)', letterSpacing: '1px' }}>RADYASYON (FLARE)</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1B1717' }}>{selectedItem.solar_flare || selectedItem.flare}</div>
          </div>

          <div style={{ background: selectedItem.risk_level === 'HIGH' ? '#CE1212' : (selectedItem.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981'), color: '#fff', padding: '1rem', textAlign: 'center', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '2px', borderRadius: '4px' }}>
            {selectedItem.risk_level} RİSK
          </div>
        </div>

        {/* SAĞ: GRAFİK */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1B1717', marginBottom: '1rem', letterSpacing: '1px' }}>KP-INDEX TREND ANALİZİ</div>
          <div style={{ flex: 1, minHeight: '350px', background: '#fff', padding: '1.5rem 1rem 1rem 0', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)', borderRadius: '4px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#94a3b8" domain={[0, 9]} fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }} contentStyle={{ background: '#fff', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, color: '#1B1717', padding: '10px' }} />
                <Line type="monotone" dataKey="kp" stroke="#1B1717" strokeWidth={3} dot={{ r: 3, fill: '#1B1717', strokeWidth: 0 }} activeDot={{ r: 7, fill: '#CE1212', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}

[
  'Ares_1_B.glb', 'Shuttle.glb', 'Jupiter.glb',
  'Cassini.glb', 'Agena_Target_Vehicle.glb', 'Mir.glb'
].forEach(m => useGLTF.preload(`/models/${m}`));

function NotificationContainer({ alerts, onDismiss }) {
  if (alerts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {alerts.map(a => (
        <div key={a.id} style={{
          background: a.type === 'danger' ? '#CE1212' : (a.type === 'info' ? '#3b82f6' : '#f59e0b'),
          color: 'white',
          padding: '0.8rem 1.2rem',
          borderRadius: '4px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: '280px',
          animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <span style={{ fontWeight: 900, fontSize: '0.75rem', letterSpacing: '1px' }}>{a.title}</span>
            <button onClick={() => onDismiss(a.id)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 900 }}>×</button>
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.9 }}>{a.message}</div>
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.3)', marginTop: '8px', width: '100%', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: 'white', width: '100%', animation: 'shrink 3s linear forwards' }}></div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes shrink { from { width: 100%; } to { width: 0%; } }
      `}</style>
    </div>
  );
}

function App() {
  const [data, setData] = useState(parseData())
  const [toastAlerts, setToastAlerts] = useState([])
  const [selectedLogItem, setSelectedLogItem] = useState(null)
  const [analyzedTopo, setAnalyzedTopo] = useState(null)
  const [loadingTopo, setLoadingTopo] = useState(false)
  const [loadingWeather, setLoadingWeather] = useState(false)
  const [loadingSpace, setLoadingSpace] = useState(false)
  const [weatherSearch, setWeatherSearch] = useState("")
  const [position, setPosition] = useState({ lat: 40.18, lon: 29.07, lng: 29.07 })

  const [activeTab, setActiveTab] = useState('map')
  const [missionType, setMissionType] = useState('launch')
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('tr-TR', { hour12: false }))
  const [selectedRocket, setSelectedRocket] = useState(null)
  const [showRocketList, setShowRocketList] = useState(false)
  const [loadingAirspace, setLoadingAirspace] = useState(false)
  const [spaceports, setSpaceports] = useState([])
  const [simStep, setSimStep] = useState(1)
  const [simRocket, setSimRocket] = useState(null)
  const [simBase, setSimBase] = useState(null)
  const [simDate, setSimDate] = useState('')
  const [simTime, setSimTime] = useState('')
  const [simLive, setSimLive] = useState(false)
  const [simResult, setSimResult] = useState(null)
  const [simLoading, setSimLoading] = useState(false)
  const [isPickMode, setIsPickMode] = useState(false)
  const [pickCoord, setPickCoord] = useState(null)
  
  // UNIFIED SIMULATION STATES
  const [simFlightResult, setSimFlightResult] = useState(null)
  const [simDebrisResult, setSimDebrisResult] = useState(null)
  const [simProgressText, setSimProgressText] = useState('')

  // Custom Rocket State
  const [isAddRocketOpen, setIsAddRocketOpen] = useState(false)
  const [newRocketData, setNewRocketData] = useState({ name: '', class: 'Özel Seri Arac', payload: '', thrust: '', windTolerance: 10, cost: '-', engine: '-', height: '-', diameter: '-', stages: '-', range: '-', dry_mass: '', fuel_type: '-' })
  const [newRocketFile, setNewRocketFile] = useState(null)
  const [uploadingRocket, setUploadingRocket] = useState(false)

  // Fast ORK Naming Modal State
  const [orkPendingData, setOrkPendingData] = useState(null)


  // HERMES Debris Prediction State
  const [debrisRockets, setDebrisRockets] = useState([])
  const [debrisSelectedRocket, setDebrisSelectedRocket] = useState('')
  const [debrisAzimuth, setDebrisAzimuth] = useState(90)
  const [debrisLaunchLat, setDebrisLaunchLat] = useState(28.5)
  const [debrisLaunchLon, setDebrisLaunchLon] = useState(-80.5)
  const [debrisResult, setDebrisResult] = useState(null)
  const [debrisLoading, setDebrisLoading] = useState(false)
  const [debrisBaseOpen, setDebrisBaseOpen] = useState(false)
  const [debrisSelectedBase, setDebrisSelectedBase] = useState(null)
  const [debrisRocketOpen, setDebrisRocketOpen] = useState(false)

  // Ortak Simülasyon Geçmişi (Görev Simülasyonu üzerinden beslenir)
  const [taskHistory, setTaskHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('tt_task_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })

  const locationsRef = React.useRef(null);

  const scrollLocations = (direction) => {
    if (locationsRef.current) {
      const scrollAmount = 300;
      locationsRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const [optimalReport, setOptimalReport] = useState(null);
  const [calculatingOptimal, setCalculatingOptimal] = useState(false);

  const handleCalculateOptimal = (isMapMode = false) => {
    if (!isMapMode && !selectedRocket) {
      addToast("HATA", "Önce bir araç/roket seçmelisiniz.", "danger");
      return;
    }

    setCalculatingOptimal(true);
    addToast("KARAR MOTORU", "Taktiksel hedefleme hesaplanıyor...", "info");

    setTimeout(() => {
      let activeRocket = selectedRocket || rockets[0];
      let bestBase = null;
      let maxScore = -1;

      const mass = parseFloat(activeRocket.dry_mass) || 50000;
      const thrust = parseFloat(activeRocket.thrust) || 4000000;
      const tWr = thrust / (mass * 9.81);

      if (isMapMode) {
        let sc = data.topo?.score ? parseInt(data.topo.score) : 50;
        bestBase = { name: "Seçili Otonom Konum", lat: position.lat, lon: position.lon };
        maxScore = sc;
      } else {
        const bases = spaceports.length > 0 ? spaceports : [{ name: "Varsayılan Özel Üs", lat: 28.5, lon: -80.5, type: 'CIVIL' }];
        bases.forEach(b => {
          let s = 90;
          s -= Math.abs(parseFloat(b.lat)) * 0.4;
          if (b.type === 'MILITARY' || b.type === 'GOVERNMENT') s += 8;
          if (s > maxScore) { maxScore = s; bestBase = b; }
        });
      }

      const windTol = parseFloat(activeRocket.windTolerance) || 15;
      const safeWind = parseFloat(tWr > 1.4 ? windTol * 0.8 : windTol * 0.6).toFixed(1);

      setOptimalReport({
        rocket_name: activeRocket.name,
        base_name: bestBase.name,
        base_lat: typeof bestBase.lat === 'number' ? bestBase.lat.toFixed(4) : parseFloat(bestBase.lat).toFixed(4),
        base_lon: typeof bestBase.lon === 'number' ? bestBase.lon.toFixed(4) : parseFloat(bestBase.lon || bestBase.lng).toFixed(4),
        score: Math.round(maxScore),
        safe_wind: safeWind,
        twr: tWr.toFixed(2),
        req_temp: 15,
        req_press: 1013
      });
      setCalculatingOptimal(false);
      addToast("HESAPLAMA BAŞARILI", "Optimal Rapor Hazırlandı.", "success");
    }, 1500);
  };

  const generateOptimalPDF = () => {
    if (!optimalReport) return;
    addToast("PDF HAZIRLANIYOR", "Görev kararı dışa aktarılıyor...", "info");
    try {
      const tr = str => String(str || "").replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^\x00-\x7F]/g, "");
      const doc = new jsPDF();
      doc.setFillColor(27, 23, 23);
      doc.rect(0, 0, 210, 45, 'F');

      doc.setTextColor(238, 235, 221);
      doc.setFont("courier", "bold");
      doc.setFontSize(16);
      doc.text("TETRATECH KESIN KARAR MOTORU (AI-HARICI)", 20, 25);

      doc.setFontSize(9);
      doc.setTextColor(206, 18, 18);
      doc.text("STRATEJIK FIYATLANDIRMA VE ROTA RAPORU", 20, 35);

      doc.setTextColor(27, 23, 23);
      doc.setFontSize(12);

      doc.text("1. HEDEF PLATFORM: " + tr(optimalReport.rocket_name), 20, 60);
      doc.text("2. ONAYLI LOKASYON: " + tr(optimalReport.base_name), 20, 75);
      doc.setFontSize(10);
      doc.setFont("courier", "normal");
      doc.text(`KOORDINATLAR: ${optimalReport.base_lat} N / ${optimalReport.base_lon} E`, 25, 83);

      doc.setFont("courier", "bold");
      doc.setFontSize(12);
      doc.text("3. TAVSIYE EDILEN ATMOSFERIK KOSULLAR", 20, 100);
      doc.setFontSize(10);
      doc.setFont("courier", "normal");
      doc.text(`MAKSIMUM DEPARTMAN RUZGARI: ${optimalReport.safe_wind} m/s`, 25, 110);
      doc.text(`IDEAL SICAKLIK: ${optimalReport.req_temp} C`, 25, 120);
      doc.text(`IDEAL BASINC: ${optimalReport.req_press} hPa`, 25, 130);

      doc.setFont("courier", "bold");
      doc.setFontSize(12);
      doc.text("4. FIZIKSEL SKORLAMALAR", 20, 150);
      doc.setFontSize(10);
      doc.setFont("courier", "normal");
      doc.text(`ITKI / AGIRLIK ORANI (TWR): ` + optimalReport.twr, 25, 160);
      doc.text(`LOKASYON UYGUNLUK PUANI (GUVENLIK SKORU): %${optimalReport.score}`, 25, 170);

      const stamp = new Date().toLocaleString() + " / ON-PREMISE ALGORITMA ILE HESAPLANDI";
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(stamp, 105, 280, { align: 'center' });

      const pdfBlobUrl = doc.output('bloburl');
      window.open(pdfBlobUrl, '_blank');
      doc.save(`TETRATECH_KARAR_${Math.floor(Math.random() * 90000)}.pdf`);
    } catch (e) { console.error(e); }
  };

  const mapRef = React.useRef();

  const addToast = (title, message, type = 'info') => {
    const id = Date.now();
    setToastAlerts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToastAlerts(prev => prev.filter(t => t.id !== id)), 2000);
  };

  useEffect(() => {
    // Önce API'den ana üsleri çekelim (29 Üs)
    fetch(apiUrl('/spaceports'))
      .then(r => r.json())
      .then(apiBases => {
        const saved = localStorage.getItem('tt_spaceports');
        const userBases = saved ? JSON.parse(saved).filter(b => b.isUserAdded) : [];

        // API'den gelenlerle kullanıcı eklediklerini birleştirelim
        // API'den gelenleri her zaman en güncel haliyle alıyoruz
        setSpaceports([...apiBases, ...userBases]);
      })
      .catch(e => {
        console.error("Spaceport fetch error:", e);
        // Hata durumunda sadece yerel hafızayı göster
        const saved = localStorage.getItem('tt_spaceports');
        if (saved) setSpaceports(JSON.parse(saved));
      });
  }, []);

  useEffect(() => {
    // Sadece kullanıcı tarafından eklenenleri kaydedelim ki API verileriyle çakışmasın
    const userOnly = spaceports.filter(b => b.isUserAdded);
    localStorage.setItem('tt_spaceports', JSON.stringify(userOnly));
  }, [spaceports]);

  const defaultRockets = [
    { id: 'ares', name: 'Ares 1 (B)', filename: 'Ares_1_B.glb', class: 'Yörünge Yük Fırlatıcısı', payload: '25.000 KG', thrust: '16.000 kN', windTolerance: 15, cost: '450 Milyon USD', engine: 'Solid Rocket Booster', height: '94 m', diameter: '5.5 m', stages: '2', range: 'LEO / MEO', dry_mass: '801,000 kg', fuel_type: 'PBAN / LOX + LH2', efficiency: 0.85 },
    { id: 'shuttle', name: 'Space Shuttle', filename: 'Shuttle.glb', class: 'Personel ve Kargo Aracı', payload: '24.400 KG', thrust: '29.000 kN', windTolerance: 14, cost: '1.5 Milyar USD', engine: '3x RS-25 + 2x SRB', height: '56.1 m', diameter: '8.4 m', stages: '1.5 (External Tank)', range: 'LEO', dry_mass: '2,030,000 kg', fuel_type: 'Solid / LOX + LH2', efficiency: 0.72 },
    { id: 'explorer', name: 'Jupiter-C Rocket', filename: 'Jupiter.glb', class: 'Erken Dönem Taşıyıcı', payload: '8.4 KG', thrust: '370 kN', windTolerance: 8, cost: '5 Milyon USD', engine: 'Redstone A-7', height: '21.3 m', diameter: '1.78 m', stages: '4', range: 'Sub-orbital / LEO', dry_mass: '28,000 kg', fuel_type: 'Hydyne / LOX', efficiency: 0.65 },
    { id: 'cassini', name: 'Cassini-Huygens', filename: 'Cassini.glb', class: 'Derin Uzay Sondası', payload: '5.700 KG', thrust: '400 N', windTolerance: 20, cost: '3.2 Milyar USD', engine: 'R-4D', height: '6.7 m', diameter: '4.0 m', stages: 'Titan IVB fırlatıcıdan ayrıldı', range: 'Interplanetary (Saturn)', dry_mass: '2,523 kg', fuel_type: 'MMH / NTO (Bipropellant)', efficiency: 0.95 },
    { id: 'agena', name: 'Agena Target', filename: 'Agena_Target_Vehicle.glb', class: 'Yörünge Römorkörü', payload: '2.500 KG', thrust: '71 kN', windTolerance: 10, cost: 'Bilinmiyor', engine: 'Bell 8096', height: '7.1 m', diameter: '1.5 m', stages: '1', range: 'LEO (Docking Target)', dry_mass: '6,000 kg', fuel_type: 'UDMH / IRFNA', efficiency: 0.88 },
    { id: 'mir', name: 'Mir İstasyonu', filename: 'Mir.glb', class: 'Uzay İstasyonu', payload: '129.700 KG', thrust: '0 kN (Yörünge Sabit)', windTolerance: 40, cost: '4.2 Milyar USD', engine: 'N/A', height: '19 m (Ana Modül)', diameter: '31 m (Yayılım)', stages: '7 Modül', range: 'Low Earth Orbit', dry_mass: '129,700 kg', fuel_type: 'Hydrazine (RCS)', efficiency: 1.0 },
  ];

  const [rockets, setRockets] = useState(() => {
    try {
      const saved = localStorage.getItem('tt_rockets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return [...defaultRockets, ...parsed];
        }
      }
    } catch (e) {
      console.warn("Rockets parse error:", e);
    }
    return defaultRockets;
  });

  useEffect(() => {
    if (!selectedRocket && rockets.length > 0) {
      setSelectedRocket(rockets[0]);
    }
  }, [rockets]);

  useEffect(() => {
    const customOnly = rockets.filter(r => r.isCustom);
    localStorage.setItem('tt_rockets', JSON.stringify(customOnly));
  }, [rockets]);

  const fetchTopo = async () => {
    setLoadingTopo(true)
    try {
      const resp = await fetch(apiUrl(`/topo?lat=${position.lat}&lon=${position.lng}`))
      if (resp.ok) {
        const res = await resp.json()
        setData(prev => ({ ...prev, topo: res }))
        setAnalyzedTopo(res)
      } else {
        throw new Error("Sunucu yanıt vermedi (HTTP " + resp.status + ")")
      }
    } catch (error) {
      console.error("Topo fetch error:", error);
      alert("HATA DETAYI: " + error.message + " \n\nLütfen api.py terminaline bak kral!");
    } finally {
      setLoadingTopo(false)
    }
  }

  // HERMES Roketlerini ve Sistem Roketlerini Senkronize Et
  useEffect(() => {
    fetch(apiUrl('/hermes/rockets'))
      .then(r => r.json())
      .then(d => {
        if (d.rockets) {
          const systemLaunchers = rockets.filter(r => !['Uzay İstasyonu', 'Derin Uzay Sondası'].includes(r.class));
          const merged = [...d.rockets];
          systemLaunchers.forEach(sr => {
            const alreadyIn = merged.find(mr => mr.name.toLowerCase() === sr.name.toLowerCase());
            if (!alreadyIn) {
              merged.push({
                name: sr.name,
                flights: sr.isCustom ? 0 : 10,
                confidence: sr.isCustom ? 'ORTA' : 'YUKSEK',
                propellant: sr.fuel_type,
                stages_count: parseInt(sr.stages) || 1,
                isSystemRocket: true
              });
            }
          });
          setDebrisRockets(merged);
        }
      })
      .catch(() => { });
  }, [rockets]);

  const fetchWeather = async (customCity = null) => {
    setLoadingWeather(true)
    try {
      let url = apiUrl(`/weather?lat=${position.lat}&lon=${position.lng}`)
      if (customCity) url = apiUrl(`/weather?city=${customCity}`)
      const resp = await fetch(url)
      if (resp.ok) {
        const res = await resp.json()
        setData(prev => ({ ...prev, weather: res }))
      }
    } catch (error) { } finally { setLoadingWeather(false) }
  }

  const handleWeatherSearch = (e) => {
    if (e) e.preventDefault();
    fetchWeather(weatherSearch);
  };

  const generatePDF = () => {
    if (!data.topo || !data.topo.score) {
      addToast("ANALİZ GEREKLİ", "Lütfen önce bölge analizini tamamlayın!", "warning");
      return;
    }

    const mapElement = document.getElementById('main-map-container');
    addToast("STRATEJİK RAPOR", "Rapor verileri hazırlanıyor...", "info");

    const captureAndGenerate = (mapImg = null) => {
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const timestamp = new Date().toLocaleString('tr-TR');
        const reportID = `TT-TAC-${Math.floor(Math.random() * 900000 + 100000)}`;

        const tr = str => String(str || "").replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^\x00-\x7F]/g, "");

        const drawFrame = (pageNum) => {
          doc.setCharSpace(0);
          doc.setFont("courier", "bold");
          // Dark Header
          doc.setFillColor(27, 23, 23);
          doc.rect(0, 0, pageWidth, 45, 'F');

          // Header Text
          doc.setTextColor(238, 235, 221);
          doc.setFontSize(20);
          doc.text("TETRATECH GOREV ISTIHBARATI", 20, 22);

          doc.setFontSize(8);
          doc.setTextColor(206, 18, 18);
          doc.text(`GIVENLIK SEVIYESI: GIZLI / KRITIK`, 20, 32);
          doc.setTextColor(238, 235, 221);
          doc.text(`RAPOR ID: ${reportID} | SAYFA: ${pageNum}/4`, 190, 32, { align: 'right' });

          // Footer
          doc.setFontSize(7);
          doc.setTextColor(180);
          doc.text(`BU BELGE TETRATECH AI TARAFINDAN GERCEK ZAMANLI VERI ANALIZI ILE OLUSTURULMUSTUR.`, pageWidth / 2, pageHeight - 10, { align: 'center' });
          doc.text(`ZAMAN DAMGASI: ${timestamp}`, 190, pageHeight - 10, { align: 'right' });
        };

        // ════════════════════════════════════════════════════════════
        // SAYFA 1: OZET VE GORSEL ISTIHBARAT
        // ════════════════════════════════════════════════════════════
        drawFrame(1);
        let cy = 60;

        doc.setFontSize(12);
        doc.setTextColor(27, 23, 23);
        doc.text("1. GOREV PROFILI VE YONETICI OZETI", 20, cy);
        cy += 8;

        autoTable(doc, {
          startY: cy,
          head: [['Parametre', 'Operasyonel Veri', 'Durum']],
          body: [
            ['Gorev Tipi', tr(missionType === 'launch' ? 'ROKET FIRLATMA OPERASYONU' : 'STRATEJIK YERLESKE ANALIZI'), 'AKTIF'],
            ['Hedef Koordinatlar', `${position.lat.toFixed(6)}N / ${position.lon.toFixed(6)}E`, 'KILITLI'],
            ['Ana Arac / Roket', simResult ? tr(simResult.rocket_name) : (selectedRocket ? tr(selectedRocket.name) : 'GENEL FIRLATICI'), 'HAZIR'],
            ['Firlatma Penceresi', simResult ? tr(simResult.target_time) : 'ANLIK ANALIZ', 'ACIK']
          ],
          margin: { left: 20 },
          styles: { fontSize: 8, font: 'courier', halign: 'left' },
          headStyles: { fillColor: [27, 23, 23] }
        });

        cy = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(11);
        doc.text("2. GORSEL ISTIHBARAT (UYDU ORTOFOTOSU)", 20, cy);
        if (mapImg) {
          doc.addImage(mapImg, 'PNG', 20, cy + 4, 170, 95);
          cy += 105;
        } else {
          cy += 10;
        }

        doc.setFontSize(11);
        doc.text("3. TAKTIK KARAR VE EMNIYET SKORU", 20, cy);
        cy += 6;
        const score = parseInt(data.topo.score) || 0;
        const sColor = score >= 85 ? [16, 185, 129] : (score >= 60 ? [245, 158, 11] : [206, 18, 18]);

        doc.setFillColor(245, 245, 245);
        doc.rect(20, cy, 170, 20, 'F');
        doc.setFontSize(18);
        doc.setTextColor(sColor[0], sColor[1], sColor[2]);
        doc.text(`GOREV PUANI: %${score}`, 105, cy + 13, { align: 'center' });

        cy += 28;
        doc.setFontSize(9);
        doc.setTextColor(27, 23, 23);
        doc.setFont("courier", "bold");
        doc.text("STRATEJIK TAVSIYE:", 20, cy);
        doc.setFont("courier", "normal");
        const advice = score >= 85 ? "Bolge operasyonel acidan yuksek guvenlikli ve stratejik olarak uygundur. Firlatma onaylanmistir." : (score >= 60 ? "Kisitli topografik riskler mevcuttur. Gorev kontrollu sekilde devam edebilir." : "Kritik sivil veya cografi engeller nedeniyle operasyonel risk kabul edilemez. GOREV REDDEDILMISTIR.");
        doc.text(tr(advice), 20, cy + 6, { maxWidth: 170 });

        // ════════════════════════════════════════════════════════════
        // SAYFA 2: BILIMSEL VE CEVRESEL VERILER
        // ════════════════════════════════════════════════════════════
        doc.addPage();
        drawFrame(2);
        cy = 60;

        doc.setFontSize(12);
        doc.setTextColor(27, 23, 23);
        doc.text("4. ILERI ATMOSFERIK VE AERODINAMIK VERI SETI", 20, cy);
        cy += 5;

        const aero = simResult?.aerodynamics || {};
        const env = simResult?.environmental || {};

        autoTable(doc, {
          startY: cy,
          head: [['Atmosferik Metrik', 'Hesaplanan Deger', 'Bilimsel Etki']],
          body: [
            ['Ses Hizi (Deniz Seviyesi)', aero.speed_of_sound || '340.2 m/s', 'Sonik Esik'],
            ['Hava Yogunlugu (Rho)', aero.air_density || '1.225 kg/m3', 'Suruklenme Faktoru'],
            ['Max Q Projeksiyonu', aero.max_q_projection || '32.1 kPa', 'Yapisal Stres Limiti'],
            ['Atmosferik Basinc', (data.weather.pressure || 1013) + ' hPa', 'Yanma Verimliligi'],
            ['Termal Gradient', env.thermal_gradient || 'Nominal', 'Yalitim Riski']
          ],
          margin: { left: 20 },
          styles: { fontSize: 8, font: 'courier', halign: 'left' },
          headStyles: { fillColor: [71, 85, 105] }
        });

        cy = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(11);
        doc.text("5. HELIOGRAFIK VE UZAY HAVASI ANALIZI", 20, cy);
        cy += 5;

        autoTable(doc, {
          startY: cy,
          head: [['Uzay Faktoru', 'Anlik Olcum', 'Stratejik Risk']],
          body: [
            ['Kp Indeksi (Jeomanyetik)', data.space.kp_index, tr(data.space.alert)],
            ['X-Ray Aki Seviyesi', data.space.xray_flux, 'Iyonizasyon Riski'],
            ['Gunes Ruzgari Hizi', (data.space.speed || 450) + ' km/s', 'Elektronik Dalgalanma'],
            ['Iyonosferik Risk', env.ionospheric_scintillation || 'DUSUK', 'Haberlesme Kararliligi']
          ],
          margin: { left: 20 },
          styles: { fontSize: 8, font: 'courier', halign: 'left' },
          headStyles: { fillColor: [206, 18, 18] }
        });

        cy = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(11);
        doc.text("6. TOPOGRAFIK TARAMA VE SIVIL RISK MATRISI", 20, cy);
        cy += 5;

        autoTable(doc, {
          startY: cy,
          head: [['Tarama Sektoru', 'Veri Istihbarati', 'Catisma Seviyesi']],
          body: [
            ['Yerlesim Yogunlugu', data.topo.residential, tr(data.topo.civ_risk)],
            ['Endustriyel Etki', data.topo.industrial, data.topo.industrial > 0 ? 'YUKSEK' : 'YOK'],
            ['Arazi Jeomorfolojisi', tr(data.topo.terrain_info), tr(data.topo.suitability)],
            ['Lojistik Liman Erishimi', tr(data.topo.logistics), 'Dogrulandi']
          ],
          margin: { left: 20 },
          styles: { fontSize: 8, font: 'courier', halign: 'left' },
          headStyles: { fillColor: [27, 23, 23] }
        });

        // ════════════════════════════════════════════════════════════
        // SAYFA 3: HERMES ENKAZ VE ETKI ANALIZI
        // ════════════════════════════════════════════════════════════
        doc.addPage();
        drawFrame(3);
        cy = 60;

        doc.setFontSize(12);
        doc.setTextColor(27, 23, 23);
        doc.text("7. HERMES ENKAZ DUSUS VE ETKI ANALIZI", 20, cy);
        cy += 5;

        if (debrisResult) {
          autoTable(doc, {
            startY: cy,
            head: [['Asama #', 'Konum (Enlem / Boylam)', 'Menzil', 'Kutle', 'Risk']],
            body: debrisResult.impact_zones.map(z => [
              z.stage_num,
              `${z.lat?.toFixed(4) || 'TBD'} / ${z.lon?.toFixed(4) || 'TBD'}`,
              `${z.downrange_km} km`,
              `${z.mass_kg?.toLocaleString()} kg`,
              z.risk_level
            ]),
            margin: { left: 20 },
            styles: { fontSize: 8, font: 'courier' },
            theme: 'striped',
            headStyles: { fillColor: [27, 23, 23] }
          });

          cy = doc.lastAutoTable.finalY + 12;
          doc.setFontSize(11);
          doc.text("8. ASAMA MATERYAL VE BERTARAF MANIFESTOSU", 20, cy);
          cy += 5;

          autoTable(doc, {
            startY: cy,
            head: [['Asama Adi', 'Materyal Tipi', 'Bertaraf Yontemi', 'Yanma Suresi']],
            body: debrisResult.stages_manifest.map(s => [
              tr(s.name),
              tr(s.material || 'Superalloy-A'),
              tr(s.disposal),
              `${s.burn_time_s} sec`
            ]),
            margin: { left: 20 },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [71, 85, 105] }
          });

          cy = doc.lastAutoTable.finalY + 12;
          doc.setFontSize(11);
          doc.text("8. ASAMA MATERYAL VE BERTARAF MANIFESTOSU", 20, cy);
          cy += 5;

          autoTable(doc, {
            startY: cy,
            head: [['Asama Adi', 'Materyal Tipi', 'Bertaraf Yontemi', 'Yanma Suresi']],
            body: debrisResult.stages_manifest.map(s => [
              tr(s.name),
              tr(s.material || 'Superalloy-A'),
              tr(s.disposal),
              `${s.burn_time_s} sn`
            ]),
            margin: { left: 20 },
            styles: { fontSize: 8, font: 'courier' },
            headStyles: { fillColor: [71, 85, 105] }
          });
        } else {
          doc.setFillColor(245, 245, 245);
          doc.rect(20, cy, 170, 20, 'F');
          doc.text("Guncel Gorev Icin HERMES Analizi Henuz Yapilmadi. Enkaz verisi eksik.", 105, cy + 12, { align: 'center' });
        }

        // ════════════════════════════════════════════════════════════
        // SAYFA 4: ILERI YORUNGE MEKANIGI VE ITKI FIZIGI (ROKET PRO DATA)
        // ════════════════════════════════════════════════════════════
        doc.addPage();
        drawFrame(4);
        cy = 60;

        doc.setFontSize(12);
        doc.setTextColor(27, 23, 23);
        doc.text("9. ILERI YORUNGE MEKANIGI VE ITKI FIZIGI", 20, cy);
        cy += 8;

        autoTable(doc, {
          startY: cy,
          head: [['Kuantum-Fizik Metrigi', 'Operasyonel Deger', 'Analitik Aciklama']],
          body: [
            ['Spesifik Itki (Isp - Vakum)', '348.1 s', 'Yakitin Birim Kutle Basina Verimlilik Katsayisi'],
            ['Delta-V Butcesi (Toplam)', '9,450 m/s', 'Yorungeye Yerlesim Icin Gerekli Hiz Degisimi'],
            ['TWR (Itki-Agirlik Orani)', '1.42', 'Kalkis Verimliligi Ve Ivmelenme Orani'],
            ['Max Q Dinamik Basinc', '32.1 kPa', 'Yapisal Stres Limitlerinin Kuantum Projeksiyonu'],
            ['Re-entry Termal Aki (Q-dot)', '125 W/cm2', 'Atmosfere Giris Isil Yuklemesi'],
            ['Yorungesel Egim (Beta)', `${position.lat.toFixed(2)} deg`, 'Yorungesel Egim Ve Duzlemi'],
            ['Reynolds Sayisi (Re)', '4.2e7', 'Akiskan Dinamigindeki Turbulans Katsayisi']
          ],
          margin: { left: 20 },
          styles: { fontSize: 8, font: 'courier' },
          headStyles: { fillColor: [45, 55, 72] }
        });

        const pdfBlobUrl = doc.output('bloburl');
        window.open(pdfBlobUrl, '_blank');
        doc.save(`${reportID}_STRATEJIK_RAPOR.pdf`);
        addToast("BASARILI", "4 Sayfalik 'ROKET PRO' Seviye Rapor Indirildi.", "success");
      } catch (e) {
        console.error(e);
        addToast("HATA", "PDF olusturulurken bir sorun olustu.", "danger");
      }
    };

    if (mapElement) {
      html2canvas(mapElement, { useCORS: true, logging: false }).then(canvas => {
        captureAndGenerate(canvas.toDataURL('image/png'));
      }).catch(() => captureAndGenerate(null));
    } else {
      captureAndGenerate(null);
    }
  };

  const generateSimulationPDF = () => {
    if (!simResult) return;
    addToast("SIMULASYON RAPORU", "Bilimsel veri seti derleniyor...", "info");

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const timestamp = new Date().toLocaleString('tr-TR');
    const reportID = `TT-SIM-${Math.floor(Math.random() * 900000 + 100000)}`;

    const tr = str => String(str || "").replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^\x00-\x7F]/g, "");

    const drawHeader = (pageNum) => {
      doc.setCharSpace(0);
      doc.setFont("courier", "bold");
      doc.setFillColor(27, 23, 23);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(18);
      doc.setTextColor(238, 235, 221);
      doc.text("GOREV SIMULASYON ANALIZI", 20, 20);
      doc.setFontSize(8);
      doc.setTextColor(206, 18, 18);
      doc.text(`ID: ${reportID} | YUKSEK SADAKATLI SIMULASYON | SAYFA: ${pageNum}/4`, 20, 30);
    };

    // --- SAYFA 1 ---
    drawHeader(1);
    let cy = 55;
    doc.setTextColor(27, 23, 23);
    doc.setFont("courier", "bold");
    doc.text("1. GOREV PARAMETRELERI", 20, cy);
    cy += 10;
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.text(`Arac / Roket: ${tr(simResult.rocket_name)}`, 20, cy);
    doc.text(`Firlatma Zamani: ${tr(simResult.target_time)}`, 190, cy, { align: 'right' });
    cy += 7;
    doc.text(`Firlatma Kompleksi: ${simResult.coordinates}`, 20, cy);
    cy += 15;

    doc.setFillColor(simResult.status === 'UYGUN' ? 240 : 255, simResult.status === 'UYGUN' ? 250 : 240, simResult.status === 'UYGUN' ? 240 : 240);
    doc.rect(20, cy, 170, 20, 'F');
    doc.setFontSize(16);
    doc.setTextColor(simResult.status === 'UYGUN' ? 16 : 206, simResult.status === 'UYGUN' ? 120 : 18, 18);
    doc.text(tr(simResult.decision), 105, cy + 13, { align: 'center' });
    cy += 30;

    autoTable(doc, {
      startY: cy,
      head: [['Risk Vektoru', 'Siddet', 'Taktik Analiz']],
      body: simResult.risks.map(r => [tr(r.type), r.level, tr(r.msg)]),
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8, halign: 'left' },
      headStyles: { fillColor: [27, 23, 23] }
    });

    // --- SAYFA 2 ---
    doc.addPage();
    drawHeader(2);
    cy = 55;
    doc.setFont("courier", "bold");
    doc.text("2. AERODINAMIK VE CEVRESEL ISTIHBARAT", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Metrik', 'Deger', 'Etki']],
      body: [
        ['Mach Limiti', simResult.aerodynamics.mach_limit, 'Yapisal Integrity'],
        ['Ses Hizi', simResult.aerodynamics.speed_of_sound, 'Sonik Stres'],
        ['Max Q Projeksiyonu', simResult.aerodynamics.max_q_projection, 'Dinamik Basinc'],
        ['Yogunluk', simResult.aerodynamics.air_density, 'Suruklenme Hesabi'],
        ['Gorus Mesafesi', simResult.weather_forecast.visibility + " km", 'Gorsel Takip']
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8, halign: 'left' },
      headStyles: { fillColor: [71, 85, 105] }
    });

    cy = doc.lastAutoTable.finalY + 15;
    autoTable(doc, {
      startY: cy,
      head: [['Alan', 'Veri Istihbarati', 'Iyonosferik Risk']],
      body: [
        ['Aydinlanma', tr(simResult.environmental.illumination), 'Gorsel Takip'],
        ['Scintillation', simResult.environmental.ionospheric_scintillation, 'Link Kararliligi'],
        ['Termal Gradient', simResult.environmental.thermal_gradient, 'Materyal Dayanimi'],
        ['Nem Orani', "%" + simResult.weather_forecast.humidity, 'Sensor Kaybi']
      ],
      theme: 'striped',
      styles: { font: 'courier', fontSize: 8, halign: 'left' },
      headStyles: { fillColor: [206, 18, 18] }
    });

    // --- SAYFA 3 ---
    doc.addPage();
    drawHeader(3);
    cy = 55;
    doc.setFont("helvetica", "bold");
    doc.text("3. SISTEM HAZIRLIK KONTROL LISTESI", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Analiz Edilen Altsistem', 'Durum', 'AI Dogrulama']],
      body: (simResult.details || []).map(d => [tr(d), 'KILITLI / NOMINAL', 'DOGRULANDI']),
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [27, 23, 23] }
    });

    // --- SAYFA 4 --- (PRO ROCKET SCIENCE)
    doc.addPage();
    drawHeader(4);
    cy = 55;
    doc.setFont("helvetica", "bold");
    doc.text("4. ILERI YORUNGE MEKANIGI VE PRO ISTIHBARAT", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Kuantum-Fizik Metrigi', 'Operasyonel Deger', 'Analitik Aciklama']],
      body: [
        ['Spesifik Itki (Isp - Vakum)', '348.1 sn', 'Yakitin Verimlilik Katsayisi (Pro-Grade)'],
        ['Delta-V Butcesi (Nominal)', '9,450 m/s', 'Yorungeye Yerlesim Icin Gereken Momentum'],
        ['TWR (Thrust-to-Weight)', '1.42 G', 'Kalkis Verimliligi Ve Ivmelenme Analizi'],
        ['Termal Isil Aki (Q-dot)', '125 W/cm2', 'Atmosfere Giris Isil Direnc Siniri'],
        ['Reynolds Sayisi (Re)', '4.2e7', 'Turbulansli Akiskan Dinamigi Katsayisi'],
        ['Maksimum G-Load', '3.82 G', 'Govde Uzerindeki Kritik Yukleme']
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [45, 55, 72] }
    });

    const pdfBlobUrl = doc.output('bloburl');
    window.open(pdfBlobUrl, '_blank');
    doc.save(`${reportID}_DETAYLI_SIMULASYON.pdf`);
    addToast("BASARILI", "4 Sayfalik 'PRO-ROKET' Analiz Raporu Indirildi.", "success");
  };

  const generateDebrisPDF = () => {
    if (!debrisResult) return;
    addToast("HERMES RAPORU", "Enkaz veri seti derleniyor...", "info");

    const reportID = `TETRA-DEBRIS-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const timestamp = new Date().toLocaleString('tr-TR');

    const tr = str => String(str || "").replace(/Ğ/g, 'G').replace(/Ü/g, 'U').replace(/Ş/g, 'S').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ç/g, 'C').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^\x00-\x7F]/g, "");

    const drawFrame = (pageNum) => {
      doc.setCharSpace(0);
      doc.setFont("courier", "bold");
      doc.setFillColor(27, 23, 23);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(18);
      doc.setTextColor(238, 235, 221);
      doc.text("HERMES CANLI SIMULASYON RAPORU", 20, 20);
      doc.setFontSize(8);
      doc.setTextColor(206, 18, 18);
      doc.text(`ID: ${reportID} | ENKAZ VE ETKI ANALIZI | SAYFA: ${pageNum}/4`, 20, 30);
    };

    // --- SAYFA 1 ---
    drawFrame(1);
    let cy = 55;
    doc.setTextColor(27, 23, 23);
    doc.text("1. OPERASYONEL ANALIZ OZETI", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Parametre', 'Veri Degeri']],
      body: [
        ['Analiz Edilen Arac', tr(debrisResult.rocket)],
        ['Firlatma Koordinati', `${debrisLaunchLat}N / ${debrisLaunchLon}E`],
        ['Azimut Acisi', `${debrisAzimuth} derece`],
        ['Hesaplanan Enkaz Sayisi', debrisResult.impact_zones?.length || 0],
        ['AI Guven Araligi', debrisResult.confidence || 'YUKSEK'],
        ['Yakit / Itki Tipi', tr(debrisResult.propellant)]
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [27, 23, 23] }
    });

    // --- SAYFA 2 ---
    doc.addPage();
    drawFrame(2);
    cy = 55;
    doc.text("2. ILERI ATMOSFERIK VE FIZIKSEL SPEKLER", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Fiziksel Metrik', 'Deger', 'Analiz']],
      body: [
        ['Mach Max Projection', 'Mach 2.8', 'Yapisal Isil Yuk'],
        ['Max Q Drag', '32.1 kPa', 'Dinamik Basinc Projeksiyonu'],
        ['Yercekimi Ivmesi (G)', '9.81 m/s2', 'Nominal Sabit'],
        ['Atmosferik Yogunluk', '1.225 kg/m3', 'Suruklenme Katsayisi Faktoru']
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] }
    });

    // --- SAYFA 3 ---
    doc.addPage();
    drawFrame(3);
    cy = 55;
    doc.text("3. DETAYLI ENKAZ ETKI MATRISI", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Asama', 'Konum (Lat/Lon)', 'Menzil', 'Kutle', 'Risk']],
      body: (debrisResult.impact_zones || []).map(z => [
        z.stage_num || '-',
        `${z.lat?.toFixed(4) || 'TBD'} / ${z.lon?.toFixed(4) || 'TBD'}`,
        `${z.downrange_km || 0} km`,
        `${z.mass_kg || 0} kg`,
        z.risk_level || 'N/A'
      ]),
      theme: 'striped',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [206, 18, 18] }
    });

    // --- SAYFA 4 --- (PRO ROCKET SCIENCE)
    doc.addPage();
    drawFrame(4);
    cy = 55;
    doc.text("4. ILERI YORUNGE MEKANIGI VE PRO ISTIHBARAT", 20, cy);
    cy += 10;
    autoTable(doc, {
      startY: cy,
      head: [['Kuantum-Fizik Metrigi', 'Operasyonel Deger', 'Analitik Aciklama']],
      body: [
        ['Spesifik Itki (Isp - Vakum)', '348.1 sn', 'Yakitin Verimlilik Katsayisi (Pro-Grade)'],
        ['Delta-V Butcesi (Nominal)', '9,450 m/s', 'Yorungeye Yerlesim Icin Gereken Momentum'],
        ['TWR (Thrust-to-Weight)', '1.42 G', 'Kalkis Verimliligi Ve Ivmelenme Analizi'],
        ['Termal Isil Aki (Q-dot)', '125 W/cm2', 'Atmosfere Giris Isil Direnc Siniri'],
        ['Reynolds Sayisi (Re)', '4.2e7', 'Turbulansli Akiskan Dinamigi Katsayisi']
      ],
      theme: 'grid',
      styles: { font: 'courier', fontSize: 8 },
      headStyles: { fillColor: [45, 55, 72] }
    });

    doc.save(`${reportID}_HERMES_ANALIZ.pdf`);
    addToast("BASARILI", "4 Sayfalik HERMES Analiz Raporu Indirildi.", "success");
  };

  const fetchSpace = async () => {
    setLoadingSpace(true);
    try {
      const resp = await fetch(apiUrl(`/space/current?lat=${position.lat}&lon=${position.lon}`));
      const res = await resp.json();

      // ERKEN UYARI BİLDİRİM MANTIĞI
      if (res.risk_level === "HIGH" && data.space.risk_level !== "HIGH") {
        addToast('[KRİTİK UZAY HAVASI]', `Kp İndeksi ${res.kp_index} seviyesine fırladı! Radyasyon riski yüksek, fırlatma durdurulmalıdır.`, 'danger');
      } else if (res.risk_level === "MEDIUM" && data.space.risk_level === "LOW") {
        addToast('[SİSTEM UYARISI]', `Kp İndeksi ${res.kp_index} oldu. Manyetik alanda dalgalanma tespit edildi.`, 'warning');
      }

      setData(prev => ({ ...prev, space: res }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSpace(false);
    }
  };

  const fetchAirspace = async () => {
    setLoadingAirspace(true)
    try {
      const resp = await fetch(apiUrl(`/airspace?lat=${position.lat}&lon=${position.lon}`))
      if (resp.ok) {
        const res = await resp.json()
        setData(prev => ({ ...prev, airspace: res }))
      }
    } catch (error) {
      console.error("Airspace fetch error:", error);
    } finally { setLoadingAirspace(false) }
  }

  const MenuIcon = ({ type }) => {
    const iconStyle = { fontSize: '1.2rem', color: 'currentColor' };
    const icons = {
      map: <TerrainIcon style={iconStyle} />,
      weather: <WbCloudyIcon style={iconStyle} />,
      space: <PublicIcon style={iconStyle} />,
      airspace: <FlightTakeoffIcon style={iconStyle} />,
      rocket: <RocketLaunchIcon style={iconStyle} />,
      simulation: <AnalyticsIcon style={iconStyle} />,
      rocketsim: <RocketLaunchIcon style={iconStyle} />,
      settings: <SettingsIcon style={iconStyle} />
    };
    return <span className="nav-icon" style={{ display: 'flex', alignItems: 'center', marginRight: '12px' }}>{icons[type]}</span>;
  }

  useEffect(() => {
    // İlk açılışta verileri çekelim
    fetchTopo(); fetchWeather(); fetchSpace(); fetchAirspace();
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('tr-TR', { hour12: false })), 1000)
    return () => clearInterval(timer)
  }, [])

  const maxBounds = [[-90, -180], [90, 180]];

  return (
    <div className="app-container">

      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0px', overflow: 'hidden', background: 'transparent' }}>
          <img src="/TETRA.svg" alt="TETRA LOGO" style={{ height: '215px', width: 'auto', objectFit: 'contain' }} />
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>
            <MenuIcon type="map" /> Bölge ve Yüzey Haritası
          </button>
          <button className={`nav-item ${activeTab === 'weather' ? 'active' : ''}`} onClick={() => setActiveTab('weather')}>
            <MenuIcon type="weather" /> Atmosferik Hava Verisi
          </button>
          <button className={`nav-item ${activeTab === 'space' ? 'active' : ''}`} onClick={() => setActiveTab('space')}>
            <MenuIcon type="space" /> Uzay Havası
          </button>
          <button className={`nav-item ${activeTab === 'bases' ? 'active' : ''}`} onClick={() => setActiveTab('bases')}>
            <MenuIcon type="map" /> Fırlatma Üsleri
          </button>
          <button className={`nav-item ${activeTab === 'rocket' ? 'active' : ''}`} onClick={() => setActiveTab('rocket')}>
            <MenuIcon type="rocket" /> Roket Garajı
          </button>
          <button className={`nav-item ${activeTab === 'simulation' ? 'active' : ''}`} onClick={() => { setActiveTab('simulation'); setSimStep(1); setSimResult(null); }}>
            <MenuIcon type="simulation" /> Görev Simülasyonu
          </button>
          <button className={`nav-item ${activeTab === 'debris' ? 'active' : ''}`} onClick={() => setActiveTab('debris')}>
            <MenuIcon type="space" /> Canlı Simülasyon
          </button>
          <button className={`nav-item ${activeTab === 'rocketsim' ? 'active' : ''}`} onClick={() => setActiveTab('rocketsim')}>
            <MenuIcon type="rocketsim" /> Roket Uçuş Simülasyonu
          </button>
        </nav>
      </aside>

      <div className="main-wrapper">
        <header className="topbar" style={{ height: '85px', background: 'var(--bg-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', flexShrink: 0, boxShadow: '0 8px 30px rgba(0,0,0,0.08)', borderRadius: '4px', zIndex: 1100 }}>
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold', letterSpacing: '2px', color: 'var(--text-secondary)' }}>
            Telemetrik Eşzamanlı Tahmin Ve Rehber Ağı
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '1.25rem', color: 'var(--primary-blue)', fontWeight: 'bold', letterSpacing: '1px' }}>
              {currentTime} UTC+3
            </span>
          </div>
        </header>

        <main className="main-content">

          {activeTab === 'map' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1fr', alignItems: 'center', marginBottom: '1.2rem', gap: '2rem', height: '70px', flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div className="page-subtitle">OPERASYONEL BÖLGE DURUMU</div>
                  <div className="page-title" style={{ fontSize: '1.5rem' }}>Topografik Risk ve Bölge Haritası</div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {/* GÖREV TİPİ SEÇİCİ */}
                  <div style={{ display: 'flex', background: '#cecbbf', padding: '4px', borderRadius: '4px', height: '50px', alignItems: 'center' }}>
                    <button
                      onClick={() => setMissionType('launch')}
                      style={{ padding: '0 1.2rem', height: '100%', fontSize: '0.65rem', fontWeight: 900, background: missionType === 'launch' ? '#1B1717' : 'transparent', color: missionType === 'launch' ? 'white' : '#1B1717', border: 'none', cursor: 'pointer', transition: '0.2s', borderRadius: '4px' }}
                    >
                      ROKET FIRLATMA
                    </button>
                    <button
                      onClick={() => setMissionType('base')}
                      style={{ padding: '0 1.2rem', height: '100%', fontSize: '0.65rem', fontWeight: 900, background: missionType === 'base' ? '#1B1717' : 'transparent', color: missionType === 'base' ? 'white' : '#1B1717', border: 'none', cursor: 'pointer', transition: '0.2s', borderRadius: '4px' }}
                    >
                      ÜS İNŞAATI
                    </button>
                  </div>

                  <div style={{ background: '#cecbbf', padding: '0 1.3rem', borderRadius: '4px', textAlign: 'right', minWidth: '180px', height: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '0.55rem', color: 'rgba(27, 23, 23, 0.7)', fontWeight: 900, letterSpacing: '1px' }}>HEDEF KOORDİNAT SİSTEMİ</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1B1717' }}>{position.lat.toFixed(4)}N / {position.lon.toFixed(4)}E</div>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={() => { fetchTopo(); fetchWeather(); fetchAirspace(); }}
                    disabled={loadingTopo || loadingWeather || loadingAirspace}
                    style={{ padding: '0 1.5rem', height: '50px', fontSize: '0.7rem', letterSpacing: '1px', background: '#cecbbf', color: '#1B1717', borderRadius: '4px', flexShrink: 0 }}
                  >
                    {loadingTopo || loadingWeather || loadingAirspace ? "TARANIYOR..." : "ANALİZİ BAŞLAT VE TARA"}
                  </button>
                </div>
              </div>

              {/* HIZLI NAVIGASYON: UZAY ÜSLERİ */}
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '1.2rem', position: 'relative' }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.65rem', color: '#CE1212', marginRight: '5px', whiteSpace: 'nowrap' }}>HIZLI KONUMLAR:</div>

                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                  <button
                    onClick={() => scrollLocations('left')}
                    style={{
                      position: 'absolute', left: 0, zIndex: 10, background: 'rgba(206, 203, 191, 0.8)', border: 'none',
                      borderRadius: '50%', color: '#1B1717', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', width: '24px', height: '24px', backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <ChevronLeftIcon style={{ fontSize: '1.2rem' }} />
                  </button>

                  <div
                    ref={locationsRef}
                    style={{
                      display: 'flex', gap: '0.8rem', overflowX: 'auto', padding: '5px 30px', scrollBehavior: 'smooth'
                    }}
                    className="no-scrollbar"
                  >
                    {spaceports.map((sp, i) => (
                      <button
                        key={i}
                        onClick={() => setPosition({ lat: sp.lat, lon: sp.lon, lng: sp.lon })}
                        style={{ padding: '0.6rem 1.2rem', background: '#cecbbf', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s', border: 'none', color: '#1B1717' }}
                        onMouseEnter={e => e.target.style.background = '#d9d6c7'}
                        onMouseLeave={e => e.target.style.background = '#cecbbf'}
                      >
                        {sp.name}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => scrollLocations('right')}
                    style={{
                      position: 'absolute', right: 0, zIndex: 10, background: 'rgba(206, 203, 191, 0.8)', border: 'none',
                      borderRadius: '50%', color: '#1B1717', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', width: '24px', height: '24px', backdropFilter: 'blur(4px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <ChevronRightIcon style={{ fontSize: '1.2rem' }} />
                  </button>
                </div>
              </div>

              <div className="dashboard-grid" style={{ flex: 1, minHeight: 0, gap: '1.2rem', gridTemplateColumns: 'minmax(0, 1fr) 380px' }}>
                <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: '4px' }}>

                  <div id="main-map-container" className="map-container-outer" style={{ flex: 1, borderRadius: '4px' }}>
                    <MapContainer
                      id="leaflet-map"
                      center={[position.lat, position.lon]}
                      zoom={10}
                      scrollWheelZoom={true}
                      style={{ height: '100%', width: '100%' }}
                      maxBounds={maxBounds}
                      maxBoundsViscosity={1.0}
                      minZoom={2}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        noWrap={true}
                      />
                      <LocationMarker position={position} setPosition={setPosition} setAnalyzedTopo={setAnalyzedTopo} />
                      <AnalysisVisuals analyzedTopo={analyzedTopo} />
                    </MapContainer>

                    <div className="map-overlay-bottom" style={{ background: '#cecbbf', padding: '1rem', borderRadius: '4px', display: 'flex', gap: '1rem', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem 0.8rem', background: 'rgba(27,23,23,0.05)', borderRadius: '4px', border: '1px solid rgba(27,23,23,0.05)' }}>
                          <span style={{ color: 'rgba(27, 23, 23, 0.6)', fontSize: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>TETİKLENEN KOORDİNAT</span>
                          <span style={{ color: '#1B1717', fontSize: '0.75rem', fontWeight: 900, whiteSpace: 'nowrap' }}>{position.lat.toFixed(4)} <span style={{ color: 'rgba(27,23,23,0.3)', margin: '0 2px' }}>//</span> {position.lon.toFixed(4)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.5rem 0.8rem', background: 'rgba(206,18,18,0.05)', borderRadius: '4px', border: '1px solid rgba(206,18,18,0.05)' }}>
                          <span style={{ color: 'rgba(206,18,18, 0.7)', fontSize: '0.5rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px' }}>GÜVENLİK PUANI</span>
                          <span style={{ color: '#CE1212', fontWeight: 900, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>%{data.topo.score}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                        <button className="btn-primary" onClick={fetchTopo} disabled={loadingTopo} style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.75rem', background: '#1B1717', color: '#EEEBDD', borderRadius: '4px' }}>
                          BÖLGEYİ ONAYLA
                        </button>
                        <button className="btn-primary" onClick={() => handleCalculateOptimal(true)} disabled={loadingTopo || calculatingOptimal || !data.topo?.score} style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.7rem', background: '#CE1212', color: '#EEEBDD', borderRadius: '4px' }}>
                          {calculatingOptimal ? 'HESAPLANIYOR...' : 'EN UYGUN FIRLATMA KOŞULLARI'}
                        </button>
                      </div>

                      {optimalReport && (
                        <div style={{ display: 'flex', background: '#ffffff', padding: '0.6rem', borderRadius: '4px', gap: '1rem', alignItems: 'center', animation: 'fadeIn 0.3s', flex: 1.5, borderLeft: '4px solid #10b981' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(27,23,23,0.5)' }}>LİMİT ({optimalReport.rocket_name})</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#10b981' }}>{optimalReport.safe_wind} m/s</div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'rgba(27,23,23,0.5)' }}>STANDART HAVA</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1B1717' }}>{optimalReport.req_temp}°C, {optimalReport.req_press}mb</div>
                          </div>
                          <button onClick={generateOptimalPDF} style={{ padding: '0.5rem 1rem', background: '#1B1717', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.65rem', height: '100%' }}>
                            <PictureAsPdfIcon style={{ fontSize: '0.9rem' }} /> PDF AL
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                  <div className="card" style={{ padding: '1.2rem', flex: 1, minHeight: 0, overflowY: 'auto', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                      <div>
                        <div className="card-title" style={{ fontSize: '1rem', marginBottom: '0.1rem' }}>Analiz Raporu</div>
                        <div className="card-subtitle" style={{ margin: 0, fontSize: '0.6rem' }}>ÇEVRESEL RİSK METRİKLERİ</div>
                      </div>
                      <button
                        onClick={generatePDF}
                        disabled={!data.topo}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', background: data.topo ? '#a0a7a4ff' : '#cbd5e1', color: 'white', border: 'none', padding: '6px 12px', fontSize: '0.65rem', fontWeight: 900, cursor: data.topo ? 'pointer' : 'not-allowed', borderRadius: '4px', letterSpacing: '1px' }}
                      >
                        <PictureAsPdfIcon fontSize="small" /> PDF RAPORU OLUŞTUR
                      </button>
                    </div>

                    <div className="data-group" style={{ background: '#cecbbf', padding: '0.8rem', borderRadius: '4px', marginBottom: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span className="data-label" style={{ fontWeight: 800, color: '#1B1717', fontSize: '0.55rem' }}>ENGEL ANALİZİ</span>
                        <span className="data-label" style={{ color: '#787a79ff', fontSize: '0.55rem' }}>NOMİNAL</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#1B1717', fontWeight: 700 }}>{data.topo.terrain_info}</div>
                    </div>

                    <div className="data-group" style={{ background: '#cecbbf', padding: '0.8rem', borderRadius: '4px', marginBottom: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span className="data-label" style={{ fontWeight: 800, color: '#1B1717', fontSize: '0.55rem' }}>YERLEŞİM RİSKİ</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: data.topo.civ_risk?.includes?.("RİSK") ? '#CE1212' : data.topo.civ_risk?.includes?.("AVANTAJ") ? '#a0a7a4ff' : '#1B1717', fontWeight: 700 }}>{data.topo.civ_risk}</div>
                      <div style={{ marginTop: '0.2rem', color: 'rgba(27, 23, 23, 0.6)', fontSize: '0.65rem' }}>Yerleşim: {data.topo.residential} | Sanayi: {data.topo.industrial}</div>
                    </div>

                    <div className="data-group" style={{ background: '#cecbbf', padding: '0.8rem', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#1B1717', marginBottom: '0.3rem' }}>FİZİKSEL ENGEL SAPTAMA</div>
                      <div style={{ fontSize: '0.85rem', color: data.topo.airspace_risk?.includes?.("DİKKAT") ? '#CE1212' : '#1B1717', fontWeight: 700 }}>{data.topo.airspace_risk}</div>
                    </div>
                  </div>

                  <div className="card" style={{ background: '#cecbbf', padding: '1rem', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 900, letterSpacing: '2px', color: '#1B1717', marginBottom: '0.5rem' }}>NİHAİ BİLGİSAYAR KARARI</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: (data.topo.suitability?.includes?.("KRİTİK") || data.topo.suitability?.includes?.("RED") || data.topo.suitability?.includes?.("DEĞİL")) ? '#CE1212' : '#1B1717' }}>
                      {data.topo.suitability?.split?.(':')?.[0]}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, opacity: 0.8, color: '#1B1717' }}>{data.topo.suitability?.split?.(':')?.[1]}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1fr', alignItems: 'center', marginBottom: '1.2rem', gap: '2rem', height: '70px', flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div className="page-subtitle">BÖLGESEL ATMOSFERİK ANALİZ</div>
                  <div className="page-title" style={{ fontSize: '1.5rem' }}>Meteorolojik Veriler</div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <form onSubmit={handleWeatherSearch} style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
                    <input
                      type="text"
                      className="search-wrap"
                      placeholder="Şehir Ara..."
                      value={weatherSearch}
                      onChange={(e) => setWeatherSearch(e.target.value)}
                      style={{ height: '40px', width: '100%', background: '#ffffff', flex: 1, borderRadius: '4px' }}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '0 1.5rem', height: '40px', fontSize: '0.75rem', background: '#cecbbf', color: '#1B1717', borderRadius: '4px' }}>
                      SORGULA
                    </button>
                  </form>
                </div>
              </div>

              <div className="dashboard-grid" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '1.2rem' }}>
                <div className="card static-card" style={{ padding: '2rem', background: '#ffffff', borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', gridColumn: 'span 1', gridRow: 'span 1' }}>
                  {/* Subtle Map Background */}
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, opacity: 0.15, filter: 'grayscale(100%) brightness(1.1)', pointerEvents: 'none' }}>
                    {data.weather?.coord && data.weather.coord !== "-" && (
                      <MapContainer
                        key={data.weather.coord}
                        center={[parseFloat(data.weather.coord.split(',')[0]), parseFloat(data.weather.coord.split(',')[1])]}
                        zoom={11}
                        zoomControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      </MapContainer>
                    )}
                  </div>

                  <div style={{ position: 'relative', zIndex: 1001 }}>
                    <div style={{ color: 'var(--primary-blue)', fontWeight: 900, fontSize: '0.7rem', letterSpacing: '2px', marginBottom: '0.8rem' }}>METEOROLOJİK MERKEZ</div>
                    <div style={{ fontSize: '3rem', fontWeight: 900, color: '#1B1717', marginBottom: '0.5rem', lineHeight: 1.1 }}>{(data.weather?.city || "-").toUpperCase()}</div>
                    <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.75rem' }}>KOORDİNAT: {data.weather?.coord || "-"}</div>
                  </div>


                </div>

                <div className="card static-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem', padding: '2rem', borderRadius: '4px' }}>
                  <div style={{ color: '#10b981', fontWeight: 900, fontSize: '0.7rem', letterSpacing: '2px' }}>TERMAL ALGILAYICILAR</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{data.weather?.temp}<small style={{ fontSize: '1.5rem' }}>°C</small></span>
                    <span style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(27, 23, 23, 0.6)', fontWeight: 800 }}>HİSSEDİLEN</div>
                      <div style={{ fontWeight: 900, fontSize: '1.5rem', color: '#1B1717' }}>{data.weather?.feels_like}°C</div>
                    </span>
                  </div>
                </div>

                <div className="card static-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem', padding: '2rem', borderRadius: '4px' }}>
                  <div style={{ color: '#f59e0b', fontWeight: 900, fontSize: '0.7rem', letterSpacing: '2px' }}>RÜZGAR VE GÖRÜŞ ALANI</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '4.5rem', fontWeight: 900, lineHeight: 1 }}>{data.weather?.wind}<small style={{ fontSize: '1.2rem', marginLeft: '0.5rem' }}>m/s</small></span>
                    <span style={{ textAlign: 'right', paddingBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(27, 23, 23, 0.6)', fontWeight: 800 }}>GÖRÜŞ MESAFESİ</div>
                      <div style={{ fontWeight: 900, fontSize: '1.5rem', color: '#1B1717' }}>{data.weather?.visibility} M</div>
                    </span>
                  </div>
                </div>

                <div className="card static-card" style={{ gridColumn: 'span 3', padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '2rem', fontWeight: 900, fontSize: '0.75rem', letterSpacing: '2px', color: 'rgba(27, 23, 23, 0.6)' }}>KRİTİK YOĞUNLUK VE ATMOSFERİK BASINÇ ANALİZİ</div>
                  <div className="grid-3" style={{ gap: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#1B1717', fontWeight: 900, opacity: 0.6 }}>BAROMETRİK BASINÇ</div>
                      <div style={{ fontSize: '3rem', fontWeight: 900, color: '#1B1717' }}>{data.weather?.pressure}<small style={{ fontSize: '1rem', marginLeft: '0.5rem' }}>hPa</small></div>
                    </div>

                    <div style={{ borderLeft: '2px solid rgba(27, 23, 23, 0.1)', paddingLeft: '3rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#1B1717', fontWeight: 900, opacity: 0.6 }}>BAĞIL NEM ORANI</div>
                      <div style={{ width: '85px', height: '85px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '5px' }}>
                        <svg width="85" height="85" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="18" fill="transparent" stroke="rgba(27,23,23,0.05)" strokeWidth="3" />
                          <circle cx="20" cy="20" r="18" fill="transparent" stroke="#3b82f6" strokeWidth="3"
                            strokeDasharray={`${(data.weather?.humidity || 0) * 1.13} 113.1`}
                            transform="rotate(-90 20 20)"
                            style={{ transition: 'stroke-dasharray 1.5s ease-in-out', strokeLinecap: 'round' }} />
                        </svg>
                        <div style={{ position: 'absolute', fontSize: '1.2rem', fontWeight: 900, color: '#1B1717' }}>%{data.weather?.humidity}</div>
                      </div>
                    </div>

                    <div style={{ borderLeft: '2px solid rgba(27, 23, 23, 0.1)', paddingLeft: '3rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.8rem', color: '#1B1717', fontWeight: 900, opacity: 0.6 }}>BULUT KAPANMASI</div>
                      <div style={{ width: '85px', height: '85px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '5px' }}>
                        <svg width="85" height="85" viewBox="0 0 40 40">
                          <circle cx="20" cy="20" r="18" fill="transparent" stroke="rgba(27,23,23,0.05)" strokeWidth="3" />
                          <circle cx="20" cy="20" r="18" fill="transparent" stroke="#6366f1" strokeWidth="3"
                            strokeDasharray={`${(data.weather?.clouds || 0) * 1.13} 113.1`}
                            transform="rotate(-90 20 20)"
                            style={{ transition: 'stroke-dasharray 1.5s ease-in-out', strokeLinecap: 'round' }} />
                        </svg>
                        <div style={{ position: 'absolute', fontSize: '1.2rem', fontWeight: 900, color: '#1B1717' }}>%{data.weather?.clouds}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'space' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

              {/* 1. MİSSİON STATUS HUD - PRD Risk Level Integration */}
              <div style={{
                background: (data.space.risk_level === "HIGH" || data.space.alert === "KIZIL") ? '#CE1212' :
                  (data.space.risk_level === "MEDIUM" ? '#f59e0b' : '#cecbbf'),
                padding: '1.2rem 2rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                color: (data.space.risk_level === "HIGH" || data.space.risk_level === "MEDIUM") ? 'white' : '#1B1717',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                flexShrink: 0
              }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, opacity: 0.8, letterSpacing: '3px', marginBottom: '4px' }}>ELEKTROMANYETİK SPEKTRUM VE ANALİZ</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.5px' }}>
                    {data.space.risk_level === "HIGH" ? "KRİTİK FIRTINA RİSKİ" :
                      data.space.risk_level === "MEDIUM" ? "AKTİF TAKİP MODU" : "MANYETİK ALAN STABİL"}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '0.85rem', fontWeight: 700, background: 'rgba(0,0,0,0.1)', padding: '4px 10px', borderRadius: '4px', display: 'inline-block' }}>
                    DURUM KODU: {data.space.event || "İZLENİYOR"}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                    <div className="pulse-led" style={{ width: '10px', height: '10px', background: (data.space.risk_level === "HIGH" || data.space.risk_level === "MEDIUM") ? '#fff' : '#1B1717', borderRadius: '50%' }}></div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900 }}>NOAA CANLI BAĞLANTI</div>
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>SİSTEM GÜNCEL // {currentTime}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) 350px', gap: '1rem', flex: 1, minHeight: 0 }}>

                {/* SOL PANEL: ANA METRİKLER VE GRAFİK */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="grid-3" style={{ gap: '1rem' }}>
                    {/* Kp Index */}
                    <div className="card" style={{ padding: '1.2rem', textAlign: 'center', background: '#ffffff', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>PLANETARY K-INDEX</div>
                      <div style={{ fontSize: '3rem', fontWeight: 900, color: data.space.kp_index >= 5 ? '#CE1212' : '#1B1717' }}>{data.space.kp_index}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: data.space.kp_index >= 5 ? '#CE1212' : '#10b981' }}>
                        {data.space.kp_index >= 7 ? "ŞİDDETLİ FIRTINA" : (data.space.kp_index >= 5 ? "FIRTINA" : "STABİL")}
                      </div>
                    </div>

                    {/* Solar Flare */}
                    <div className="card" style={{ padding: '1.2rem', textAlign: 'center', background: '#ffffff', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>SOLAR X-RAY FLUX</div>
                      <div style={{ fontSize: '3rem', fontWeight: 900, color: data.space.solar_flare === 'X' ? '#CE1212' : (data.space.solar_flare === 'M' ? '#f59e0b' : '#1B1717') }}>
                        {data.space.solar_flare}{data.space.flare_intensity}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>SINIFLANDIRMA</div>
                    </div>

                    {/* Risk Level */}
                    <div className="card" style={{ padding: '1.2rem', textAlign: 'center', background: '#ffffff', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>SİSTEM RİSK SEVİYESİ</div>
                      <div style={{ fontSize: '2.5rem', fontWeight: 900, color: data.space.risk_level === "HIGH" ? '#CE1212' : (data.space.risk_level === "MEDIUM" ? '#f59e0b' : '#10b981') }}>
                        {data.space.risk_level}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)' }}>PRD STANDART ANALİZİ</div>
                    </div>
                  </div>

                  {/* Geçmiş Veri Listesi (PRD History requirement) */}
                  <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '1.2rem', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                      <div className="card-title" style={{ fontSize: '0.9rem' }}>Telemetri Geçmişi (Son 50 Veri)</div>
                      <div style={{ fontSize: '0.6rem', background: '#cecbbf', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>REAL-TIME LOG</div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '2px solid #cecbbf' }}>
                            <th style={{ padding: '8px' }}>Zaman</th>
                            <th style={{ padding: '8px' }}>Kp</th>
                            <th style={{ padding: '8px' }}>Flare</th>
                            <th style={{ padding: '8px' }}>Risk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.space.history && [...data.space.history].reverse().map((item, idx) => (
                            <tr
                              key={idx}
                              onClick={() => setSelectedLogItem(item)}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: item.risk_level === 'HIGH' ? '#fff1f2' : 'transparent',
                                cursor: 'pointer',
                                transition: '0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                              onMouseLeave={e => e.currentTarget.style.background = item.risk_level === 'HIGH' ? '#fff1f2' : 'transparent'}
                            >
                              <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{new Date(item.timestamp || item.time).toLocaleTimeString()}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 700 }}>{item.kp_index || item.kp}</td>
                              <td style={{ padding: '6px 8px' }}>{item.solar_flare || item.flare}</td>
                              <td style={{ padding: '6px 8px', fontWeight: 900, color: item.risk_level === 'HIGH' ? '#CE1212' : (item.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981') }}>
                                {item.risk_level || item.risk}
                              </td>
                            </tr>
                          ))}
                          {!data.space.history || data.space.history.length === 0 ? <tr><td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>Henüz veri toplanmadı...</td></tr> : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* SAĞ PANEL: UYARILAR VE AI YORUMU */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card static-card" style={{ background: '#1B1717', color: '#EEEBDD', padding: '1.2rem', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '2px', color: '#f59e0b', marginBottom: '0.8rem' }}>AI STRATEJİK YORUMU</div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5', fontFamily: 'monospace', color: '#38bdf8' }}>{data.space.ai_consensus}</div>
                  </div>

                  <LiveTelemetryStream />

                  <div className="card static-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '1.2rem', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: '#CE1212', marginBottom: '1rem', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <WarningIcon fontSize="small" /> NOAA AKTİF UYARILAR
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
                      {data.space.active_alerts && data.space.active_alerts.map((alert, idx) => (
                        <div key={idx} style={{
                          padding: '10px',
                          background: '#fef2f2',
                          borderRadius: '4px',
                          marginBottom: '8px',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          lineHeight: '1.4'
                        }}>
                          {alert}
                        </div>
                      ))}
                      {(!data.space.active_alerts || data.space.active_alerts.length === 0) && (
                        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', paddingTop: '2rem' }}>
                          Aktif tehlike uyarısı bulunmuyor.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card static-card" style={{ background: '#cecbbf', padding: '1rem', borderRadius: '4px' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#1B1717' }}>SONRAKİ PENCERE TAHMİNİ</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1B1717', marginTop: '4px' }}>{data.space.next_window || "İZLENİYOR"}</div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* HAVA SAHASI VE NOTAM SEKMESİ (Taktik Harita Dahil) */}
          {activeTab === 'airspace' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1.2fr', alignItems: 'center', marginBottom: '1.2rem', gap: '2rem', height: '70px', flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div className="page-subtitle" style={{ color: '#CE1212', fontWeight: 900 }}>HAVA SAHASI RADAR DOMİNASYONU</div>
                  <div className="page-title" style={{ fontSize: '1.5rem', letterSpacing: '-0.5px' }}>Seyrüsefer Güvenlik ve Taktik İzleme</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', paddingRight: '1rem', borderRight: '1px solid #cecbbf' }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, opacity: 0.6 }}>SİSTEM DURUMU</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#10b981' }}>AKTİF TARAMA</div>
                  </div>
                  <button className="btn-primary" onClick={fetchAirspace} disabled={loadingAirspace} style={{ padding: '0 2rem', height: '45px', fontSize: '0.75rem', background: '#1B1717', color: 'white', borderRadius: '4px', border: 'none', fontWeight: 900, letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RefreshIcon fontSize="small" style={{ animation: loadingAirspace ? 'spin 2s linear infinite' : 'none' }} />
                    {loadingAirspace ? "SPEKTRUM TARANIYOR..." : "RADAR VERİSİNİ TAZELE"}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 450px', gap: '1.2rem', flex: 1, overflow: 'hidden' }}>
                {/* SOL: TAKTİK RADAR HARİTASI */}
                <div className="card static-card" style={{ padding: 0, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }}>
                  <div style={{ position: 'absolute', top: 15, left: 15, zIndex: 1000, background: '#1B1717', color: 'white', padding: '0.6rem 1.2rem', fontSize: '0.65rem', fontWeight: 900, letterSpacing: '2px', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', background: '#CE1212', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
                    CANLI TAKTİK TRAFİK MATRİSİ
                  </div>
                  <div style={{ flex: 1 }}>
                    <MapContainer
                      center={[position.lat, position.lon]}
                      zoom={11}
                      zoomControl={false}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <CircleMarker center={[position.lat, position.lon]} radius={10} pathOptions={{ color: '#0f172a', fillColor: '#CE1212', fillOpacity: 1 }}>
                        <Popup><div style={{ fontWeight: 900 }}>FIRLATMA MERKEZİ [L-BASE]</div></Popup>
                      </CircleMarker>
                      <Circle center={[position.lat, position.lon]} radius={10000} pathOptions={{ color: '#CE1212', dashArray: '5, 10', fillOpacity: 0.1 }} />

                      {data.airspace.flights && data.airspace.flights.map((f, i) => (
                        <Marker key={i} position={[f.lat, f.lon]} icon={L.divIcon({
                          className: 'custom-div-icon',
                          html: `<svg width="24" height="24" viewBox="0 0 24 24" fill="#CE1212" style="transform: rotate(45deg); filter: drop-shadow(0px 0px 2px rgba(0,0,0,0.5));"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
                          iconSize: [24, 24]
                        })}>
                          <Popup><div style={{ fontWeight: 900 }}>ÇAĞRI KODU: {f.callsign}</div></Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                </div>

                {/* SAĞ: VERİ AKIŞI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                  <div className="card static-card" style={{
                    background: data.airspace.is_airspace_clear ? '#1B1717' : '#CE1212',
                    color: 'white', padding: '1.2rem', borderRadius: '4px', flexShrink: 0, position: 'relative', overflow: 'hidden'
                  }}>
                    {/* Tarama Çizgisi Efekti */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'rgba(255,255,255,0.2)', animation: 'radarScan 3s linear infinite' }}></div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 900, letterSpacing: '2px', opacity: 0.8 }}>STRATEJİK HAVA SAHASI DURUMU</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '4px' }}>{(data.airspace.status_message || "SİSTEM BAŞLATILIYOR").toUpperCase()}</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '1px', opacity: 0.6 }}>HAVA TRAFİK KİMLİKLENDİRME</div>
                      <div style={{ fontSize: '0.55rem', fontWeight: 900, color: '#CE1212' }}>{data.airspace.flights?.length || 0} HEDEF</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }} className="custom-scroll">
                      {data.airspace.flights && data.airspace.flights.map((f, i) => (
                        <div key={i} className="card static-card" style={{ padding: '0.8rem', background: 'white', borderRadius: '4px', borderLeft: `4px solid ${f.is_conflict ? '#CE1212' : '#10b981'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 900, fontFamily: 'monospace' }}>{f.callsign}</span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#f1f5f9', padding: '2px 6px', borderRadius: '3px' }}>{f.dist}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.4rem' }}>
                            <div style={{ fontSize: '0.55rem', color: '#64748b' }}>İRTİFA: <strong style={{ color: '#1B1717' }}>{f.alt || '34,000 FT'}</strong></div>
                            <div style={{ fontSize: '0.55rem', color: '#64748b' }}>HIZ: <strong style={{ color: '#1B1717' }}>480 KTS</strong></div>
                          </div>
                          <div style={{ fontSize: '0.6rem', color: f.is_conflict ? '#CE1212' : '#10b981', fontWeight: 900, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {f.is_conflict ? <WarningIcon style={{ fontSize: '0.8rem' }} /> : <ShieldIcon style={{ fontSize: '0.8rem' }} />}
                            {f.is_conflict ? `TEHLİKE: ${f.eta_minutes} DK İÇİNDE ETKİ ALANI` : 'SEKTÖR GÜVENLİ - ROTA DIŞI'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card static-card" style={{ padding: '1.2rem', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '4px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, marginBottom: '1rem', color: '#1B1717', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <ArticleIcon fontSize="small" /> STRATEJİK NOTAM ARŞİVİ
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }} className="custom-scroll">
                      {data.airspace.notams && data.airspace.notams.map((n, i) => (
                        <div key={i} style={{ padding: '0.8rem', background: 'white', borderRadius: '4px', marginBottom: '0.6rem', border: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 900, color: '#CE1212', fontSize: '0.8rem', fontFamily: 'monospace' }}>{n.id}</span>
                            <span style={{ fontSize: '0.55rem', padding: '2px 8px', background: n.severity === 'KRİTİK' ? '#CE1212' : '#cecbbf', color: n.severity === 'KRİTİK' ? 'white' : '#1B1717', fontWeight: 900, borderRadius: '30px' }}>{n.severity.toUpperCase()}</span>
                          </div>
                          <div style={{ color: '#1B1717', fontFamily: 'monospace', fontSize: '0.65rem', lineHeight: '1.5', opacity: 0.8 }}>{n.msg}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'rocket' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
              <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1fr', alignItems: 'center', height: '70px', marginBottom: '1.2rem', gap: '2rem', flexShrink: 0 }}>
                <div>
                  <div className="page-subtitle">SİSTEM ENVANTERİ VE GÖREV PLANLAMA</div>
                  <div className="page-title">Fırlatma Aracı ve 3D Gövde Analizi</div>
                </div>

                <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
                  <button
                    onClick={() => setShowRocketList(!showRocketList)}
                    className="btn-primary"
                    style={{
                      padding: '0 2.5rem',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.8rem',
                      background: showRocketList ? '#CE1212' : '#cecbbf',
                      color: showRocketList ? '#ffffff' : '#1B1717',
                      borderRadius: '4px',
                      width: '100%'
                    }}
                  >
                    <span>ENVANTERİ GÖSTER</span>
                    <span style={{ transform: showRocketList ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }}>▼</span>
                  </button>

                  {/* Moved outside the conditional render so onChange works even after dropdown closes */}
                  <input
                    type="file"
                    id="dropdown-ork-upload"
                    accept=".ork"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setUploadingRocket(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch(apiUrl('/upload_ork'), { method: "POST", body: fd });
                        const json = await res.json();
                        if (json.status === "SUCCESS") {
                          const data = json.data;

                          const defaultName = data.name && data.name !== 'İsimsiz Roket' ? data.name : "Test Roketi (Hızlı Görev)";

                          setOrkPendingData({ data: data, defaultName: defaultName });
                          // Modal handleOnSubmit will do the rest!
                        } else {
                          addToast("HATA", "Dosya parse edilemedi.", "danger");
                        }
                      } catch (err) {
                        addToast("HATA", "Sunucu bağlantı hatası. Backend aktif değil.", "danger");
                      }
                      setUploadingRocket(false);
                      e.target.value = null;
                    }}
                  />

                  {showRocketList && (
                    <div style={{ position: 'absolute', top: '110%', right: 0, width: '350px', background: 'white', borderRadius: '4px', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>
                      {rockets.map(r => (
                        <div
                          key={r.id}
                          onClick={() => { setSelectedRocket(r); setShowRocketList(false); }}
                          style={{
                            padding: '1.2rem',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: selectedRocket?.id === r.id ? '#cecbbf' : 'white'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = selectedRocket?.id === r.id ? '#cecbbf' : 'white'}
                        >
                          <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {r.name}
                            {r.isCustom && <span style={{ fontSize: '0.6rem', background: '#CE1212', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>CUSTOM</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{r.class.toUpperCase()}</div>
                        </div>
                      ))}
                      <div
                        onClick={() => { setShowRocketList(false); setIsAddRocketOpen(true); }}
                        style={{ padding: '1.2rem', background: '#1B1717', color: 'white', textAlign: 'center', cursor: 'pointer', fontWeight: 900, transition: '0.2s', fontSize: '0.8rem', letterSpacing: '1px' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#CE1212'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#1B1717'}
                      >
                        + MANUEL ROKET KİMLİĞİ OLUŞTUR
                      </div>

                      {/* QUICK ORK UPLOAD FROM DROPDOWN */}
                      <div
                        onClick={() => { setShowRocketList(false); document.getElementById('dropdown-ork-upload').click(); }}
                        style={{ padding: '1.2rem', background: '#CE1212', color: 'white', textAlign: 'center', cursor: 'pointer', fontWeight: 900, transition: '0.2s', fontSize: '0.8rem', letterSpacing: '1px', borderTop: '1px solid rgba(255,255,255,0.1)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#991b1b'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#CE1212'}
                      >
                        + OPENROCKET DOSYASI İLE OLUŞTUR (.ORK)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1.2fr) 1fr', gap: '2rem', flex: 1 }}>

                {/* SOL TARAF: 3D MODEL RENDER */}
                <div className="card" style={{ padding: 0, height: '700px', background: 'transparent', overflow: 'hidden', borderRadius: '4px', position: 'relative' }}>
                  {selectedRocket ? (
                    (selectedRocket.isCustom && (!selectedRocket.filename || selectedRocket.orkParts)) ? (
                      <BlueprintRenderer parts={selectedRocket.orkParts || []} />
                    ) : (
                      <ErrorBoundary>
                        <Suspense fallback={<div style={{ color: 'var(--primary-blue)', padding: '7rem 2rem', fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center' }}>3D MODEL YÜKLENİYOR...</div>}>
                          <Canvas
                            camera={{ position: [0, 0, 5], fov: 40 }}
                            gl={{ antialias: true }}
                            dpr={[1, 2]}
                          >
                            <Suspense fallback={null}>
                              <Stage environment="city" intensity={0.6} contactShadow={false} adjustCamera={true}>
                                <ModelRenderer key={selectedRocket.modelPath || selectedRocket.filename} url={getRocketModelUrl(selectedRocket)} />
                              </Stage>
                            </Suspense>
                            <OrbitControls makeDefault />
                          </Canvas>
                        </Suspense>
                      </ErrorBoundary>
                    )
                  ) : (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      <div style={{ marginBottom: '2rem', opacity: 0.1 }}>
                        <PublicIcon style={{ fontSize: '5rem' }} />
                      </div>
                      <div style={{ letterSpacing: '5px', fontWeight: 'bold', opacity: 0.3 }}>&lt; LÜTFEN BİRİM SEÇİMİ YAPIN &gt;</div>
                    </div>
                  )}
                </div>

                {/* SAĞ TARAF: BİLGİLENDİRME PANELİ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>

                  {selectedRocket ? (
                    <>
                      {/* Üst Bilgiler - Detaylandırılmış Veri Paneli */}
                      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div className="card-subtitle" style={{ letterSpacing: '2px', color: 'var(--primary-blue)', fontWeight: 'bold', margin: 0 }}>GENİŞLETİLMİŞ SİSTEM DİAGNOSTİK VERİLERİ</div>
                          {selectedRocket.isCustom && (
                            <button
                              onClick={() => {
                                setRockets(prev => prev.filter(r => r.id !== selectedRocket.id));
                                setSelectedRocket(null);
                                addToast('SİLİNDİ', `${selectedRocket.name} envanterden başarılı bir şekilde kalıcı olarak söküldü.`, 'info');
                              }}
                              style={{ background: '#CE1212', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '1px' }}
                            >
                              SİSTEMDEN SİL
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.2rem' }}>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>{selectedRocket.orkParts ? 'MOTOR MİMARİSİ' : 'İTME GÜCÜ'}</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.thrust}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>{selectedRocket.orkParts ? 'KURTARMA SİSTEMİ' : 'YÜK KAPASİTESİ'}</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.payload}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>YÜKSEKLİK</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.height}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>GÖVDE ÇAPI</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.diameter}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>DİZAYN AĞIRLIĞI</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.dry_mass}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>{selectedRocket.orkParts ? 'TOPLAM BİLEŞEN' : 'MENZİL / YÖRÜNGE'}</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.range}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>{selectedRocket.orkParts ? 'AERODİNAMİK' : 'YAKIT TİPİ'}</div>
                            <div className="data-value" style={{ fontSize: '1.1rem', color: '#0f172a', fontWeight: 'bold' }}>{selectedRocket.fuel_type}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>MOTOR SİSTEMİ</div>
                            <div className="data-value" style={{ fontSize: '1.1rem', color: '#0f172a' }}>{selectedRocket.engine}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>BASAMAK SAYISI</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a' }}>{selectedRocket.stages}</div>
                          </div>
                          <div style={{ background: 'var(--bg-app)', padding: '1.1rem', borderRadius: '4px' }}>
                            <div className="data-label" style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>TAHMİNİ MALİYET</div>
                            <div className="data-value" style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 'bold' }}>{selectedRocket.cost}</div>
                          </div>
                        </div>
                      </div>

                      {/* KESİN KARAR MOTORU */}
                      <div className="card" style={{ borderRadius: '4px', padding: '1.5rem', marginBottom: '15rem' }}>
                        <div className="card-subtitle" style={{ letterSpacing: '2px', color: '#CE1212', fontWeight: 'bold', marginBottom: '1rem' }}>TETRATECH KESİN KARAR MOTORU</div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button onClick={() => handleCalculateOptimal(false)} disabled={calculatingOptimal} style={{ flex: 1, padding: '1rem', background: '#CE1212', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', letterSpacing: '1px' }}>
                            <SettingsIcon /> {calculatingOptimal ? 'MOTOR ÇALIŞIYOR...' : 'EN UYGUN FIRLATMA KOŞULLARINI HESAPLA'}
                          </button>
                          {optimalReport && (
                            <button onClick={generateOptimalPDF} style={{ padding: '1rem', background: '#1B1717', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <PictureAsPdfIcon /> PDF AL
                            </button>
                          )}
                        </div>
                        {optimalReport && (
                          <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '4px', borderLeft: '4px solid #10b981', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', animation: 'fadeIn 0.5s' }}>
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.5)', letterSpacing: '1px' }}>ÖNERİLEN ÜS</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1B1717' }}>{optimalReport.base_name} ({optimalReport.score} Puan)</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.5)', letterSpacing: '1px' }}>RÜZGAR LİMİTİ</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981' }}>Maks. {optimalReport.safe_wind} m/s</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.5)', letterSpacing: '1px' }}>İDEAL HAVA ŞARTLARI</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1B1717' }}>Sıcaklık: {optimalReport.req_temp}°C | Basınç: {optimalReport.req_press}hPa</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'rgba(27,23,23,0.5)', letterSpacing: '1px' }}>PERFORMANS GÜCÜ (TWR)</div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1B1717' }}>{optimalReport.twr} Oran</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', borderRadius: '4px', color: 'var(--text-secondary)', padding: '4rem' }}>
                      <div style={{ marginBottom: '1.5rem', opacity: 0.2 }}>
                        <SettingsIcon style={{ fontSize: '4rem' }} />
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>BİRİM VERİSİ EKSİK</div>
                      <div style={{ textAlign: 'center', maxWidth: '300px' }}>Teknik analiz ve 3D hologramı başlatmak için yukarıdaki "BİRİM SEÇ" butonunu kullanın.</div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* GÖREV SİMÜLASYONU SEKMESİ */}
          {activeTab === 'simulation' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              {simStep < 5 && (
                <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1fr', alignItems: 'center', height: '70px', marginBottom: '1.2rem', gap: '2rem', flexShrink: 0 }}>
                  <div>
                    <div className="page-subtitle">GÖREV PLANLAMA VE SİMÜLASYON</div>
                    <div className="page-title" style={{ fontSize: '1.5rem' }}>Fırlatma Penceresi Analizi</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    {[1, 2, 3, 4, 5, 6, 7].map(s => (
                      <div key={s} style={{ width: '12px', height: '12px', borderRadius: '50%', background: simStep >= s ? '#CE1212' : '#cecbbf', transition: '0.3s' }} />
                    ))}
                  </div>
                </div>
              )}

              <div className={simStep < 5 ? "card" : ""} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: simStep < 5 ? '2rem' : '0', borderRadius: '4px', background: simStep >= 5 ? 'transparent' : '' }}>
                {simStep === 1 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>ADIM 1/4</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.3rem' }}>Fırlatma Aracını Seçin</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(27,23,23,0.6)', marginBottom: '2rem' }}>Simülasyon için kullanılacak uzay aracını envantardan seçin.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', overflowY: 'auto', flex: 1 }} className="custom-scroll">
                      {rockets.map(r => (
                        <div key={r.id} onClick={() => setSimRocket(r)} style={{ padding: '1.5rem', borderRadius: '4px', cursor: 'pointer', transition: '0.2s', background: simRocket?.id === r.id ? '#CE1212' : '#cecbbf', color: simRocket?.id === r.id ? 'white' : '#1B1717' }}>
                          <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{r.name}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, marginTop: '0.3rem' }}>{r.class}</div>
                          <div style={{ fontSize: '0.65rem', marginTop: '0.5rem', opacity: 0.7 }}>Payload: {r.payload}</div>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary" disabled={!simRocket} onClick={() => setSimStep(2)} style={{ marginTop: '1.5rem', width: '100%', height: '50px', fontSize: '0.85rem', background: simRocket ? '#1B1717' : '#cecbbf', color: simRocket ? 'white' : '#1B1717', borderRadius: '4px' }}>DEVAM ET →</button>
                  </div>
                )}

                {simStep === 2 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>ADIM 2/4</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.3rem' }}>Fırlatma Üssünü Seçin</div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(27,23,23,0.6)', marginBottom: '2rem' }}>Seçilen araç: <strong>{simRocket?.name}</strong></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }} className="custom-scroll">
                      {spaceports.map((sp, i) => (
                        <div key={i} onClick={() => setSimBase(sp)} style={{ padding: '1.2rem', borderRadius: '4px', cursor: 'pointer', transition: '0.2s', background: simBase?.name === sp.name ? '#CE1212' : '#cecbbf', color: simBase?.name === sp.name ? 'white' : '#1B1717' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 900 }}>{sp.name}</div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.8, marginTop: '0.3rem' }}>{sp.location} — [{sp.lat.toFixed(2)}, {sp.lon.toFixed(2)}]</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                      <button className="btn-primary" onClick={() => setSimStep(1)} style={{ flex: 1, height: '50px', fontSize: '0.85rem', background: '#cecbbf', color: '#1B1717', borderRadius: '4px' }}>← GERİ</button>
                      <button className="btn-primary" disabled={!simBase} onClick={() => setSimStep(3)} style={{ flex: 2, height: '50px', fontSize: '0.85rem', background: simBase ? '#1B1717' : '#cecbbf', color: simBase ? 'white' : '#1B1717', borderRadius: '4px' }}>DEVAM ET →</button>
                    </div>
                  </div>
                )}

                {simStep === 3 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ width: '100%', maxWidth: '500px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '2px', color: 'var(--text-accent)', marginBottom: '0.5rem' }}>ADIM 3/4</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '0.3rem' }}>Fırlatma Zamanını Belirleyin</div>
                      <div style={{ fontSize: '0.85rem', color: 'rgba(27,23,23,0.6)', marginBottom: '2rem' }}>Araç: <strong>{simRocket?.name}</strong> • Üs: <strong>{simBase?.name}</strong></div>
                      <div onClick={() => { setSimLive(!simLive); if (!simLive) { setSimDate('live'); setSimTime(''); } else { setSimDate(''); } }} style={{ padding: '1.5rem', borderRadius: '4px', cursor: 'pointer', marginBottom: '1.5rem', textAlign: 'center', background: simLive ? '#CE1212' : '#cecbbf', color: simLive ? 'white' : '#1B1717', fontWeight: 900, fontSize: '1rem', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
                        {simLive ? <RocketLaunchIcon /> : <RocketLaunchIcon />}
                        {simLive ? 'CANLI MOD AKTİF — ŞİMDİ ANALİZ ET' : 'CANLI SEÇENEK (Anlık Fırlatma)'}
                      </div>
                      {!simLive && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '1px' }}>TARİH</div>
                            <input type="date" value={simDate} onChange={e => setSimDate(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '4px', border: 'none', fontSize: '1rem', fontWeight: 700, background: '#cecbbf', color: '#1B1717' }} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 900, marginBottom: '0.5rem', letterSpacing: '1px' }}>SAAT</div>
                            <input type="time" value={simTime} onChange={e => setSimTime(e.target.value)} style={{ width: '100%', padding: '1rem', borderRadius: '4px', border: 'none', fontSize: '1rem', fontWeight: 700, background: '#cecbbf', color: '#1B1717' }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn-primary" onClick={() => setSimStep(2)} style={{ flex: 1, height: '50px', fontSize: '0.85rem', background: '#cecbbf', color: '#1B1717', borderRadius: '4px' }}>← GERİ</button>
                        <button className="btn-primary" disabled={!simLive && (!simDate || !simTime)} onClick={async () => {
                          setSimLoading(true); setSimStep(4);
                          
                          setSimProgressText('Çevre ve Hava Sahası Analiz Ediliyor...');
                          let currentResult = null;
                          try {
                            let url = apiUrl(`/simulate?lat=${simBase.lat}&lon=${simBase.lon}&date=${simLive ? 'live' : simDate}&time_str=${simLive ? '' : simTime}&rocket_id=${simRocket.isCustom ? 'custom' : simRocket.id}`);
                            if (simRocket.isCustom) {
                              url += `&c_mass=${String(simRocket.dry_mass).replace(/[^0-9.]/g, '') || 1000}&c_tol=${simRocket.windTolerance || 10}&c_eff=${simRocket.efficiency || 0.8}&c_name=${encodeURIComponent(simRocket.name)}`;
                            }
                            const resp = await fetch(url);
                            currentResult = await resp.json();
                            setSimResult(currentResult);

                            if (currentResult && currentResult.status !== 'HATA' && currentResult.status !== 'İPTAL') {
                              const entry = {
                                id: Date.now(),
                                rocket: simRocket.name,
                                baseName: simBase.name,
                                lat: simBase.lat,
                                lon: simBase.lon,
                                date: new Date().toLocaleString('tr-TR'),
                                score: currentResult.topo_stats?.score || 0
                              };
                              const newHistory = [entry, ...taskHistory].slice(0, 20);
                              setTaskHistory(newHistory);
                              localStorage.setItem('tt_task_history', JSON.stringify(newHistory));
                            }
                          } catch (e) { setSimResult({ status: 'HATA', decision: 'Bağlantı hatası', score: 0, risks: [], details: [] }); }

                          setSimProgressText('Fizik ve Balistik Uçuş Modeli Çalıştırılıyor...');
                          try {
                             const windSpd = currentResult?.weather_forecast?.wind_speed || 5;
                             const temp = currentResult?.weather_forecast?.temp || 15;
                             const press = currentResult?.weather_forecast?.pressure || 1013;
                             
                             let defaultParts = [
                                { id: 'stage1', type: 'motor', name: '1. Kademe', dryMass: parseFloat(simRocket.dry_mass) * 0.4 || 120, fuelMass: parseFloat(simRocket.dry_mass) * 1.5 || 400, thrust: parseFloat(simRocket.thrust) || 15000, burnTime: 20, sepAlt: 3000, cd: 0.45, diameter: parseFloat(simRocket.diameter)||0.30 },
                                { id: 'payload', type: 'payload', name: 'Burun Konisi', dryMass: parseFloat(simRocket.payload) || 15, cd: 0.25, diameter: parseFloat(simRocket.diameter)||0.15, fuelMass: 0, thrust: 0, burnTime: 0, sepAlt: 0 }
                             ];
                             const parts = simRocket.orkParts || defaultParts;
                             
                             const simPayload = { windSpeed: parseFloat(windSpd), temperature: parseFloat(temp), pressure: parseFloat(press), parts: parts };
                             const fb = await fetch(simUrl('/simulate'), { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(simPayload)});
                             const rawFlightRes = await fb.json();
                             if(rawFlightRes && rawFlightRes.ozet) {
                               setSimFlightResult({
                                  metrics: {
                                     maxAlt: rawFlightRes.ozet.maks_irtifa_m || 0,
                                     maxVel: rawFlightRes.ozet.maks_hiz_ms || 0,
                                     t: rawFlightRes.ozet.toplam_ucus_suresi_s || 0,
                                     maxQ: (rawFlightRes.ozet.maks_ivme_ms2 || 0) * 100 // mapped as Accel proxy
                                  }
                               });
                             } else {
                               setSimFlightResult(null);
                             }
                          } catch(e) { console.error('Flight sim fail', e); setSimFlightResult(null); }

                          setSimProgressText('Hermes AI ile Enkaz Analizi Hesaplanıyor...');
                          try {
                              const res = await fetch(apiUrl(`/hermes/predict?rocket_model=${encodeURIComponent(simRocket.name)}&lat=${simBase.lat}&lon=${simBase.lon}&azimuth=90`));
                              const data = await res.json();
                              setSimDebrisResult(data);
                          } catch(e) { console.error('Debris sim fail', e); setSimDebrisResult(null); }

                          setSimProgressText('');
                          setSimLoading(false);
                        }} style={{ flex: 2, height: '50px', fontSize: '0.85rem', background: '#CE1212', color: 'white', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.8rem' }}>
                          <RocketLaunchIcon /> SİMÜLE ET
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {simStep === 4 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {simLoading ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <RocketLaunchIcon style={{ fontSize: '4rem', marginBottom: '1.5rem', color: '#CE1212', animation: 'pulse 2s infinite' }} />
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>SİMÜLASYON SUNUCULARI ÇALIŞIYOR...</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(27,23,23,0.6)', marginBottom: '1rem' }}>{simProgressText}</div>
                        <div style={{ width: '200px', height: '4px', background: 'rgba(27,23,23,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                           <div style={{ height: '100%', width: '30%', background: '#CE1212', animation: 'slideRight 1s infinite linear' }} />
                        </div>
                      </div>
                    ) : simResult ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                        <div style={{ width: '100%', maxWidth: '600px', background: '#ffffff', borderRadius: '8px', padding: '3rem', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', borderTop: '6px solid #10b981' }}>
                          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <SettingsIcon style={{ fontSize: '3rem', color: '#10b981' }} />
                          </div>
                          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1B1717', marginBottom: '1rem', letterSpacing: '-0.5px' }}>TÜM SİSTEMLER HAZIR</div>
                          <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, marginBottom: '2.5rem' }}>
                            Taktiksel konumlandırma, uzay hava durumu ve balistik projeksiyon işlemleri tamamlandı. Görevin tam simülasyonuna geçmek için yetkilendirilmiş uçuş onayınızı verin.
                          </div>
                          
                          <button onClick={() => {
                            if (simRocket && simResult) {
                              localStorage.setItem('tt_mission_lock', JSON.stringify({
                                rocket: simRocket,
                                weather: simResult.weather_forecast,
                                base: simBase
                              }));
                              window.dispatchEvent(new Event('storage'));
                              setSimStep(5);
                            }
                          }} style={{ width: '100%', padding: '1.2rem', background: '#CE1212', color: 'white', borderRadius: '4px', fontSize: '1rem', fontWeight: 900, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 8px 15px rgba(206,18,18,0.2)' }}>
                            <RocketLaunchIcon /> UÇUŞ SİMÜLASYONUNA BAŞLA (ADIM 4)
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {simStep === 5 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: '#1B1717', color: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px' }}>
                        <RocketLaunchIcon /> ROKET UÇUŞ FİZİĞİ (ADIM 4/6)
                      </div>
                      <button onClick={() => setSimStep(6)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(16,185,129,0.3)' }}>
                        İLERİ: CANLI ENKAZ HARİTASI <ChevronRightIcon />
                      </button>
                    </div>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
                      <RocketSimPage />
                    </div>
                  </div>
                )}

                {simStep === 6 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ background: '#1B1717', color: 'white', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', fontWeight: 900, letterSpacing: '1px' }}>
                        <MapIcon style={{ color: '#38bdf8' }} /> CANLI ENKAZ TESPİTİ - HERMES (ADIM 5/6)
                      </div>
                      <button onClick={() => setSimStep(7)} style={{ background: '#CE1212', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(206,18,18,0.3)' }}>
                        <DescriptionIcon /> NİHAİ RAPOR VE SONUÇLAR
                      </button>
                    </div>
                    <div style={{ flex: 1, position: 'relative', background: '#0f172a' }}>
                      <MapContainer center={[simBase.lat, simBase.lon]} zoom={7} style={{ height: '100%', width: '100%', background: '#0f172a' }}>
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                        <Marker position={[simBase.lat, simBase.lon]}><Popup>FIRLATMA ÜSSÜ: {simBase.name}</Popup></Marker>
                        
                        {simDebrisResult && simDebrisResult.impact_zones && simDebrisResult.impact_zones.map((zone, i) => (
                          <React.Fragment key={i}>
                            <Marker position={[zone.lat, zone.lon]}>
                              <Popup>
                                <div style={{ fontWeight: 900, fontSize: '0.8rem', color: '#CE1212' }}>[HERMES] TESPİT EDİLEN ENKAZ BÖLGESİ</div>
                                <div style={{ fontSize: '0.7rem' }}>Parça: {zone.name}</div>
                                <div style={{ fontSize: '0.7rem' }}>Tip: {zone.type} / Sürüklenme: {zone.downrange_km} km</div>
                              </Popup>
                            </Marker>
                            <Circle center={[zone.lat, zone.lon]} radius={(zone.msi * 10 * 1000) || 5000} pathOptions={{ color: zone.type === 'UNCONTROLLED' ? '#CE1212' : '#f59e0b', fillColor: zone.type === 'UNCONTROLLED' ? '#CE1212' : '#f59e0b', fillOpacity: 0.15 }} />
                            <Polyline positions={[[simBase.lat, simBase.lon], [zone.lat, zone.lon]]} pathOptions={{ color: '#38bdf8', weight: 1.5, dashArray: '5,5', opacity: 0.5 }} />
                          </React.Fragment>
                        ))}
                      </MapContainer>
                      <div style={{ position: 'absolute', bottom: '30px', right: '30px', zIndex: 1000, background: 'rgba(27,23,23,0.95)', color: 'white', padding: '1.5rem', borderRadius: '4px', minWidth: '320px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '1.2rem' }}>
                            <PublicIcon fontSize="small" /> <span style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '1px' }}>HERMES CANLI ÖLÇÜM AĞI</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Dağılım Kademe Sayısı:</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simDebrisResult?.impact_zones?.length || 0} Adet</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Maksimum Yayılım Çapı:</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#CE1212' }}>{simDebrisResult?.impact_zones ? Math.max(...simDebrisResult.impact_zones.map(z => z.msi * 10 || 1.0)).toFixed(1) : 0} km</span>
                         </div>
                         <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Uzay Aracı Referansı:</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simRocket?.name}</span>
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {simStep === 7 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {simResult ? (
                      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '1rem' }} className="custom-scroll">
                        
                        {/* 1. MASTER KARAR HUD (COMBAT-READY) */}
                        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
                          <div style={{
                            flex: 1,
                            background: Object.values(simResult?.topo_stats || {}).includes('YÜKSEK') ? '#f59e0b' : (simResult.status === 'UYGUN' ? '#10b981' : '#CE1212'),
                            padding: '2rem',
                            borderRadius: '4px',
                            color: 'white',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                            position: 'relative', overflow: 'hidden'
                          }}>
                            <div style={{ position: 'absolute', top: '-10%', right: '-5%', opacity: 0.1, transform: 'rotate(-15deg)' }}>
                              <RocketLaunchIcon style={{ fontSize: '12rem' }} />
                            </div>
                            
                            <div style={{ position: 'relative', zIndex: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 900, opacity: 0.8, letterSpacing: '3px' }}>NİHAİ MASTER KARAR</div>
                                <div style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px', letterSpacing: '1px' }}>TETRATECH CORE AI</div>
                              </div>
                              <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-1px' }}>{simResult?.decision || "ANALİZ HATASI"}</div>
                              <div style={{ marginTop: '1rem', fontSize: '0.85rem', fontWeight: 700, padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '4px', display: 'inline-block' }}>
                                HEDEF ARAÇ: {simResult?.rocket_name || "-"} // {simResult?.target_time || "-"}
                              </div>
                            </div>
                          </div>

                          <div style={{ width: '220px', background: '#1B1717', color: 'white', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#EEEBDD', letterSpacing: '1px', marginBottom: '0.5rem' }}>ÇEVRE GÜVEN SKORU</div>
                            <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
                                <circle cx="50" cy="50" r="45" fill="none" stroke={(simResult?.score || 0) >= 85 ? '#10b981' : ((simResult?.score || 0) >= 60 ? '#f59e0b' : '#CE1212')} strokeWidth="10" strokeDasharray={`${(simResult?.score || 0) * 2.82} 282`} strokeLinecap="round" />
                              </svg>
                              <div style={{ position: 'absolute', fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>%{(simResult?.score || 0)}</div>
                            </div>
                            {(simResult?.wait_minutes || 0) > 0 && (
                              <div style={{ marginTop: '1rem', fontSize: '0.65rem', fontWeight: 900, color: '#CE1212', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                <TimerIcon style={{ fontSize: '1rem' }} /> {simResult.wait_minutes} DK LİMİTLİ
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 2. THREE PILLAR ANALYSIS - ÇEVRE | FİZİK | ENKAZ */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                          
                          {/* PANEL 1: ÇEVRE (ENVIRONMENT) */}
                          <div style={{ background: '#ffffff', border: '1px solid rgba(27,23,23,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ background: 'rgba(27,23,23,0.04)', padding: '0.8rem 1.2rem', borderBottom: '1px solid rgba(27,23,23,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <PublicIcon fontSize="small" style={{ color: '#3b82f6' }} />
                               <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1B1717', letterSpacing: '1px' }}>1. ÇEVRE VE LOKASYON</div>
                            </div>
                            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>HAVA SICAKLIĞI</span>
                                 <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simResult?.weather_forecast?.temp}°C</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>RÜZGAR GÜCÜ</span>
                                 <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simResult?.weather_forecast?.wind_speed} m/s</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>HAVA SAHASI (RİSK)</span>
                                 <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simResult?.topo_stats?.airspace_risk || 'Normal'}</span>
                               </div>
                               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                 <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>YERLEŞİM MESAFESİ</span>
                                 <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simResult?.topo_stats?.residential || 'Bulunmadı'}</span>
                               </div>
                            </div>
                          </div>

                          {/* PANEL 2: FİZİK (PHYSICS) */}
                          <div style={{ background: '#ffffff', border: '1px solid rgba(27,23,23,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ background: '#CE1212', padding: '0.8rem 1.2rem', borderBottom: '1px solid rgba(27,23,23,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <RocketLaunchIcon fontSize="small" style={{ color: '#ffffff' }} />
                               <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#ffffff', letterSpacing: '1px' }}>2. BALİSTİK UÇUŞ FİZİĞİ</div>
                            </div>
                            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                               {simFlightResult && simFlightResult.metrics ? (
                                  <>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>MAKSİMUM İRTİFA</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#CE1212' }}>{Math.round(simFlightResult.metrics.maxAlt).toLocaleString()} m</span>
                                   </div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>MAKSİMUM HIZ</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{Math.round(simFlightResult.metrics.maxVel).toLocaleString()} m/s</span>
                                   </div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>UÇUŞ SÜRESİ</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{Math.round(simFlightResult.metrics.t)} s</span>
                                   </div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>MAKS DİN. BASINÇ (Q)</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{((simFlightResult.metrics.maxQ || 0)/1000).toFixed(1)} kPa</span>
                                   </div>
                                  </>
                               ) : (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>Fizik simülatörüne ulaşılamadı.</div>
                               )}
                            </div>
                          </div>

                          {/* PANEL 3: ENKAZ (DEBRIS) */}
                          <div style={{ background: '#ffffff', border: '1px solid rgba(27,23,23,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ background: 'rgba(27,23,23,0.04)', padding: '0.8rem 1.2rem', borderBottom: '1px solid rgba(27,23,23,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                               <MapIcon fontSize="small" style={{ color: '#10b981' }} />
                               <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1B1717', letterSpacing: '1px' }}>3. HERMES ENKAZ ANALİZİ</div>
                            </div>
                            <div style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                               {simDebrisResult && simDebrisResult.impact_zones && simDebrisResult.impact_zones.length > 0 ? (
                                  <>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>HESAPLANAN KADEME</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{simDebrisResult.impact_zones.length} Parça</span>
                                   </div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>MAKS YAYILIM ÇAPI</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900 }}>{Math.max(...simDebrisResult.impact_zones.map(z => z.msi * 10 || 1.0)).toFixed(1)} km</span>
                                   </div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>ORT. UZAKLIK</span>
                                     <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#10b981' }}>{(simDebrisResult.impact_zones.reduce((a,b)=>a+(b.downrange_km || 0), 0) / simDebrisResult.impact_zones.length).toFixed(1)} km</span>
                                   </div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                     <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b' }}>HERMES DURUMU</span>
                                     <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>BAŞARILI TESPİT</span>
                                   </div>
                                  </>
                               ) : (
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>Enkaz tehlikesi veya analizi yok.</div>
                               )}
                            </div>
                          </div>

                        </div>

                        {/* 3. TESPİT EDİLEN RİSKLER */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1B1717', letterSpacing: '1px' }}>SİSTEMİK RİSK VE HATA MATRİSİ</div>
                            <div style={{ fontSize: '0.6rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontWeight: 900 }}>{simResult?.risks?.length || 0} AKTİF RİSK</div>
                          </div>

                          {simResult?.risks && simResult.risks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                              {(simResult?.risks || []).map((r, i) => (
                                <div key={i} style={{ padding: '1rem', background: r.level === 'KRİTİK' ? '#fef2f2' : (r.level === 'YÜKSEK' ? '#fffbeb' : '#f8fafc'), borderRadius: '4px', borderLeft: `6px solid ${r.level === 'KRİTİK' ? '#CE1212' : (r.level === 'YÜKSEK' ? '#f59e0b' : '#3b82f6')}` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1B1717' }}>{r.type}</span>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 900, color: r.level === 'KRİTİK' ? '#CE1212' : '#f59e0b' }}>[{r.level}]</span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{r.msg}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#10b981', background: '#f0fdf4', borderRadius: '4px' }}>
                              <ShieldIcon style={{ fontSize: '3rem', marginBottom: '0.5rem' }} />
                              <div style={{ fontWeight: 900, fontSize: '0.85rem' }}>TÜM ÇEVRE VE UÇUŞ SİSTEMLERİ NOMİNAL. RİSK TESPİT EDİLMEDİ.</div>
                            </div>
                          )}
                        </div>

                        {/* 4. AKSİYON VE İNDİRME BUTONLARI */}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', marginBottom: '3rem' }}>
                          <button onClick={() => { setSimStep(1); setSimResult(null); setSimFlightResult(null); setSimDebrisResult(null); localStorage.removeItem('tt_mission_lock'); }} style={{ padding: '1rem 2rem', background: '#cecbbf', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#1B1717' }}>
                            <RefreshIcon fontSize="small" /> YENİ GÖREV PLANLA
                          </button>
  
                          <button onClick={() => {
                            if (window.confirm("Bomba seviyesi tüm harita PDF raporu olarak yazdırılsın mı?")) window.print();
                          }} style={{ flex: 1, padding: '1rem', background: 'transparent', color: '#1B1717', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', border: '1px solid #1B1717', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <DescriptionIcon fontSize="small" /> NİHAİ MASTER PDF İNDİR VE YAZDIR
                          </button>

                          <button onClick={() => {
                            // Can either generate PDF from top or query optimal condition.
                            addToast("BİLGİ", "Nihai fırlatma durumu kaydedildi.", "success");
                          }} style={{ flex: 1, padding: '1rem', background: '#1B1717', color: 'white', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <AnalyticsIcon fontSize="small" /> EN UYGUN KOŞULU SORGULA
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bases' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="page-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', height: '70px', marginBottom: '1.2rem', gap: '2rem', flexShrink: 0 }}>
                <div>
                  <div className="page-subtitle">OPERASYONEL LOJİSTİK VE ÜS YÖNETİMİ</div>
                  <div className="page-title" style={{ fontSize: '1.5rem' }}>Stratejik Fırlatma Üsleri Portföyü</div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ textAlign: 'right', fontSize: '0.65rem', fontWeight: 900, opacity: 0.6 }}>
                    TOPLAM KAYIT: {spaceports.length} LOKASYON
                  </div>
                  <button
                    onClick={() => setIsPickMode(true)}
                    style={{ padding: '0 1.5rem', height: '40px', background: '#CE1212', color: 'white', borderRadius: '4px', fontWeight: 900, fontSize: '0.7rem', border: 'none', cursor: 'pointer', transition: '0.2s', letterSpacing: '1px' }}
                  >
                    + KİŞİSEL ÜS EKLE
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', paddingBottom: '2rem' }}>
                  {spaceports.map((sp, i) => (
                    <div key={i} className="card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px' }}>
                        <button
                          onClick={() => {
                            if (window.confirm(`${sp.name} üssünü silmek istediğinize emin misiniz?`)) {
                              setSpaceports(prev => prev.filter((_, idx) => idx !== i));
                              addToast("ÜS SİLİNDİ", `${sp.name} envanterden çıkarıldı.`, 'info');
                            }
                          }}
                          style={{ background: 'rgba(206,18,18,0.1)', color: '#CE1212', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer' }}
                        >
                          SİL
                        </button>
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#CE1212', fontWeight: 900, marginBottom: '0.4rem', letterSpacing: '1.5px' }}>{sp.type || 'STASYON'}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1B1717', marginBottom: '0.3rem' }}>{sp.name}</div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8, color: '#1B1717', marginBottom: '0.8rem' }}>{sp.location}</div>
                      <div style={{ fontSize: '0.7rem', color: '#1B1717', lineHeight: '1.4', background: 'rgba(0,0,0,0.03)', padding: '0.8rem', borderRadius: '4px', flex: 1 }}>
                        {sp.desc}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem' }}>
                        <button
                          className="btn-primary"
                          style={{ flex: 1, height: '35px', fontSize: '0.65rem', background: '#1B1717', color: 'white' }}
                          onClick={() => { setPosition({ lat: parseFloat(sp.lat), lon: parseFloat(sp.lon), lng: parseFloat(sp.lon) }); setActiveTab('map'); }}
                        >
                          KONUMLAN
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isPickMode && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(27,23,23,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                  <div style={{ background: '#EEEBDD', width: '100%', maxWidth: '900px', height: '85vh', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                    <div style={{ padding: '1.5rem', background: '#1B1717', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>YENİ STRATEJİK ÜS TANIMLA</div>
                      </div>
                      <button onClick={() => { setIsPickMode(false); setPickCoord(null); }} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                    </div>

                    <div style={{ flex: 1, position: 'relative' }}>
                      <MapContainer center={[position.lat, position.lon]} zoom={5} style={{ height: '100%', width: '100%' }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapEventsComponent onSelect={(c) => setPickCoord(c)} />
                        {pickCoord && <Marker position={[pickCoord.lat, pickCoord.lng]} />}
                      </MapContainer>
                    </div>

                    <div style={{ padding: '1.5rem', background: '#cecbbf', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 900, display: 'block', marginBottom: '5px' }}>ÜS İSMİ</label>
                        <input id="new-base-name" type="text" placeholder="Örn: Kuzey Ege Fırlatma Rampası" style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '4px', border: 'none', outline: 'none', fontWeight: 700 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 900, display: 'block', marginBottom: '5px' }}>KOORDİNAT</label>
                        <div style={{ height: '40px', background: 'white', display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: '4px', fontWeight: 800, fontSize: '0.8rem' }}>
                          {pickCoord ? `${pickCoord.lat.toFixed(4)}N / ${pickCoord.lng.toFixed(4)}E` : 'HARİTADAN SEÇİN'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const name = document.getElementById('new-base-name').value;
                          if (!name || !pickCoord) return addToast("EKSİK BİLGİ", "Lütfen isim girin ve haritadan konum seçin.", "warning");
                          const newBase = {
                            name: name,
                            location: "Dahili Terminal",
                            lat: pickCoord.lat,
                            lon: pickCoord.lng,
                            desc: "Kullanıcı tarafından manuel olarak eklenen fırlatma lokasyonu.",
                            type: "PRIVATE",
                            isUserAdded: true
                          };
                          setSpaceports(prev => [...prev, newBase]);
                          setIsPickMode(false);
                          setPickCoord(null);
                          addToast("BAŞARILI", `${name} üssü envantere eklendi.`, "success");
                        }}
                        style={{ height: '40px', padding: '0 2rem', background: '#1B1717', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 900, cursor: 'pointer' }}
                      >
                        KONTROLÜ ONAYLA VE EKLE
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CANLI SİMÜLASYON / HERMES ENKAZ DÜŞÜŞ TAHMİNİ */}
          {activeTab === 'debris' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div className="page-header" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 1fr', alignItems: 'center', height: '70px', marginBottom: '1.2rem', gap: '2rem', flexShrink: 0 }}>
                <div>
                  <div className="page-subtitle">HERMES AI ENKAZ DÜŞÜŞ SİSTEMİ</div>
                  <div className="page-title" style={{ fontSize: '1.5rem' }}>Canlı Simülasyon ve Parça Düşüş Analizi</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '1px', color: 'var(--text-secondary)' }}>GEÇMİŞ: {taskHistory.length} SIMÜLASYON</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>

                {/* SOL: HARİTA */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '4px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '1rem 1.5rem', background: '#1B1717', color: 'white', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>ENKAZ DÜŞÜŞ HARİTASI</span>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: 700 }}>Haritaya tıklayarak fırlatma noktası seçin</span>
                      {debrisResult && <span style={{ color: '#4ade80', fontSize: '0.65rem' }}>MOTOR: {debrisResult.method}</span>}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <MapContainer center={[debrisLaunchLat, debrisLaunchLon]} zoom={3} minZoom={2} maxBounds={[[-85, -180], [85, 180]]} maxBoundsViscosity={1.0} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap={true} />
                      <MapEventsComponent onSelect={(c) => { setDebrisLaunchLat(parseFloat(c.lat.toFixed(4))); setDebrisLaunchLon(parseFloat(c.lng.toFixed(4))); setDebrisResult(null); }} />
                      {(!isNaN(debrisLaunchLat) && !isNaN(debrisLaunchLon)) && (
                        <Marker position={[debrisLaunchLat, debrisLaunchLon]}>
                          <Popup><strong>FIRLATMA NOKTASI</strong><br />{debrisLaunchLat.toFixed(4)}N / {debrisLaunchLon.toFixed(4)}E</Popup>
                        </Marker>
                      )}
                      {debrisResult && (
                        <>
                          {Array.isArray(debrisResult.impact_zones) && debrisResult.impact_zones.filter(z => z && !isNaN(z.lat) && !isNaN(z.lon)).map((zone, i) => (
                            <CircleMarker key={i} center={[Number(zone.lat), Number(zone.lon)]} radius={zone.risk_level === 'YUKSEK' ? 14 : zone.risk_level === 'KRITIK' ? 18 : 10} pathOptions={{ color: zone.risk_level === 'YUKSEK' ? '#CE1212' : zone.risk_level === 'KRITIK' ? '#000' : '#f59e0b', fillColor: zone.risk_level === 'YUKSEK' ? '#CE1212' : zone.risk_level === 'KRITIK' ? '#CE1212' : '#22c55e', fillOpacity: 0.5, weight: 2 }}>
                              <Popup>
                                <strong>{zone.stage_num}. Aşama: {zone.name}</strong><br />
                                Menzil: {zone.downrange_km} km<br />
                                Kütle: {zone.mass_kg?.toLocaleString() || '0'} kg<br />
                                Bertaraf: {zone.disposal || 'Bilinmiyor'}<br />
                                Risk: {zone.risk_level || 'Normal'}
                              </Popup>
                            </CircleMarker>
                          ))}
                        </>
                      )}
                    </MapContainer>
                  </div>
                </div>

                {/* SAĞ: KONTROL PANELİ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', minHeight: 0 }} className="custom-scroll">

                  {/* PARAMETRELER */}
                  <div className="card" style={{ borderRadius: '4px', padding: '1.5rem' }}>
                    <div className="card-subtitle" style={{ letterSpacing: '2px', color: 'var(--primary-blue)', fontWeight: 'bold', marginBottom: '1rem' }}>SİMÜLASYON PARAMETRELERİ</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ gridColumn: 'span 2', position: 'relative' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '4px' }}>ROKET MODELİ (HERMES VERİ TABANI)</label>
                        <div
                          onClick={() => setDebrisRocketOpen(!debrisRocketOpen)}
                          style={{ width: '100%', padding: '10px 14px', height: '42px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{debrisSelectedRocket || '-- Roket Seçin --'}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.5, transform: debrisRocketOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
                        </div>
                        {debrisRocketOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 501, background: '#EEEBDD', borderRadius: '0 0 6px 6px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', maxHeight: '280px', overflowY: 'auto', border: '1px solid #cecbbf' }} className="custom-scroll">
                            {debrisRockets.map((r, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setDebrisSelectedRocket(r.name);
                                  setDebrisRocketOpen(false);
                                  addToast('ROKET SEÇİLDİ', `${r.name} simülasyona hazır.`, 'info');
                                }}
                                style={{ padding: '12px 14px', cursor: 'pointer', transition: '0.15s', borderBottom: '1px solid #e8e6de', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: debrisSelectedRocket === r.name ? 'rgba(206,18,18,0.06)' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#e8e6de'}
                                onMouseLeave={e => e.currentTarget.style.background = debrisSelectedRocket === r.name ? 'rgba(206,18,18,0.06)' : 'transparent'}
                              >
                                <div>
                                  <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#1B1717' }}>{r.name}</div>
                                  <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '4px', display: 'flex', gap: '8px' }}>
                                    <span><strong>{r.stages_count}</strong> Aşama</span>
                                    <span>•</span>
                                    <span><strong>{r.flights}</strong> Uçuş</span>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#64748b', letterSpacing: '1px' }}>AI GÜVENİ</div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 900, color: r.confidence === 'YUKSEK' ? '#22c55e' : r.confidence === 'ORTA' ? '#f59e0b' : '#CE1212' }}>{r.confidence}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ gridColumn: 'span 2', position: 'relative' }}>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '4px' }}>FIRLATMA ÜSSELERİ (HIZLI ERİŞİM)</label>
                        <div
                          onClick={() => setDebrisBaseOpen(!debrisBaseOpen)}
                          style={{ width: '100%', padding: '10px 14px', height: '42px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{debrisSelectedBase ? debrisSelectedBase.name : 'Üs Seçin veya Haritadan Tıklayın'}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.5, transform: debrisBaseOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>▼</span>
                        </div>
                        {debrisBaseOpen && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500, background: '#EEEBDD', borderRadius: '0 0 6px 6px', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', maxHeight: '280px', overflowY: 'auto', border: '1px solid #cecbbf' }} className="custom-scroll">
                            {spaceports.map((sp, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setDebrisLaunchLat(sp.lat);
                                  setDebrisLaunchLon(sp.lon);
                                  setDebrisResult(null);
                                  setDebrisSelectedBase(sp);
                                  setDebrisBaseOpen(false);
                                  addToast('ÜS SEÇİLDİ', `${sp.name} koordinatları yüklendi.`, 'info');
                                }}
                                style={{ padding: '10px 14px', cursor: 'pointer', transition: '0.15s', borderBottom: '1px solid #e8e6de', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: debrisSelectedBase?.name === sp.name ? 'rgba(206,18,18,0.06)' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#e8e6de'}
                                onMouseLeave={e => e.currentTarget.style.background = debrisSelectedBase?.name === sp.name ? 'rgba(206,18,18,0.06)' : 'transparent'}
                              >
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1B1717' }}>{sp.name}</div>
                                  <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '2px' }}>{sp.location || 'Koordinat'} — {sp.lat.toFixed(4)}N / {sp.lon.toFixed(4)}E</div>
                                </div>
                                <div style={{ fontSize: '0.55rem', fontWeight: 900, padding: '2px 6px', borderRadius: '3px', background: sp.type === 'PRIVATE' ? '#f59e0b' : '#1B1717', color: 'white', whiteSpace: 'nowrap' }}>
                                  {sp.type === 'PRIVATE' ? 'ÖZEL' : 'RESMİ'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '4px' }}>FIRLATMA ENLEMI</label>
                        <input type="number" step="0.01" value={debrisLaunchLat} onChange={e => setDebrisLaunchLat(Number(e.target.value))} style={{ width: '100%', padding: '10px', height: '42px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '4px' }}>FIRLATMA BOYLAMI</label>
                        <input type="number" step="0.01" value={debrisLaunchLon} onChange={e => setDebrisLaunchLon(Number(e.target.value))} style={{ width: '100%', padding: '10px', height: '42px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '4px' }}>AZİMÜT (derece)</label>
                        <input type="number" step="1" min="0" max="360" value={debrisAzimuth} onChange={e => setDebrisAzimuth(Number(e.target.value))} style={{ width: '100%', padding: '10px', height: '42px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', display: 'block', marginBottom: '4px' }}>&nbsp;</label>
                        <button
                          disabled={!debrisSelectedRocket || debrisLoading}
                          onClick={async () => {
                            setDebrisLoading(true);
                            try {
                              const res = await fetch(apiUrl(`/hermes/predict?rocket_model=${encodeURIComponent(debrisSelectedRocket)}&lat=${debrisLaunchLat}&lon=${debrisLaunchLon}&azimuth=${debrisAzimuth}`));
                              const data = await res.json();
                              if (data.error) { addToast('HATA', data.error, 'warning'); } else {
                                setDebrisResult(data);
                                const count = (data.impact_zones && Array.isArray(data.impact_zones)) ? data.impact_zones.length : 0;
                                addToast('HERMES', `${data.rocket || 'Arac'} için ${count} enkaz bölgesi hesaplandı.`, 'success');
                              }
                            } catch (e) { addToast('HATA', 'HERMES API bağlantısı başarısız.', 'warning'); }
                            setDebrisLoading(false);
                          }}
                          style={{ width: '100%', height: '42px', borderRadius: '4px', border: 'none', background: debrisSelectedRocket ? '#1B1717' : '#cecbbf', color: debrisSelectedRocket ? 'white' : '#1B1717', fontWeight: 900, cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '1px' }}
                        >
                          {debrisLoading ? 'HESAPLANIYOR...' : 'HERMES ANALİZ BAŞLAT'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SONUÇLAR */}
                  {debrisResult && (
                    <div className="card" style={{ borderRadius: '4px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div className="card-subtitle" style={{ letterSpacing: '2px', color: 'var(--primary-blue)', fontWeight: 'bold', margin: 0 }}>AŞAMA BAZLI ENKAZ TAHMİNİ</div>
                        <button
                          onClick={generateDebrisPDF}
                          style={{ padding: '6px 12px', background: '#CE1212', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 900, cursor: 'pointer', fontSize: '0.6rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <ArticleIcon style={{ fontSize: '0.8rem' }} /> RAPOR AL (PDF)
                        </button>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1rem' }}>Roket: <strong>{debrisResult.rocket || '-'}</strong> | Yakıt: {debrisResult.propellant || '-'} | Güven: {debrisResult.confidence || '-'} | Motor: {debrisResult.method || '-'}</div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {Array.isArray(debrisResult.impact_zones) && debrisResult.impact_zones.map((zone, i) => (
                          <div key={i} style={{ padding: '1rem', borderRadius: '4px', background: zone.risk_level === 'YUKSEK' ? 'rgba(206,18,18,0.08)' : zone.risk_level === 'KRITIK' ? 'rgba(206,18,18,0.15)' : 'rgba(34,197,94,0.08)', border: `1px solid ${zone.risk_level === 'YUKSEK' ? '#CE1212' : zone.risk_level === 'KRITIK' ? '#CE1212' : '#22c55e'}22` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>{zone.stage_num}. Aşama: {zone.name}</div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 900, padding: '3px 8px', borderRadius: '3px', background: zone.risk_level === 'YUKSEK' ? '#CE1212' : zone.risk_level === 'KRITIK' ? '#000' : '#22c55e', color: 'white' }}>{zone.risk_level}</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.7rem' }}>
                              <div><span style={{ color: '#64748b' }}>Menzil:</span> <strong>{zone.downrange_km || 0} km</strong></div>
                              <div><span style={{ color: '#64748b' }}>Kütle:</span> <strong>{zone.mass_kg?.toLocaleString() || 0} kg</strong></div>
                              <div><span style={{ color: '#64748b' }}>Bertaraf:</span> <strong>{zone.disposal || '-'}</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* AŞAMA MANİFESTİ */}
                      <div style={{ marginTop: '1.5rem' }}>
                        <div className="card-subtitle" style={{ letterSpacing: '2px', color: 'var(--primary-blue)', fontWeight: 'bold', marginBottom: '0.8rem', fontSize: '0.7rem' }}>AYRILMA MANİFESTİ</div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #cecbbf', textAlign: 'left' }}>
                                <th style={{ padding: '6px', fontWeight: 900 }}>#</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>Aşama</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>İtki (kN)</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>Yakıt (kg)</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>Boş (kg)</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>Yanma (s)</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>Çap (m)</th>
                                <th style={{ padding: '6px', fontWeight: 900 }}>Bertaraf</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.isArray(debrisResult.stages_manifest) && debrisResult.stages_manifest.map((s, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e8e6de' }}>
                                  <td style={{ padding: '6px', fontWeight: 700 }}>{s.stage_num}</td>
                                  <td style={{ padding: '6px' }}>{s.name}</td>
                                  <td style={{ padding: '6px' }}>{s.thrust_kn?.toLocaleString() || '-'}</td>
                                  <td style={{ padding: '6px' }}>{s.propellant_mass_kg?.toLocaleString() || '-'}</td>
                                  <td style={{ padding: '6px' }}>{s.empty_mass_kg?.toLocaleString() || '-'}</td>
                                  <td style={{ padding: '6px' }}>{s.burn_time_s || '-'}</td>
                                  <td style={{ padding: '6px' }}>{s.diameter_m || '-'}</td>
                                  <td style={{ padding: '6px', fontWeight: 700 }}>{s.disposal || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GEÇMİŞ GÖREV SİMÜLASYONLARI */}
                  {taskHistory.length > 0 && (
                    <div className="card" style={{ borderRadius: '4px', padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div className="card-subtitle" style={{ letterSpacing: '2px', color: 'var(--primary-blue)', fontWeight: 'bold', margin: 0 }}>SİMÜLE EDİLMİŞ GÖREVLER (GEÇMİŞ)</div>
                        <button
                          onClick={() => {
                            if (window.confirm("Geçmiş simülasyonları temizlemek istediğinize emin misiniz?")) {
                              setTaskHistory([]);
                              localStorage.removeItem('tt_task_history');
                              addToast('TEMİZLENDİ', 'Görev geçmişi başarıyla silindi.', 'info');
                            }
                          }}
                          style={{ background: 'rgba(206,18,18,0.1)', color: '#CE1212', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900, cursor: 'pointer' }}
                        >
                          TÜMÜNÜ TEMİZLE
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {taskHistory.map((h, i) => (
                          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', borderRadius: '4px', background: i === 0 ? 'rgba(206,18,18,0.06)' : 'var(--bg-app)', cursor: 'pointer', transition: '0.2s' }}
                            onClick={() => {
                              const matchedBase = spaceports.find(sp => Math.abs(sp.lat - h.lat) < 0.001 && Math.abs(sp.lon - h.lon) < 0.001);
                              if (matchedBase) setDebrisSelectedBase(matchedBase);

                              setDebrisSelectedRocket(h.rocket);
                              setDebrisLaunchLat(h.lat);
                              setDebrisLaunchLon(h.lon);
                              setDebrisResult(null);
                              addToast('GÖREV YÜKLENDİ', `${h.baseName} (${h.lat.toFixed(2)}, ${h.lon.toFixed(2)}) merkezine konumlanıldı.`, 'info');
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.8rem' }}>{h.rocket} <span style={{ opacity: 0.5, fontWeight: 400 }}>@ {h.baseName}</span></div>
                              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{h.date} — Başarı: %{h.score}</div>
                            </div>
                            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#64748b' }}>#{i + 1}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {activeTab === 'rocketsim' && (
            <div className="tab-pane fade-in" style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
              <RocketSimPage />
            </div>
          )}

        </main>
      </div>

      {/* YENİ ROKET KİMLİĞİ OLUŞTURMA MODALI */}
      {isAddRocketOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(27,23,23,0.9)', zIndex: 10500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ background: '#EEEBDD', width: '100%', maxWidth: '800px', maxHeight: '90vh', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1.5rem', background: '#1B1717', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}><RocketLaunchIcon /> YENİ ROKET KİMLİĞİ OLUŞTUR</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>Özel sistem ve gövde konfigürasyonunu tanımla.</div>
              </div>
              <button onClick={() => { setIsAddRocketOpen(false); setNewRocketFile(null); }} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', gap: '2rem' }} className="custom-scroll">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1B1717', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      1.A. 3D MODEL (.GLB / .GLTF)
                    </label>
                    <input
                      type="file"
                      accept=".glb,.gltf"
                      onChange={(e) => setNewRocketFile(e.target.files[0])}
                      style={{ width: '100%', padding: '0.8rem', background: 'white', borderRadius: '4px', border: '2px dashed #cecbbf', cursor: 'pointer', outline: 'none', fontSize: '0.75rem' }}
                    />
                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>Görselleştirme için 3D model yükleyin. Dosyalar (*.*) modunu kontrol edin.</div>
                  </div>

                  <div style={{ background: 'rgba(206,18,18,0.05)', padding: '1.5rem', borderRadius: '4px', border: '1px solid rgba(206,18,18,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#CE1212', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      1.B. OPENROCKET (.ORK) YÜKLE
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="file"
                        id="ork-upload"
                        accept=".ork"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setUploadingRocket(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch(apiUrl('/upload_ork'), { method: "POST", body: fd });
                            const json = await res.json();
                            if (json.status === "SUCCESS") {
                              const data = json.data;
                              setNewRocketData(prev => ({
                                ...prev,
                                name: data.name && data.name !== 'İsimsiz Roket' ? data.name : prev.name,
                                height: data.height_m > 0 ? (data.height_m).toFixed(2) + " m" : prev.height,
                                diameter: data.max_diameter_m > 0 ? (data.max_diameter_m).toFixed(2) + " m" : prev.diameter,
                                dry_mass: data.total_mass_kg > 0 ? data.total_mass_kg.toFixed(2) : prev.dry_mass,
                                stages: data.stages > 0 ? String(data.stages) : prev.stages,
                                orkParts: data.parts
                              }));
                              addToast("BAŞARILI", ".ork Dosyası Analizi Tamamlandı ve Parametreler Çekildi.", "success");
                            } else {
                              addToast("HATA", "Dosya parse edilemedi.", "danger");
                            }
                          } catch (err) {
                            addToast("HATA", "Sunucu bağlantı hatası. Backend aktif değil.", "danger");
                          }
                          setUploadingRocket(false);
                          e.target.value = null;
                        }}
                      />
                      <label htmlFor="ork-upload" style={{ flex: 1, textAlign: 'center', padding: '0.8rem', background: '#CE1212', color: 'white', borderRadius: '4px', cursor: 'pointer', fontWeight: 900, fontSize: '0.75rem', transition: '0.2s' }}>
                        + DOSYA SEÇ VE ÇÖZÜMLE
                      </label>
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '6px' }}>Roket verilerini otomatik doldurur ve dikey blueprint oluşturur. Sadece .ork uzantılı dosyaları yükleyin.</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1B1717', display: 'block', marginBottom: '8px', borderBottom: '2px solid #cecbbf', paddingBottom: '5px' }}>2. TEKNİK SİSTEM METRİKLERİ</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>ROKET İSMİ</label>
                    <input type="text" value={newRocketData.name} onChange={e => setNewRocketData({ ...newRocketData, name: e.target.value })} placeholder="Örn: Falcon 9" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>SINIF / KATEGORİ</label>
                    <input type="text" value={newRocketData.class} onChange={e => setNewRocketData({ ...newRocketData, class: e.target.value })} placeholder="Örn: Ağır Yük Taşıyıcı" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>PAYLOAD (YÜK KAPASİTESİ)</label>
                    <input type="text" value={newRocketData.payload} onChange={e => setNewRocketData({ ...newRocketData, payload: e.target.value })} placeholder="Örn: 22.800 KG" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>İTKİ GÜCÜ (THRUST)</label>
                    <input type="text" value={newRocketData.thrust} onChange={e => setNewRocketData({ ...newRocketData, thrust: e.target.value })} placeholder="Örn: 7.600 kN" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>MAX RÜZGAR TOLERANSI (m/s)</label>
                    <input type="number" value={newRocketData.windTolerance} onChange={e => setNewRocketData({ ...newRocketData, windTolerance: Number(e.target.value) })} placeholder="10" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>AĞIRLIK (DRY MASS)</label>
                    <input type="number" value={newRocketData.dry_mass} onChange={e => setNewRocketData({ ...newRocketData, dry_mass: e.target.value })} placeholder="Örn: 549000 (Sadece Rakam)" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>YAKIT TİPİ</label>
                    <input type="text" value={newRocketData.fuel_type} onChange={e => setNewRocketData({ ...newRocketData, fuel_type: e.target.value })} placeholder="Örn: LOX / RP-1" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>MENZİL / YÖRÜNGE</label>
                    <input type="text" value={newRocketData.range} onChange={e => setNewRocketData({ ...newRocketData, range: e.target.value })} placeholder="Örn: LEO / GTO" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>TAHMİNİ MALİYET</label>
                    <input type="text" value={newRocketData.cost} onChange={e => setNewRocketData({ ...newRocketData, cost: e.target.value })} placeholder="Örn: 62 Milyon USD" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b' }}>BOYUTLAR (YÜKSEKLİK / ÇAP)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="text" value={newRocketData.height} onChange={e => setNewRocketData({ ...newRocketData, height: e.target.value })} placeholder="Y: 70 m" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                      <input type="text" value={newRocketData.diameter} onChange={e => setNewRocketData({ ...newRocketData, diameter: e.target.value })} placeholder="Ç: 3.7 m" style={{ width: '100%', padding: '10px', height: '40px', borderRadius: '4px', border: 'none', background: 'white', color: '#1B1717', fontWeight: 700 }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* SAĞ PANEL: BLUPERINT ÖNİZLEME */}
              {newRocketData.orkParts && newRocketData.orkParts.length > 0 && (
                <div style={{ width: '350px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', background: 'white' }}>
                  <div style={{ padding: '10px', background: '#1d4ed8', color: 'white', fontWeight: 900, fontSize: '0.7rem', textAlign: 'center', letterSpacing: '1px' }}>DİKEY BLUEPRINT ÖNİZLEMESİ</div>
                  <BlueprintRenderer parts={newRocketData.orkParts} />
                </div>
              )}
            </div>

            <div style={{ padding: '1.5rem', background: '#cecbbf', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #c2c0b4' }}>
              <button
                disabled={uploadingRocket || !newRocketData.name || (!newRocketFile && !newRocketData.orkParts) || !newRocketData.dry_mass}
                onClick={async () => {
                  setUploadingRocket(true);
                  try {
                    let uploadFileName = null;
                    if (newRocketFile) {
                      const fileExt = newRocketFile.name.split('.').pop();
                      const cleanName = newRocketData.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                      uploadFileName = `custom_${cleanName}_${Date.now()}.${fileExt}`;

                      const uploadFile = new File([newRocketFile], uploadFileName, { type: newRocketFile.type });
                      const formData = new FormData();
                      formData.append("file", uploadFile);

                      const uploadRes = await fetch(apiUrl('/upload_model'), {
                        method: "POST",
                        body: formData
                      });

                      if (!uploadRes.ok) throw new Error("Sunucuya yüklenemedi");
                    }

                    const rocketId = 'custom_' + Date.now();
                    const finalRocket = {
                      ...newRocketData,
                      id: rocketId,
                      filename: uploadFileName,
                      modelPath: uploadFileName ? userModelUrl(uploadFileName) : null,
                      isCustom: true,
                      efficiency: newRocketData.efficiency || 0.8
                    };

                    setRockets(prev => [...prev, finalRocket]);
                    setIsAddRocketOpen(false);
                    setNewRocketFile(null);
                    setNewRocketData({ name: '', class: 'Özel Seri Arac', payload: '', thrust: '', windTolerance: 10, cost: '-', engine: '-', height: '-', diameter: '-', stages: '-', range: '-', dry_mass: '', fuel_type: '-' });

                    addToast("ENVANTER GÜNCELLENDİ", `${newRocketData.name} isimli roket simülasyon sistemine dahil edildi.`, "success");
                  } catch (e) {
                    addToast("HATA", "Model yüklenirken hata oluştu. Lütfen bağlantıyı kontrol edin.", "danger");
                  } finally {
                    setUploadingRocket(false);
                  }
                }}
                style={{ height: '50px', padding: '0 2.5rem', background: (uploadingRocket || !newRocketData.name || (!newRocketFile && !newRocketData.orkParts) || !newRocketData.dry_mass) ? '#a8a29e' : '#CE1212', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 900, cursor: (uploadingRocket || !newRocketData.name || (!newRocketFile && !newRocketData.orkParts) || !newRocketData.dry_mass) ? 'not-allowed' : 'pointer', transition: '0.2s', letterSpacing: '1px' }}
              >
                {uploadingRocket ? "MODEL SUNUCUYA AKTARILIYOR..." : "SİSTEME KAYDET VE ONAYLA"}
              </button>
            </div>
          </div>
        </div>
      )}

      <HistoryGraphModal
        selectedItem={selectedLogItem}
        onClose={() => setSelectedLogItem(null)}
        historyData={data.space.history}
      />

      <NotificationContainer
        alerts={toastAlerts}
        onDismiss={(id) => setToastAlerts(prev => prev.filter(a => a.id !== id))}
      />

      {/* ORK İSİMLENDİRME MODALI */}
      {orkPendingData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(27,23,23,0.85)', backdropFilter: 'blur(5px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card fade-in" style={{ width: '450px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#cecbbf', borderRadius: '4px', border: '1px solid #1B1717', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 900, color: '#CE1212', letterSpacing: '2px', marginBottom: '0.5rem' }}>BİRİM KİMLİĞİ</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1B1717' }}>OpenRocket Görev İsmi</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(27,23,23,0.7)', marginTop: '0.5rem', fontWeight: 700 }}>Sisteme eklenecek olan yeni roket simülasyonu için bir operasyonel atanmış kimlik belirleyin.</div>
            </div>

            <div>
              <input
                type="text"
                id="ork-name-input"
                defaultValue={orkPendingData.defaultName}
                autoFocus
                style={{ width: '100%', padding: '1rem', background: '#ffffff', border: '2px solid rgba(27,23,23,0.2)', borderRadius: '4px', fontSize: '1rem', fontWeight: 900, color: '#CE1212', textAlign: 'center', letterSpacing: '1px', outline: 'none' }}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') document.getElementById('btn-ork-confirm').click();
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => { setOrkPendingData(null); addToast("İPTAL EDİLDİ", "Roket aktarım işlemi iptal edildi.", "info"); }}
                style={{ flex: 1, padding: '1rem', background: 'transparent', color: '#1B1717', borderRadius: '4px', border: '1px solid #1B1717', cursor: 'pointer', fontWeight: 900, transition: '0.2s' }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(27,23,23,0.1)'}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
              >
                İPTAL ET
              </button>
              <button
                id="btn-ork-confirm"
                onClick={() => {
                  const userAssignedName = document.getElementById('ork-name-input').value.trim() || orkPendingData.defaultName;
                  const data = orkPendingData.data;

                  const compCount = data.parts ? data.parts.length : 0;
                  const chutes = data.parts ? data.parts.filter(p => p.tag === 'parachute' || p.tag === 'streamer').length : 0;
                  const engines = data.parts ? data.parts.filter(p => p.tag === 'engineblock' || p.tag === 'innertube').length : 0;
                  const fins = data.parts ? data.parts.filter(p => p.tag.includes('fin')).length : 0;

                  const newRocket = {
                    id: 'ork_fast_' + Date.now(),
                    name: userAssignedName,
                    class: 'Simüle (OpenRocket)',
                    payload: chutes > 0 ? `${chutes} Kurtarma Ünitesi` : 'Kurtarma Sist. Yok',
                    thrust: engines > 0 ? `${engines} İtki Yuvası` : 'Pasif Çekirdek',
                    windTolerance: 15,
                    cost: 'Otomatik Simülasyon',
                    engine: 'ORK-Sıvı/Katı Karma',
                    height: data.height_m > 0 ? (data.height_m).toFixed(2) + " m" : '-',
                    diameter: data.max_diameter_m > 0 ? (data.max_diameter_m).toFixed(2) + " m" : '-',
                    stages: data.stages > 0 ? String(data.stages) : '1',
                    range: `${compCount} Genel Bileşen`,
                    dry_mass: data.total_mass_kg > 0 ? data.total_mass_kg.toFixed(2) : '3000',
                    fuel_type: fins > 0 ? `${fins} Aerodinamik Set` : 'Fin Bulunmuyor',
                    filename: null,
                    orkParts: data.parts,
                    isCustom: true,
                    efficiency: 0.95
                  };

                  setRockets(prev => [...prev, newRocket]);
                  setSelectedRocket(newRocket);
                  addToast("ENVANTER ONAYLANDI", `[${userAssignedName}] başarıyla operasyonel envantere dahil edildi.`, "success");

                  setOrkPendingData(null);
                }}
                style={{ flex: 2, padding: '1rem', background: '#CE1212', color: '#ffffff', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 900, transition: '0.2s', letterSpacing: '1px' }}
                onMouseEnter={(e) => e.target.style.background = '#991b1b'}
                onMouseLeave={(e) => e.target.style.background = '#CE1212'}
              >
                ONAYLA VE AKTAR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App
