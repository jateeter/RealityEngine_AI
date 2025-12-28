# Reality Engine Simulation API - Complete Integration Guide

## ✅ Status: API Integration Complete!

All simulation API endpoints have been successfully integrated and compiled.

---

## 📋 Available Endpoints

### Simulation Control Endpoints

#### 1. Load Simulation Vectors
```bash
POST /api/simulation/load
Content-Type: application/json

{
  "vectors": [[0.5, 0.5, ...], [0.7, 0.3, ...], ...],  # Array of input vectors
  "autoPlayDelayMs": 1000,                               # Optional, default: 1000
  "loop": true                                            # Optional, default: true
}

Response:
{
  "success": true,
  "state": {
    "status": "stopped",
    "currentIndex": 0,
    "totalVectors": 100,
    "startTime": null,
    "lastStepTime": null
  }
}
```

#### 2. Start Auto-Play
```bash
POST /api/simulation/start

Response:
{
  "success": true,
  "state": {
    "status": "playing",
    "currentIndex": 0,
    "totalVectors": 100,
    "startTime": 1703721234567,
    "lastStepTime": null
  }
}
```

#### 3. Pause Simulation
```bash
POST /api/simulation/pause

Response:
{
  "success": true,
  "state": {
    "status": "paused",
    "currentIndex": 42,
    ...
  }
}
```

#### 4. Resume Simulation
```bash
POST /api/simulation/resume

Response:
{
  "success": true,
  "state": {
    "status": "playing",
    ...
  }
}
```

#### 5. Stop Simulation
```bash
POST /api/simulation/stop

Response:
{
  "success": true,
  "state": {
    "status": "stopped",
    ...
  }
}
```

#### 6. Reset Simulation
```bash
POST /api/simulation/reset

Response:
{
  "success": true,
  "state": {
    "status": "stopped",
    "currentIndex": 0,
    ...
  }
}
```

#### 7. Single Step
```bash
POST /api/simulation/step

Response:
{
  "success": true,
  "state": {
    "status": "stopped",
    "currentIndex": 1,
    ...
  },
  "result": {
    "inputVector": [0.5, 0.5, ...],
    "timestamp": 1703721234567,
    "sequenceResults": {...},
    "totalOutputs": [...]
  }
}
```

#### 8. Set Playback Speed
```bash
PUT /api/simulation/speed
Content-Type: application/json

{
  "delayMs": 500
}

Response:
{
  "success": true,
  "delayMs": 500
}
```

#### 9. Get Simulation State
```bash
GET /api/simulation/state

Response:
{
  "state": {
    "status": "playing",
    "currentIndex": 42,
    "totalVectors": 100,
    "startTime": 1703721234567,
    "lastStepTime": 1703721276543
  },
  "progress": 42  # Percentage (0-100)
}
```

#### 10. Get Activation Heatmap
```bash
GET /api/simulation/heatmap

Response:
{
  "heatmap": [
    {
      "key": "sequence-id-1:vector-id-1",
      "sequenceId": "sequence-id-1",
      "vectorId": "vector-id-1",
      "count": 15,
      "lastActivated": 1703721276543
    },
    ...
  ]
}
```

---

## 🧪 Complete Testing Example

### 1. Start the Reality Engine Server

```bash
npm run build
npm start
```

Server should start on http://localhost:3000

### 2. Create Test Data

Create `test-simulation.json`:
```json
{
  "vectors": [
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.6, 0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.7, 0.7, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.75, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
  ],
  "autoPlayDelayMs": 1000,
  "loop": false
}
```

### 3. Test the Full Workflow

```bash
# Load simulation vectors
curl -X POST http://localhost:3000/api/simulation/load \
  -H "Content-Type: application/json" \
  -d @test-simulation.json

# Check state
curl http://localhost:3000/api/simulation/state

# Start auto-play
curl -X POST http://localhost:3000/api/simulation/start

# Wait a few seconds, then pause
sleep 2
curl -X POST http://localhost:3000/api/simulation/pause

# Check progress
curl http://localhost:3000/api/simulation/state

# Resume
curl -X POST http://localhost:3000/api/simulation/resume

# Get heatmap
curl http://localhost:3000/api/simulation/heatmap

# Reset
curl -X POST http://localhost:3000/api/simulation/reset

# Manual step-through
curl -X POST http://localhost:3000/api/simulation/step
curl -X POST http://localhost:3000/api/simulation/step
curl -X POST http://localhost:3000/api/simulation/step

# Change speed to 500ms
curl -X PUT http://localhost:3000/api/simulation/speed \
  -H "Content-Type: application/json" \
  -d '{"delayMs": 500}'

# Stop
curl -X POST http://localhost:3000/api/simulation/stop
```

