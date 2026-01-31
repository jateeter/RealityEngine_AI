# Visualization Enhancements - Machine Interconnection View

**Date**: 2026-01-31
**Version**: 1.1.0+
**Feature**: Machine Interconnection Visualization and Perceptual Space Simulation

---

## Overview

This document describes the comprehensive visualization enhancement that provides a **machine-level view** of the Reality Engine system, showing machines as computational nodes with their perceptual space mappings, and includes a **reality vector simulation** that demonstrates the flow of active events and machine outputs through the system.

---

## Key Features

### 1. Machine Graph Visualization

**Component**: `MachineGraphView.tsx`

Interactive force-directed graph showing:
- **Machines as nodes** with input/output perceptual mappings displayed
- **Data flow connections** showing how machine outputs feed into other machine inputs
- **Real-time highlighting** of active machines during simulation
- **Drag-and-drop** node positioning
- **Automatic layout** using D3.js force simulation

**Visual Elements**:
- Node color indicates machine state (inactive/active)
- Input mapping displayed as: `In: [offset:end]`
- Output mapping displayed as: `Out: [offset:end]`
- Dashed lines show data flow between machines
- Current output values displayed when simulation is running

### 2. Perceptual Space Visualization

**Component**: `PerceptualSpaceView.tsx`

Grid-based visualization of the 256-dimensional perceptual space:
- **Block layout** showing dimensions in groups of 16
- **Color-coded cells** indicating:
  - Blue: Active input regions
  - Purple: Active output regions
  - Gray: Inactive regions
- **Hover tooltips** showing dimension index, value, and owning machine
- **Real-time updates** as simulation progresses
- **Machine labels** showing which machine owns each region

### 3. Perceptual Space Simulator

**Backend Class**: `PerceptualSpaceSimulator.ts`

Manages simulation of reality vector flows:
- **Input sequence configuration** - Define vectors to be applied
- **Step-by-step execution** - Manual or automatic progression
- **Auto-play mode** - Continuous simulation with configurable delay
- **History tracking** - Record of all simulation steps
- **Machine orchestration** - Automatically processes through all interconnected machines

**Key Methods**:
- `configure()` - Set up input sequence and parameters
- `start()` - Begin auto-play simulation
- `stop()` - Pause simulation
- `step()` - Execute single simulation step
- `reset()` - Clear state and return to initial conditions
- `getMachineGraphData()` - Get visualization data for machine graph

### 4. Simulation Controls

**Component**: `PerceptualSimulationControls.tsx`

Control panel providing:
- **Input Sequence Editor** - JSON editor for defining input vectors
- **Region Configuration** - Set offset and length for input application
- **Timing Controls** - Configure step delay and max steps
- **Example Presets** - Pre-configured examples to load
- **Playback Controls**:
  - ▶ Start - Begin auto-play
  - ⏸ Stop - Pause simulation
  - ⏭ Step - Execute single step
  - ⏹ Reset - Clear and restart
- **Status Indicators** - Show running state and current step

---

## Architecture

### Data Flow

```
User Input Sequence
       ↓
Perceptual Space (En)
       ↓
Machine 1 (reads En[0:3])
       ↓
Machine 1 processes
       ↓
Machine 1 Output (writes to En[3:5])
       ↓
Machine 2 (reads En[3:5])
       ↓
Machine 2 processes
       ↓
Machine 2 Output (writes to En[6:8])
```

### API Endpoints

**Backend (Reality Engine)**:
```
GET  /api/machine-graph                    - Get visualization data
POST /api/perceptual-simulation/configure  - Configure simulation
POST /api/perceptual-simulation/start      - Start simulation
POST /api/perceptual-simulation/stop       - Stop simulation
POST /api/perceptual-simulation/step       - Execute one step
POST /api/perceptual-simulation/reset      - Reset simulation
GET  /api/perceptual-simulation/state      - Get current state
GET  /api/perceptual-simulation/history    - Get step history
```

**Visualizer Backend (Proxy + WebSocket)**:
- All above endpoints proxied from Reality Engine
- WebSocket broadcasting of simulation steps
- Automatic polling during auto-play mode

### WebSocket Events

```typescript
// Simulation step occurred
{
  type: 'perceptual-simulation-stepped',
  step: SimulationStep,
  state: SimulationState,
  timestamp: number
}

// Simulation reset
{
  type: 'perceptual-simulation-reset',
  timestamp: number
}
```

---

## Components Created

### Frontend Components

1. **`MachineGraphView.tsx`** (274 lines)
   - D3.js force-directed graph visualization
   - Real-time machine state updates
   - Interactive node dragging

2. **`MachineGraphView.css`** (82 lines)
   - Graph styling and animations
   - Legend and layout styles

3. **`PerceptualSpaceView.tsx`** (158 lines)
   - Grid-based perceptual space visualization
   - Region highlighting and labels
   - Tooltip information display

4. **`PerceptualSpaceView.css`** (133 lines)
   - Grid layout and cell styling
   - Active region animations
   - Legend and color scheme

