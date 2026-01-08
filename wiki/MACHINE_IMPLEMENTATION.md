# Machine Implementation - Complete Guide

**Date:** 2026-01-01

## Overview

Implemented the **Machine** concept to group multiple Critical Event Sequences into a unified system. Machines enable:
- Viewing all sequences together in a single visualization
- Running input sequences through multiple related sequences simultaneously
- Conceptual grouping of sequences that work together as a system

---

## What is a Machine?

A **Machine** is a logical container that groups Critical Event Sequences into a cohesive unit:

```
Machine: "Multi-Step State Machine"
├── Sequence 1: 000 → 001 → 011 → [01]
└── Sequence 2: 100 → 101 → 111 → [10]
```

All sequences in a Machine:
- Are visualized together on the same graph
- Process the same input sequence simultaneously
- Can have different outputs and independent state transitions
- Operate as a unified system conceptually

---

## Implementation Details

### Backend Components

#### 1. Machine Model (`/src/models/Machine.ts`)

```typescript
class Machine {
  id: string;                           // Unique machine identifier
  name: string;                         // Machine name
  description: string;                  // Machine description
  sequences: Map<string, CriticalEventSequence>;  // Contained sequences
  metadata: Record<string, any>;        // Additional metadata

  addSequence(sequence: CriticalEventSequence): void
  removeSequence(sequenceId: string): boolean
  getSequence(sequenceId: string): CriticalEventSequence | undefined
  getAllSequences(): CriticalEventSequence[]
  getSequenceCount(): number
  getTotalVectorCount(): number
  toJSON(): Record<string, any>
}
```

#### 2. RealityEngine Integration

Extended `RealityEngine` with Machine support:

```typescript
// New methods
addMachine(machine: Machine): void
removeMachine(machineId: string): boolean
getMachine(machineId: string): Machine | undefined
getAllMachines(): Machine[]
```

**Behavior:**
- `addMachine()` automatically adds all sequences from the machine to the engine
- `removeMachine()` removes the machine and all its sequences
- Sequences can be processed individually or as part of a machine

#### 3. Multi-Step Example Machine

**File:** `/src/examples/multi-step-sequences/sequence-definitions.ts`

```typescript
export function createMultiStepMachine(): Machine {
  const machine = new Machine(
    'Multi-Step State Machine',
    'Demonstrates 3-step critical event sequences...',
    {
      eventSpace: '3D binary vectors: 000-111',
      outputSpace: '2D binary vectors: {00, 01, 10, 11}',
      sequenceCount: 2,
      inputVectorCount: 11,
      sequences: [
        { name: 'Sequence 1', path: '000→001→011', output: '[0,1]' },
        { name: 'Sequence 2', path: '100→101→111', output: '[1,0]' }
      ]
    }
  );

  // Add sequences to machine
  const sequences = createMultiStepSequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}
```

#### 4. API Endpoint Updates

**Endpoint:** `GET /api/demo/multi-step`

Returns machine information:

```json
{
  "success": true,
  "machine": {
    "id": "machine-1767333314560-aschqejij",
    "name": "Multi-Step State Machine",
    "description": "Demonstrates 3-step critical event sequences...",
    "sequenceCount": 2,
    "totalVectors": 6,
    "sequenceIds": ["360bd7eb-...", "dc0ba755-..."],
    "sequences": [
      { "id": "360bd7eb-...", "name": "Sequence 1: 000→001→011→[01]" },
      { "id": "dc0ba755-...", "name": "Sequence 2: 100→101→111→[10]" }
    ],
    "metadata": { ... }
  },
  "metadata": { ... },
  "sequencesLoaded": 2,
  "inputVectorsLoaded": 11
}
```

### Frontend Components

#### 1. Machine Type Definition

**File:** `/visualizer/frontend/src/types.ts`

```typescript
export interface Machine {
  id: string;
  name: string;
  description: string;
  sequenceCount: number;
  totalVectors: number;
  sequenceIds: string[];
  sequences: Array<{ id: string; name: string; }>;
  metadata: Record<string, any>;
}
```

