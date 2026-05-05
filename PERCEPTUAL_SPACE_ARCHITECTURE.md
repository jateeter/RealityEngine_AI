# Perceptual Space Architecture

## Overview

The Reality Engine operates through the **Universal Perceptual Input Space
(En)** - a logical coordinate space representing the complete observable
reality. All machine inputs are sourced from this shared perceptual space,
ensuring consistent, coordinated processing across all machines.

Historically this document described En as a fixed 256-dimensional vector. That
is now only a legacy test assumption. In production, En should be logically
unconstrained with respect to `N`: the active machine universe and registered
Perception Engine sources define the required high-water mark.

## Core Concepts

### Universal Perceptual Space (En)
- **Dynamically sized logical vector** representing complete observable reality
- Shared across all machines in the system
- Each machine perceives a specific region of this space
- Dense vectors are materialized snapshots of the logical space, not the source
  of truth for its size

### Machine Perceptual Mapping
Every machine has a **perceptual mapping** that defines:
- **Input Region**: `{ offset, length }` - Where the machine reads from En
- **Output Region**: `{ offset, length }` - Where the machine writes back to En

Example:
```json
{
  "perceptualMapping": {
    "input": { "offset": 0, "length": 2 },
    "output": { "offset": 10, "length": 4 }
  }
}
```

### Preception Process (Reality Perception)
**Preception** is how machines extract relevant information from the universal space:

1. **Universal Input (En)** → logical reality vector enters the system
2. **Extract Machine Input (Em)** → PreceptionEngine extracts bytes [offset:offset+length]
3. **Process** → Machine processes its specific input slice
4. **Merge Output (Ox)** → Machine output merged back into En at output offset

## Vector Management Philosophy

The perceptual space must grow from the active machine/source registry rather
than from a static deployment setting.

- Adding a machine can extend En when its input or output mapping exceeds the
  current high-water mark.
- Removing a machine releases its region reservations but should not shrink live
  state automatically.
- Repacking is an explicit maintenance operation that preserves all intentional
  output-to-input overlaps and emits a coordinate migration map.
- Runtime reality vectors must not be truncated to a configured dimension.
  Shorter inputs are zero-filled to the required logical dimension.
- Semantic embedding vectors used by localAIStack/Ollama are separate from
  Reality Engine operational vectors. They may share physical Qdrant
  infrastructure, but they must use separate collections and lifecycle rules.

Recommended implementation:

1. Add a vector-space registry that records machine input/output reservations
   and Perception Engine source reservations.
2. Derive `requiredDimension = max(offset + length)` from that registry.
3. Treat `VECTOR_DIMENSION` as a compatibility floor:
   `runtimeDimension = max(configuredDimension, requiredDimension)`.
4. Grow `PerceptualSpace`, `PreceptionEngine`, simulator state, and PE
   persistent vectors when the registry high-water mark increases.
5. Persist operational vectors as sparse region updates or versioned dense
   snapshots outside localAIStack embedding collections.

## Architecture Components

### 1. PerceptualSpace Model
`src/models/PerceptualSpace.ts`

Core data structure managing the 256-dimensional reality vector:
```typescript
class PerceptualSpace {
  extractMachineInput(mapping: PerceptualMapping): number[]
  mergeMachineOutput(output: number[], mapping: PerceptualMapping): void
  updateRegion(offset: number, values: number[]): void
}
```

### 2. PreceptionEngine
`src/engine/PreceptionEngine.ts`

Resolves universal space to machine-specific inputs:
```typescript
class PreceptionEngine {
  resolveInputEventVector(universalInputSpace: number[],
                         perceptualMapping: PerceptualMapping): number[]

  resolveInputsForMachines(universalInputSpace: number[],
                          machines: Map<string, Machine>): Map<string, number[]>
}
```

### 3. PerceptualSpaceSimulator
`src/engine/PerceptualSpaceSimulator.ts`

Orchestrates multi-machine simulations through perceptual space:
- Maintains shared 256D perceptual space
- Processes universal input sequences
- Extracts machine-specific inputs via perceptual mappings
- Merges machine outputs back to perceptual space
- Tracks simulation history with full perceptual state

```typescript
class PerceptualSpaceSimulator {
  configure(config: {
    inputSequence: number[][];  // Universal 256-byte vectors
    inputRegion: { offset, length };  // Where to apply inputs in En
    stepDelayMs: number;
  })

  step(): SimulationStep  // Execute one reality cycle
  start(): void  // Auto-play simulation
  getMachineGraphData(): GraphData  // Visualization data
}
```

### 4. RealityEngine Integration
`src/engine/RealityEngine.ts`