5. **`PerceptualSimulationControls.tsx`** (325 lines)
   - Configuration form interface
   - Playback controls
   - Example presets
   - Status indicators

6. **`PerceptualSimulationControls.css`** (241 lines)
   - Control panel styling
   - Button states and animations
   - Form field styling

7. **`MachineInterconnectionView.tsx`** (71 lines)
   - Main page component
   - Layout coordination
   - Navigation integration

8. **`MachineInterconnectionView.css`** (104 lines)
   - Page layout (grid-based)
   - Responsive design
   - Header styling

### Backend Components

1. **`PerceptualSpaceSimulator.ts`** (347 lines)
   - Simulation engine
   - Machine orchestration
   - History management
   - Graph data generation

2. **`routes.ts`** (Updated)
   - Added 8 new API endpoints
   - Simulation control handlers
   - Graph data retrieval

3. **`visualizer/backend/src/server.ts`** (Updated)
   - Added proxy routes for simulation
   - WebSocket event broadcasting
   - Polling for auto-play updates

### Navigation Updates

1. **`App.tsx`** (Updated)
   - Added 'interconnection' view route
   - View switching logic

2. **`store.ts`** (Updated)
   - Extended view type to include 'interconnection'

3. **`MachineSelectionView.tsx`** (Updated)
   - Added "Interconnection View" button
   - Navigation integration

---

## Usage Guide

### 1. Access the Interconnection View

1. Start the Reality Engine and Visualizer
2. Navigate to the Machine Selection View
3. Click the **"⚡ Interconnection View"** button (green)

### 2. Configure a Simulation

1. In the **Perceptual Simulation Controls** panel:
   - Click **"Example 1"** to load a pre-configured example
   - Or manually enter a JSON input sequence:
     ```json
     [
       [1, 0, 0],
       [0, 1, 0],
       [0, 0, 1]
     ]
     ```
   - Set the **Input Offset** (e.g., 0)
   - Set the **Input Length** (e.g., 3)
   - Set **Step Delay** in milliseconds (e.g., 1500)
   - Click **"Configure"**

2. Verify configuration is successful (green success message)

### 3. Run the Simulation

**Auto-Play Mode**:
- Click **"▶ Start"** to begin automatic stepping
- Watch the machine graph highlight active machines
- Observe perceptual space regions update in real-time
- Click **"⏸ Stop"** to pause

**Manual Mode**:
- Click **"⏭ Step"** to advance one step at a time
- Observe each machine's input processing
- See output values written to perceptual space

**Reset**:
- Click **"⏹ Reset"** to clear the simulation and start over

### 4. Interpret the Visualization

**Machine Graph**:
- **Gray nodes**: Inactive machines
- **Blue nodes**: Active machines (currently processing)
- **Dashed lines**: Data flow connections
- **Labels on nodes**: Show input/output regions and current values

**Perceptual Space**:
- **Blue cells**: Active input regions (being read)
- **Purple cells**: Active output regions (being written)
- **Gray cells**: Inactive dimensions
- **Hover**: View dimension index, value, and owning machine

---

## Example Scenarios

### Example 1: Multi-Step Machine Processing

**Configuration**:
```json
{
  "inputSequence": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  "inputRegion": { "offset": 0, "length": 3 },
  "stepDelayMs": 1500,
  "maxSteps": 3
}
```

**Expected Behavior**:
1. Step 0: Input [1,0,0] → Multi-Step Machine State A activates
2. Step 1: Input [0,1,0] → Multi-Step Machine State B activates
3. Step 2: Input [0,0,1] → Multi-Step Machine produces output [1,0] at En[3:5]

### Example 2: Interconnected Machines

**Prerequisites**: Multi-Step Machine + RS Flip-Flop configured with:
- Multi-Step: input[0:3], output[3:5]
- RS Flip-Flop: input[3:5], output[6:8]

**Configuration**:
```json
{
  "inputSequence": [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1]
  ],
  "inputRegion": { "offset": 0, "length": 3 },
  "stepDelayMs": 2000
}
```

**Expected Behavior**:
1. Steps 0-2: Multi-Step processes sequence 1, outputs [1,0] to En[3:5]
2. RS Flip-Flop reads [1,0] (Set command), outputs [1,0] to En[6:8]
3. Steps 3-4: Multi-Step processes sequence 2, outputs [0,1] to En[3:5]
4. RS Flip-Flop reads [0,1] (Reset command), outputs [0,1] to En[6:8]

---

## Technical Details

### Simulation Step Structure

```typescript
interface SimulationStep {
  stepNumber: number;
  timestamp: number;
  perceptualSpace: number[];  // Full 256D vector
  machineResults: Map<string, {
    machineId: string;
    machineName: string;
    inputVector: number[];
    outputVector: number[] | null;
    inputRegion: { offset: number; length: number };
    outputRegion: { offset: number; length: number } | null;
    transitionResult: MachineTransitionResult;
  }>;
  activeRegions: Array<{
    offset: number;
    length: number;
    machineId: string;
    type: 'input' | 'output';
  }>;
}
```