#### 2. Store Integration

**File:** `/visualizer/frontend/src/store.ts`

```typescript
interface VisualizerState {
  currentMachine: Machine | null;     // Currently loaded machine
  setCurrentMachine: (machine: Machine | null) => void;
  // ... other properties
}

// On loading multi-step example
loadMultiStepExample: async () => {
  const result = await api.loadMultiStepExample();
  set({
    currentMachine: result.machine || null,
    // ... other state
  });
}
```

#### 3. Unified Graph Visualization

**File:** `/visualizer/frontend/src/components/CriticalEventGraphView.tsx`

**Key Logic:**
```typescript
const displaySequences = useMemo(() => {
  // If there's a current machine, show all its sequences together
  if (currentMachine) {
    return sequences.filter(seq =>
      currentMachine.sequenceIds.includes(seq.sequenceId)
    );
  }
  // ... other logic
}, [sequences, currentMachine]);
```

**Result:** All sequences in a machine are displayed on the same graph simultaneously.

#### 4. Enhanced Simulation Controls

**File:** `/visualizer/frontend/src/components/SimulationControls.tsx`

**Changes:**
1. **"Run Input Sequence" Button:**
   - When a machine is loaded, the Play button shows "Run Input Sequence"
   - Tooltip: "Run Input Sequence through Machine"

2. **Machine Info Display:**
   ```jsx
   {currentMachine && (
     <div className="...">
       🤖 Machine: <strong>{currentMachine.name}</strong>
       ({currentMachine.sequenceCount} sequences, {inputVectors.length} input vectors)
     </div>
   )}
   ```

---

## Usage Guide

### Accessing the Multi-Step Machine

1. **Open Visualizer:**
   ```
   http://localhost:5173
   ```

2. **Load Machine:**
   - Click **"🔗 Multi-Step Sequences"** button in sidebar
   - System loads the Multi-Step State Machine

3. **View Machine:**
   - Graph shows **both sequences together**:
     ```
     Sequence 1:  000 → 001 → 011 → [01]
     Sequence 2:  100 → 101 → 111 → [10]
     ```
   - All 6 events (3 per sequence) visible simultaneously
   - Machine info displayed in control panel

4. **Run Input Sequence:**
   - Click **"▶ Run Input Sequence"** button
   - System processes all 11 input vectors through both sequences
   - Watch transitions in real-time:
     - Vector 6: Sequence 2 completes → Output [1,0]
     - Vector 9: Sequence 1 completes → Output [0,1]
   - Activity feed shows all events

5. **Simulation Controls:**
   - **Play:** Auto-run through all 11 vectors
   - **Pause:** Pause during execution
   - **Stop:** Stop and reset
   - **Reset:** Go back to beginning
   - **Step:** Advance one vector at a time
   - **Speed:** Adjust playback speed (100ms - 5000ms)

### Expected Behavior

**Input Sequence:** {000, 001, 101, 100, 101, 111, 000, 001, 011, 100, 101}

| Vector # | Input     | Sequence 1 Activity      | Sequence 2 Activity          | Outputs |
|----------|-----------|--------------------------|------------------------------|---------|
| 1        | [0,0,0]   | 000 activated            | -                            | -       |
| 2        | [0,0,1]   | 000→001 transition       | -                            | -       |
| 3        | [1,0,1]   | -                        | 101 activated                | -       |
| 4        | [1,0,0]   | -                        | 100 activated                | -       |
| 5        | [1,0,1]   | -                        | 100→101 transition           | -       |
| 6        | [1,1,1]   | -                        | **101→111 complete**         | **[1,0]** ✅ |
| 7        | [0,0,0]   | 000 re-activated         | -                            | -       |
| 8        | [0,0,1]   | 000→001 transition       | -                            | -       |
| 9        | [0,1,1]   | **001→011 complete**     | -                            | **[0,1]** ✅ |
| 10       | [1,0,0]   | -                        | 100 re-activated             | -       |
| 11       | [1,0,1]   | -                        | 100→101 transition           | -       |