Updated with perceptual space processing methods:
```typescript
class RealityEngine {
  // Process universal input through specific machine
  processUniversalInput(universalInputSpace: number[],
                       machineId: string): MachineTransitionResult

  // Process universal input through ALL machines
  processUniversalInputForAllMachines(universalInputSpace: number[]):
    Map<string, MachineTransitionResult>

  // Get preception diagnostic for visualization
  getPreceptionDiagnostic(universalInputSpace: number[]): DiagnosticMapping
}
```

### 5. Updated SimulationController
`src/engine/SimulationController.ts`

Now supports perceptual space mode:
```typescript
interface SimulationConfig {
  inputVectors: number[][];
  machineId?: string;  // Machine to process through
  usePerceptualSpace?: boolean;  // Enable perceptual processing
  autoPlayDelayMs: number;
  loop: boolean;
}
```

When `usePerceptualSpace: true`:
- `inputVectors` are treated as universal 256-byte vectors
- Inputs processed via `engine.processUniversalInput()`
- PreceptionEngine extracts machine-specific slices

## Machine Registration

All machines are now registered with BOTH systems:

### API Routes Helper Method
`src/api/routes.ts`

```typescript
private addMachineToSystem(machine: Machine): void {
  // Add to RealityEngine (always)
  this.engine.addMachine(machine);

  // Add to PerceptualSpaceSimulator (if has perceptual mapping)
  if (machine.perceptualMapping) {
    this.perceptualSimulator.addMachine(machine);
  }
}
```

Used when:
- Loading machines from JSON files
- Importing machine JSON from frontend
- Creating new machines via API

### Machine Metadata
All machines expose their perceptual mapping in:
- `machine.perceptualMapping` property
- `machine.toJSON()` output
- API responses
- Frontend visualization tooltips

## Simulation Workflows

### Single-Machine Simulation (Legacy-Compatible)
```typescript
// Load machine-specific test inputs
const machineInputs = [[1, 0], [0, 1]];  // 2D vectors for RSFlipFlop

// Convert to universal space
const universalInputs = convertToUniversalInputs(machineInputs, machine);
// Result: [[1,0,0,...,0], [0,1,0,...,0]]  // 256D with values at offset

// Create simulation
const sim = new SimulationController(engine, {
  inputVectors: universalInputs,
  machineId: machine.id,
  usePerceptualSpace: true,
  autoPlayDelayMs: 1000,
  loop: true
});

sim.start();  // Processes through perceptual space
```

### Multi-Machine Perceptual Simulation
```typescript
// Add machines to simulator
perceptualSimulator.addMachine(machineA);  // input[0:2], output[10:14]
perceptualSimulator.addMachine(machineB);  // input[12:15], output[20:22]

// Configure with universal input sequence
perceptualSimulator.configure({
  inputSequence: [
    [0.5, 0.3, 0, ...],  // 256-byte universal vectors
    [0.8, 0.1, 0, ...],
    [0.2, 0.9, 0, ...]
  ],
  inputRegion: { offset: 0, length: 16 },  // Apply to first 16 bytes
  stepDelayMs: 1000
});

// Run simulation
perceptualSimulator.start();

// Each step:
// 1. Apply next universal vector to En
// 2. Extract machineA input from En[0:2]
// 3. Process machineA, merge output to En[10:14]
// 4. Extract machineB input from En[12:15] (reads machineA's output!)
// 5. Process machineB, merge output to En[20:22]
// 6. Record full perceptual state in history
```

## Machine Interconnection

Machines connect through overlapping perceptual regions:

### Output-to-Input Flow
```
Machine A: output[10:14]
           ↓ (overlap)
Machine B: input[12:15]
```

Machine B's input region overlaps with Machine A's output region, creating a **data flow** from A → B through the perceptual space.

### Visualization
The frontend Machine Interconnection Graph shows:
- Nodes: Machines with their perceptual regions
- Edges: Data flows where output regions overlap with input regions
- Colors: Machine status (idle/processing/active)
- Tooltips: Full perceptual mapping metadata
- Real-time: Updates as simulation runs

## API Endpoints

### Perceptual Simulation
```
POST /api/perceptual-simulation/configure
  Body: { inputSequence, inputRegion, stepDelayMs, maxSteps }

POST /api/perceptual-simulation/start
  Start auto-play simulation

POST /api/perceptual-simulation/step
  Execute single step

POST /api/perceptual-simulation/stop
  Stop simulation

POST /api/perceptual-simulation/reset
  Reset perceptual space and history

GET /api/perceptual-simulation/state
  Get current state

GET /api/perceptual-simulation/history
  Get full simulation history
```

### Machine Graph
```
GET /api/machine-graph
  Returns graph data for visualization:
  - nodes: machines with perceptual mappings
  - edges: connections between machines
  - perceptualSpaceDimension: 256
```

