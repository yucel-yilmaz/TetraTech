# TetraTech Unified Mission Control and Simulation System

TetraTech is a comprehensive aerospace mission planning and simulation dashboard designed to provide end-to-end flight analysis, debris prediction, and environmental risk assessment. The system integrates real-time space weather data, 3D rocket flight physics, and the Hermes AI debris analysis engine to ensure mission safety and strategic decision-making.

## System Architecture

The application is built on a distributed microservices architecture consisting of three primary layers:

1. **Mission Control Interface (Frontend):** A high-fidelity React-based dashboard featuring a 7-step sequential mission wizard, interactive telemetry HUDs, and 3D visualization.
2. **Hermes AI Engine (API Layer):** A Python-based back-end service responsible for climate analysis, NOTAM monitoring, airspace risk assessment, and multi-stage debris footprint prediction.
3. **Flight Physics Engine (Sim Layer):** A dedicated 3D simulation environment using Three.js and Python for high-accuracy trajectory calculation and aerodynamic load analysis.

## Core Features

- **7-Step Mission Pipeline:** Guided workflow including Vehicle Selection, Spaceport Logistics, Temporal Planning, Pre-flight Systems Check, 3D Flight Simulation, Live Debris Mapping (Hermes), and Master Mission Reporting.
- **Hermes Debris Prediction:** Advanced coordinate-based algorithms to predict impact zones of rocket stages with detailed risk level assessments.
- **Real-Time Environment Integration:** Live telemetry for solar storm activity (NOAA Integration), cloud cover, wind speeds, and airspace restrictions.
- **Deterministic 3D Flight Simulation:** Visual and telemetry-based flight tracking with real-time feedback on velocity, altitude, and fuel consumption.
- **Combat-Ready Dashboard:** Tactical UI designed for high-stress decision environments with dark-mode optimization and high-contrast telemetry overlays.

## Prerequisites

- Node.js (v18 or higher)
- Python (3.9 or higher)
- npm or yarn

## Installation

### 1. Repository Setup
Clone the repository and navigate to the project root:
```bash
git clone https://github.com/VstormX16/TetraTech.git
cd TetraTech
```

### 2. Backend Initialization
Install the required Python dependencies for the analysis and simulation services:
```bash
pip install flask flask-cors requests pandas numpy
```

### 3. Frontend Initialization
Navigate to the frontend directory and install the necessary node modules:
```bash
cd frontend
npm install
```

## Running the System

To bring the full suite online, follow the sequence below across separate terminal instances:

### A. Start the Hermes AI API
From the project root:
```bash
python api.py
```
*Service will be active on http://localhost:8010*

### B. Start the Simulation Physics Server
From the root directory:
```bash
cd "Roket Simulasyon Aracı/roketsim-main"
python server.py
```
*Service will be active on http://localhost:5000*

### C. Launch the Mission Control Dashboard
From the frontend directory:
```bash
npm run dev
```
*Application will be accessible via browser at http://localhost:5173*

## Deployment Note

The current version of TetraTech is optimized for local environment integration. Deployment to cloud platforms like Netlify or Render requires the configuration of environment variables to map the dynamic API endpoints and simulation sockets.

## License

All rights reserved. TetraTech Aerospace Systems.