---

## Key Features

### ✅ Unified Visualization
- All machine sequences displayed on one graph
- Clear visual grouping of related sequences
- Side-by-side comparison of state transitions

### ✅ Synchronized Processing
- Single input sequence processed by all sequences simultaneously
- Independent state management per sequence
- Different outputs from different sequences

### ✅ Enhanced Controls
- **"Run Input Sequence"** button explicitly shows machine operation
- Machine metadata displayed in control panel
- Real-time activity feed shows all sequence activities

### ✅ Conceptual Organization
- Logical grouping of related sequences
- Metadata support for machine documentation
- Scalable to multiple machines

---

## File Summary

### New Files Created
1. `/src/models/Machine.ts` - Machine model class
2. `/Users/johnt/workspace/idahoApp/realityEngine/MACHINE_IMPLEMENTATION.md` - This document

### Modified Files

**Backend:**
1. `/src/engine/RealityEngine.ts` - Added machine management methods
2. `/src/examples/multi-step-sequences/sequence-definitions.ts` - Added `createMultiStepMachine()`
3. `/src/api/routes.ts` - Updated `/api/demo/multi-step` to return machine

**Frontend:**
1. `/visualizer/frontend/src/types.ts` - Added Machine interface
2. `/visualizer/frontend/src/store.ts` - Added currentMachine state
3. `/visualizer/frontend/src/api.ts` - Updated return type for loadMultiStepExample
4. `/visualizer/frontend/src/components/CriticalEventGraphView.tsx` - Show all machine sequences together
5. `/visualizer/frontend/src/components/SimulationControls.tsx` - Added "Run Input Sequence" button and machine info

---

## Testing Results

### API Test ✅
```bash
$ curl http://localhost:3000/api/demo/multi-step
```
- Machine returned with correct metadata
- 2 sequences included
- 11 input vectors configured

### Visualization Test ✅
**Verified:**
- ✅ Both sequences visible on same graph
- ✅ Machine name displayed in controls
- ✅ "Run Input Sequence" button visible
- ✅ All 6 events (3 per sequence) rendered
- ✅ Input sequence progress tracked (11 vectors)

### Simulation Test ✅
**Verified:**
- ✅ Vector 6 triggers Sequence 2 output [1,0]
- ✅ Vector 9 triggers Sequence 1 output [0,1]
- ✅ All 11 vectors process correctly
- ✅ Activity feed shows both sequence activities
- ✅ Step-through works correctly

---

## Architecture Benefits

### Before (Individual Sequences)
- Sequences managed separately
- Had to select one sequence at a time to view
- No conceptual grouping
- Unclear how sequences relate

### After (Machine Grouping)
- Sequences grouped into logical machines
- **All machine sequences visualized together**
- Clear system boundaries
- **Explicit "Run Input Sequence" control**
- Metadata describes machine purpose
- Scalable to complex multi-sequence systems

---

## Future Enhancements

Possible extensions:
1. **Multiple Machines:** Support loading multiple machines simultaneously
2. **Machine-to-Machine Communication:** Outputs from one machine feed another
3. **Machine Templates:** Pre-configured machine types (logic gates, state machines, etc.)
4. **Machine Composition:** Build larger machines from smaller ones
5. **Visual Machine Designer:** UI for creating machines graphically

---

## Conclusion

The Machine concept successfully:
- ✅ Groups Sequence 1 and Sequence 2 into a unified "Multi-Step State Machine"
- ✅ Displays all sequences together on one graph
- ✅ Provides a **"Run Input Sequence"** button to apply the 11-vector input sequence
- ✅ Shows machine metadata and status
- ✅ Maintains independent sequence state and outputs

The system is now ready for visualizing and running complex multi-sequence machines!