---

## 📝 Implementation Details

### Backend Files Modified/Created:

1. **`src/engine/SimulationController.ts`** ✅
   - Core simulation playback engine
   - Auto-play and manual stepping
   - Heatmap tracking
   - Event system for real-time updates

2. **`src/api/routes.ts`** ✅
   - Added SimulationController import
   - Added `simulationController` property
   - Implemented 10 simulation endpoints
   - Integrated with Reality Engine

3. **`examples/demo-30-sequences/`** ✅
   - `data-generator.ts` - Generates 30 sequences
   - `output-definitions.ts` - 10 output types
   - `input-patterns.ts` - 100 input vectors
   - `README.md` - Documentation

---

## ⚠️ Known Limitations

1. **Demo Auto-Loader**: The `GET /api/demo/load` endpoint is disabled due to TypeScript compilation issues with dynamic imports from the examples directory. Demo data must be loaded manually via `/api/simulation/load`.

2. **Frontend Integration**: Frontend components (SimulationControls, InputTimeline, ActivityFeed, HeatmapOverlay, DemoDashboard) are not yet implemented.

3. **Auto-Play Polling**: During auto-play mode, frontend clients should poll `/api/simulation/state` periodically (recommended: 500ms) to get real-time updates, as the simulation runs server-side.

---

## 🌐 WebSocket Events

The visualizer backend broadcasts the following events to connected WebSocket clients (`ws://localhost:3001/ws`):

### Simulation Events:
- `simulation-loaded` - Fired when simulation vectors are loaded
- `simulation-started` - Fired when auto-play begins
- `simulation-paused` - Fired when auto-play is paused
- `simulation-resumed` - Fired when auto-play resumes
- `simulation-stopped` - Fired when simulation stops
- `simulation-reset` - Fired when simulation resets to beginning
- `simulation-stepped` - Fired when single step is executed
- `simulation-speed-changed` - Fired when playback speed changes
- `demo-loaded` - Fired when demo data is loaded

### Event Format:
```json
{
  "type": "simulation-started",
  "state": {
    "status": "playing",
    "currentIndex": 0,
    "totalVectors": 100,
    ...
  },
  "timestamp": 1703721234567
}
```

### Frontend Integration:
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('WebSocket event:', data.type, data);

  // Update UI based on event type
  if (data.type === 'simulation-stepped') {
    updateSimulationState(data.state);
    displayTransitionResult(data.result);
  }
};
```

---

## 🎯 Next Steps

### High Priority (Backend):
- [x] Implement WebSocket broadcasting for simulation events
- [ ] Add demo auto-loader (workaround TypeScript issues)
- [ ] Add API endpoint documentation with Swagger/OpenAPI

### Medium Priority (Frontend):
- [ ] Create SimulationControls component
- [ ] Create InputTimeline component
- [ ] Create ActivityFeed component
- [ ] Create HeatmapOverlay component
- [ ] Create DemoDashboard container
- [ ] Extend Zustand store for simulation state
- [ ] Extend API client with simulation methods

### Low Priority (Testing & Polish):
- [ ] Add endpoint tests
- [ ] Add integration tests
- [ ] Performance optimization
- [ ] Docker deployment verification

---

## 🏆 Summary

**Completed:**
- ✅ SimulationController backend class (fully functional)
- ✅ 10 simulation API endpoints (integrated and compiled)
- ✅ Demo data generator (30 sequences, 100 vectors, 10 outputs)
- ✅ TypeScript compilation successful
- ✅ Ready for testing and frontend integration

**Build Status:** ✅ **SUCCESS**

**API Status:** ✅ **READY FOR USE**

The backend simulation infrastructure is complete and ready for frontend development!