### Universal Input Processing
```
POST /api/machines/:id/process-universal
  Body: { universalInputSpace: number[256] }
  Process universal input through specific machine

POST /api/machines/process-universal/all
  Body: { universalInputSpace: number[256] }
  Process universal input through ALL machines

POST /api/preception/diagnostic
  Body: { universalInputSpace: number[256] }
  Get diagnostic mapping for visualization
```

## Machine JSON Format

All machine JSON files should include perceptual mappings:

```json
{
  "version": "1.0.0",
  "machine": {
    "name": "RSFlipFlop",
    "description": "RS Flip-Flop state machine",
    "arbiterRule": "PASSTHROUGH",
    "perceptualMapping": {
      "input": { "offset": 0, "length": 2 },
      "output": { "offset": 10, "length": 4 }
    },
    "sequences": [...],
    "inputSequences": [
      {
        "name": "SET Operation",
        "description": "Test sequence",
        "vectors": [
          [0, 0],  // Machine-specific 2D vectors
          [1, 0]   // Converted to universal 256D at runtime
        ]
      }
    ]
  }
}
```

Note: `inputSequences` contain machine-specific vectors that are automatically converted to universal 256-byte vectors when loaded for simulation.

## Frontend Visualization

### Machine Interconnection Graph
`visualizer/frontend/src/components/MachineInterconnectionGraph.tsx`

Features:
- **Full-container responsive D3.js visualization**
- **Real-time WebSocket updates** from perceptual simulations
- **Enhanced tooltips** showing:
  - Machine name, status, description
  - Input region: `[offset:offset+length]`
  - Output region: `[offset:offset+length]`
  - Last input/output vectors
  - Metadata
- **Status indicators**:
  - Green: Active (producing output)
  - Yellow: Processing (received input)
  - Blue: Current machine
  - Gray: Idle/connected
- **Perceptual Space Status** display:
  - Current step number
  - Dimensionality (256D)
  - Non-zero element count
- **Legend** with all status types and data flow arrows

## Benefits of Perceptual Space Architecture

### 1. Single Source of Truth
- All machines read from and write to the same 256D space
- No ambiguity about data flow
- Consistent state across all machines

### 2. Explicit Interconnection
- Machine connections defined by perceptual mappings
- Easy to visualize and understand data flows
- No hidden dependencies

### 3. Scalable Reality Processing
- Add machines without modifying existing ones
- Machines compose naturally through region overlap
- Clear separation of concerns

### 4. Simulation Consistency
- All simulations driven by universal input streams
- Easy to replay and debug
- Complete simulation history with perceptual states

### 5. Visualization Clarity
- Machine graph directly reflects perceptual architecture
- Real-time updates show perceptual state changes
- Tooltips expose complete perceptual metadata

## Migration from Direct Inputs

### Before (Legacy)
```typescript
// Machine-specific inputs
const result = machine.processInput([1, 0]);
```

### After (Perceptual Space)
```typescript
// Universal input space
const universalInput = new Array(256).fill(0);
universalInput[0] = 1;  // Set at machine's input offset
universalInput[1] = 0;

const result = engine.processUniversalInput(universalInput, machine.id);
```

Or use helper:
```typescript
const universalInputs = convertToUniversalInputs(
  [[1, 0], [0, 1]],  // Machine-specific
  machine            // Has perceptual mapping
);
// Returns: [[1,0,0,...], [0,1,0,...]]  (256D vectors)
```

## Testing

All tests pass with perceptual space architecture:
- ✅ 100/100 tests passing
- ✅ PreceptionEngine test suite (37 tests)
- ✅ PerceptualSpace test suite
- ✅ RealityEngine integration tests
- ✅ End-to-end simulation tests

## Status

✅ **Complete and Production-Ready**
- All machines registered with both RealityEngine and PerceptualSpaceSimulator
- SimulationController supports perceptual space mode
- Frontend displays full perceptual mapping metadata
- Real-time visualization of perceptual state
- All tests passing
- Documentation complete

## Next Steps

1. **Update Machine JSON Files** - Add perceptual mappings to any machines that don't have them
2. **Convert Input Sequences** - Optionally convert inputSequences to full 256D universal vectors for maximum clarity
3. **Create New Machines** - All new machines should include perceptual mappings from the start
4. **Monitor Simulations** - Use the Machine Interconnection Graph to visualize perceptual flows in real-time

## Summary

The Reality Engine now operates entirely through the **Universal Perceptual Input Space**, ensuring all machine inputs are sourced from the shared 256-dimensional reality vector. This architectural improvement provides:

- ✅ **Consistent preception** across all machines
- ✅ **Explicit interconnection** via perceptual mappings
- ✅ **Real-time visualization** of perceptual state
- ✅ **Scalable composition** of machine networks
- ✅ **Complete simulation history** with full perceptual context

All simulations are now driven by universal perceptual input vector streams, with each machine perceiving and affecting its designated region of the shared reality space.