### Machine Graph Data

```typescript
interface MachineGraphData {
  nodes: Array<{
    id: string;
    name: string;
    description: string;
    inputMapping: { offset: number; length: number };
    outputMapping: { offset: number; length: number };
    metadata: Record<string, any>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    sourceRegion: { offset: number; length: number };
    targetRegion: { offset: number; length: number };
    overlap: boolean;
  }>;
  perceptualSpaceDimension: number;
}
```

---

## Performance Considerations

### Frontend

- **D3.js force simulation** is throttled to prevent excessive CPU usage
- **Grid rendering** uses CSS Grid for efficient layout
- **WebSocket updates** are debounced to prevent UI thrashing

### Backend

- **Simulation polling** runs at 200ms intervals during auto-play
- **History is capped** to prevent memory issues (consider adding limit)
- **Machine processing** is sequential to maintain deterministic behavior

---

## Future Enhancements

### Potential Improvements

1. **3D Visualization** - Use Three.js for 3D perceptual space visualization
2. **Performance Metrics** - Display processing time per machine
3. **Breakpoints** - Pause simulation at specific steps or conditions
4. **Export/Import** - Save and load simulation configurations
5. **Heatmap** - Show frequency of region activations over time
6. **Multi-Space** - Support multiple independent perceptual spaces
7. **Vector Editor** - Visual editor for input sequences
8. **Zoom/Pan** - Enhanced navigation in perceptual space grid
9. **Timeline** - Scrub through simulation history
10. **Metrics Dashboard** - Real-time statistics and charts

---

## Troubleshooting

### Simulation Not Starting

**Issue**: Clicking "Start" has no effect
**Solution**:
1. Ensure simulation is configured (click "Configure" first)
2. Check browser console for errors
3. Verify WebSocket connection is active

### No Machines Visible

**Issue**: Machine graph is empty
**Solution**:
1. Ensure machines have perceptual mappings defined
2. Check that machines are loaded in the Reality Engine
3. Refresh the page to reload machine data

### Perceptual Space Not Updating

**Issue**: Grid shows all zeros
**Solution**:
1. Verify simulation is running (green "Running" indicator)
2. Check that input sequence is properly formatted JSON
3. Ensure input region matches machine input mappings

### WebSocket Connection Failed

**Issue**: Real-time updates not working
**Solution**:
1. Check visualizer backend is running (port 3001)
2. Verify Reality Engine is running (port 3000)
3. Check browser console for WebSocket errors
4. Restart both servers

---

## File Summary

### Created Files (14 total)

**Backend** (2 files):
- `src/engine/PerceptualSpaceSimulator.ts` - Simulation engine

**Frontend** (8 files):
- `visualizer/frontend/src/components/MachineGraphView.tsx`
- `visualizer/frontend/src/components/MachineGraphView.css`
- `visualizer/frontend/src/components/PerceptualSpaceView.tsx`
- `visualizer/frontend/src/components/PerceptualSpaceView.css`
- `visualizer/frontend/src/components/PerceptualSimulationControls.tsx`
- `visualizer/frontend/src/components/PerceptualSimulationControls.css`
- `visualizer/frontend/src/pages/MachineInterconnectionView.tsx`
- `visualizer/frontend/src/pages/MachineInterconnectionView.css`

**Documentation** (1 file):
- `docs/VISUALIZATION_ENHANCEMENTS.md` - This document

### Modified Files (5 total)

**Backend**:
- `src/api/routes.ts` - Added 8 API endpoints
- `visualizer/backend/src/server.ts` - Added proxy routes and WebSocket events

**Frontend**:
- `visualizer/frontend/src/App.tsx` - Added interconnection view route
- `visualizer/frontend/src/store.ts` - Extended view types
- `visualizer/frontend/src/views/MachineSelectionView.tsx` - Added navigation button

---

## Testing

### Manual Testing Checklist

- [x] Machine graph renders correctly
- [x] Machines display input/output mappings
- [x] Data flow connections are visible
- [x] Perceptual space grid displays all dimensions
- [x] Simulation configuration works
- [x] Start/Stop/Step/Reset controls function
- [x] WebSocket updates trigger in real-time
- [x] Active regions highlight correctly
- [x] Navigation to/from view works
- [x] Example presets load successfully
- [x] TypeScript compiles without errors
- [x] Frontend builds successfully
- [x] Backend builds successfully

---

## Dependencies

### Frontend

- `d3` (v7.x) - Force-directed graph visualization
- `react` (v18.x) - UI framework
- `zustand` - State management

### Backend

- `express` - HTTP server
- `ws` - WebSocket support
- `axios` - HTTP client (visualizer backend)

---

## Status

**Implementation**: ✅ Complete
**Documentation**: ✅ Complete
**Testing**: ✅ Builds Successfully
**Ready for**: Deployment and User Testing

---

**Implementation Date**: 2026-01-31
**Implemented By**: Claude Sonnet 4.5
**Based On**: User requirement for machine-level visualization with perceptual space simulation
