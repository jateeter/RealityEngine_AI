# Reality Engine 30-Sequence Demonstration

## Overview

This demonstration showcases the Reality Engine's capabilities with:
- **30 independent critical event sequences** across 7 categories
- **30+ initial reality vectors** (at least one per sequence)
- **10 unique output reality vectors** (SYSTEM_HEALTHY, NORMAL_OPERATION, WARNING_ALERT, CRITICAL_ALERT, EMERGENCY, OPTIMIZATION_TRIGGER, MAINTENANCE_REQUIRED, EFFICIENCY_BOOST, RESOURCE_SHORTAGE, ANOMALY_DETECTED)
- **100 input reality vectors** for simulation
- **Dual-mode playback**: Auto-play and manual step-through
- **Enhanced visualization**: Timeline, activity feed, heatmap overlay

## Quick Start

### 1. Run the Demo Script

```bash
cd examples/demo-30-sequences
npx ts-node run-demo.ts
```

### 2. Load Demo via API

```bash
# Start the Reality Engine server
npm start

# In another terminal, load the demo
curl -X GET http://localhost:3000/api/demo/load
```

### 3. Access the Visualizer

Open your browser to:
```
http://localhost:5173
```

Click "Load Demo" button in the sidebar to initialize the 30-sequence demonstration.

## Sequence Categories

### 1. Environmental Monitoring (5 sequences)
- Building Climate Control
- Weather Station Monitoring
- Air Quality Monitor
- Energy Consumption Monitor
- Water Quality System

### 2. Industrial Process Control (5 sequences)
- Manufacturing Line Monitor
- Chemical Process Control
- Equipment Monitor
- Supply Chain Tracker
- Bottleneck Detection

### 3. Healthcare & Biometrics (4 sequences)
- Vital Signs Monitor
- Outbreak Detection System
- Medical Equipment Alert
- Treatment Progress Tracker

### 4. Security & Access Control (4 sequences)
- Multi-Zone Security System
- Access Pattern Analyzer
- Intrusion Detection System
- Network Security Monitor

### 5. Financial & Trading (4 sequences)
- Market Volatility Detector
- Fraud Detection System
- Trading Signal Generator
- Portfolio Risk Monitor

### 6. Smart City Infrastructure (4 sequences)
- Traffic Flow Optimizer
- Public Transport Monitor
- Utility Grid Manager
- Emergency Dispatch System

### 7. Communication & Network (4 sequences)
- Network Congestion Monitor
- Service Degradation Detector
- Bandwidth Optimizer
- Latency Spike Monitor

## Input Vector Distribution

The 100 input vectors are distributed as follows:
- **30 Normal Operation** (vectors 1-30): Baseline healthy system states
- **25 Warning Conditions** (vectors 31-55): Elevated but manageable issues
- **15 Critical Conditions** (vectors 56-70): Serious issues requiring attention
- **10 Optimization Opportunities** (vectors 71-80): Efficiency improvement potential
- **10 Maintenance Required** (vectors 81-90): Wear and tear indicators
- **5 Emergency** (vectors 91-95): Critical failures
- **5 Anomaly** (vectors 96-100): Unusual patterns

## Output Vectors

Each sequence generates one or more of these 10 output types:

| Output Type | Vector | Severity | Description |
|------------|--------|----------|-------------|
| SYSTEM_HEALTHY | [1.0, 0, 0, 0, 0, 0, 0, 0, 0, 0] | Success | Normal parameters |
| NORMAL_OPERATION | [0.9, 0.1, 0, 0, 0, 0, 0, 0, 0, 0] | Info | Normal state |
| WARNING_ALERT | [0, 1.0, 0, 0, 0, 0, 0, 0, 0, 0] | Warning | Attention recommended |
| CRITICAL_ALERT | [0, 0, 1.0, 0, 0, 0, 0, 0, 0, 0] | Error | Immediate action required |
| EMERGENCY | [0, 0, 0, 1.0, 0, 0, 0, 0, 0, 0] | Critical | Critical intervention needed |
| OPTIMIZATION_TRIGGER | [0, 0, 0, 0, 1.0, 0, 0, 0, 0, 0] | Info | Optimization opportunity |
| MAINTENANCE_REQUIRED | [0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0] | Warning | Maintenance needed |
| EFFICIENCY_BOOST | [0, 0, 0, 0, 0, 0, 1.0, 0, 0, 0] | Success | Efficiency improved |
| RESOURCE_SHORTAGE | [0, 0, 0, 0, 0, 0, 0, 1.0, 0, 0] | Warning | Resource shortage |
| ANOMALY_DETECTED | [0, 0, 0, 0, 0, 0, 0, 0, 1.0, 0] | Warning | Unusual pattern |

## API Endpoints

### Simulation Control

```bash
# Start auto-play
curl -X POST http://localhost:3000/api/simulation/start

# Pause
curl -X POST http://localhost:3000/api/simulation/pause

# Resume
curl -X POST http://localhost:3000/api/simulation/resume

# Stop
curl -X POST http://localhost:3000/api/simulation/stop

# Reset
curl -X POST http://localhost:3000/api/simulation/reset

# Single step
curl -X POST http://localhost:3000/api/simulation/step

# Set speed (ms between steps)
curl -X PUT http://localhost:3000/api/simulation/speed \
  -H "Content-Type: application/json" \
  -d '{"delayMs": 500}'

# Get state
curl http://localhost:3000/api/simulation/state

# Get heatmap
curl http://localhost:3000/api/simulation/heatmap
```

## Files

- `data-generator.ts` - Main generator creating 30 sequences and 100 inputs
- `output-definitions.ts` - 10 output vector definitions
- `input-patterns.ts` - Input vector pattern generators
- `README.md` - This file

## Implementation Status

✅ **Completed:**
- Data generator with 30 sequences
- Output definitions (10 vectors)
- Input pattern generators (100 vectors)
- SimulationController backend class

🚧 **In Progress:**
- API endpoint integration
- Frontend visualization components
- WebSocket broadcasting
- Demo dashboard integration

## Next Steps

To complete the full implementation:

1. Add simulation endpoints to `/src/api/routes.ts`
2. Create frontend components (SimulationControls, InputTimeline, ActivityFeed, HeatmapOverlay)
3. Extend Zustand store with simulation state
4. Update visualizer backend for WebSocket broadcasting
5. Integrate DemoDashboard into App.tsx
6. Test end-to-end functionality

## Architecture

```
100 Input Vectors
       ↓
SimulationController (auto-play / manual step)
       ↓
RealityEngine.processInput()
       ↓
30 CriticalEventSequences (parallel processing)
       ↓
Vector matching & transitions
       ↓
10 Output Vector types
       ↓
WebSocket broadcast to frontend
       ↓
Visualizer UI (timeline, activity feed, heatmap)
```

## Performance

- **Vector Dimension**: 12D (balanced complexity/visualization)
- **Sequences**: 30 independent sequences
- **Total Vectors**: ~50-80 vectors (varies by sequence complexity)
- **Processing Speed**: <50ms per step (target)
- **Playback Speed**: Configurable 100ms - 5000ms

## License

MIT
