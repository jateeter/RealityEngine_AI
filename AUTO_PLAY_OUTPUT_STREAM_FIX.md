# Auto-Play Output Stream Fix

## Problem

The output stream visualization was only updating in "Step" mode (manual stepping), but not in "Start" mode (auto-play/streaming operation). Users would see outputs appear when manually stepping through inputs, but the output history would not update during automatic playback.

## Root Cause

The issue was in how the visualizer backend polling mechanism handled auto-play updates:

### Step Mode (Working)
When manually stepping:
1. Frontend calls `POST /api/simulation/step`
2. Backend processes step and gets `result` with `totalOutputs`
3. Backend broadcasts WebSocket message with `result` field:
```typescript
broadcast({
  type: 'simulation-stepped',
  state: response.data.state,
  result: response.data.result,  // ✅ Includes totalOutputs
  timestamp: Date.now()
});
```
4. Frontend WebSocket handler extracts outputs from `message.result`
5. Outputs added to stream

### Auto-Play Mode (Broken)
When auto-playing:
1. Backend polls `GET /api/simulation/state` every 200ms
2. Detects state change (index increment)
3. Broadcasts WebSocket message **without** `result` field:
```typescript
broadcast({
  type: 'simulation-stepped',
  state: state,
  sequences: seqResponse.data.sequences,
  // ❌ Missing result field!
  timestamp: Date.now()
});
```
4. Frontend WebSocket handler checks for `message.result` (undefined)
5. Outputs **not** added to stream

## Solution

Make the last transition result available during polling by:

1. **Store Last Result** in SimulationController
2. **Include Last Result** in state API response
3. **Broadcast Last Result** during auto-play polling

### Implementation

#### 1. SimulationController - Store Last Result

**File**: `/src/engine/SimulationController.ts`

Added `lastResult` property:
```typescript
export class SimulationController {
  // ... other properties
  private lastResult: TransitionResult | null = null;
```

Store result after each step:
```typescript
public step(): TransitionResult | null {
  // ...
  const result = this.engine.processInput(inputVector);

  // Store last result for polling access
  this.lastResult = result;

  // ... update heatmap, emit events, etc.
  return result;
}
```

Clear result on reset:
```typescript
public reset(): void {
  this.state = {
    status: 'stopped',
    currentIndex: 0,
    totalVectors: this.config.inputVectors.length,
    startTime: null,
    lastStepTime: null
  };
  this.lastResult = null; // Clear last result
  // ...
}
```

Add getter method:
```typescript
/**
 * Get last transition result (for polling during auto-play)
 */
public getLastResult(): TransitionResult | null {
  return this.lastResult;
}
```

#### 2. API - Include Last Result in State Response

**File**: `/src/api/routes.ts`

Updated `/api/simulation/state` endpoint:
```typescript
private getSimulationState(_req: Request, res: Response): void {
  if (!this.simulationController) {
    res.status(400).json({ error: 'Simulation not initialized' });
    return;
  }

  res.json({
    state: this.simulationController.getState(),
    progress: this.simulationController.getProgress(),
    inputVectors: this.simulationController.getInputVectors(),
    lastResult: this.simulationController.getLastResult() // ✅ NEW
  });
}
```

#### 3. Visualizer Backend - Broadcast Last Result During Polling

**File**: `/visualizer/backend/src/server.ts`

Updated polling function:
```typescript
function startSimulationPolling() {
  if (simulationPollInterval) return;

  simulationPollInterval = setInterval(async () => {
    try {
      const response = await axios.get(`${REALITY_ENGINE_URL}/api/simulation/state`);
      const state = response.data.state;
      const lastResult = response.data.lastResult; // ✅ Extract last result

      if (state.status !== 'playing') {
        stopSimulationPolling();
        return;
      }

      if (state.currentIndex !== lastSimulationIndex) {
        lastSimulationIndex = state.currentIndex;

        const seqResponse = await axios.get(`http://localhost:3001/api/viz/sequences`);

        broadcast({
          type: 'simulation-stepped',
          state: state,
          sequences: seqResponse.data.sequences,
          result: lastResult, // ✅ Include last result for output stream updates
          timestamp: Date.now()
        });
      }
    } catch (error: any) {
      console.error('Error polling simulation state:', error.message);
    }
  }, 200);
}
```

## Frontend WebSocket Handler (No Changes Needed)

**File**: `/visualizer/frontend/src/store.ts` (lines 764-776)

The existing handler already checks for `message.result` and adds outputs when present:

```typescript
case 'simulation-stepped':
  if (message.state) {
    set({ simulationState: message.state });
  }
  if (message.sequences) {
    set({ sequences: message.sequences });
  }
  if (message.result) { // ✅ Now works in auto-play too!
    // Refresh sequences to update active node states
    api.getSequences().then(sequences => {
      set({ sequences });
    });
    get().refreshHeatmap();

    // Append new output vectors to existing history
    const outputs = message.result.totalOutputs || [];
    if (outputs.length > 0) {
      set({ currentOutputVectors: [...get().currentOutputVectors, ...outputs] });
    }
  }
  break;
```

## Data Flow (After Fix)

### Auto-Play Mode (Now Working)

1. **Simulation Playing**: Backend auto-steps through input vectors
2. **Step Occurs**: SimulationController stores result in `lastResult`
3. **Polling Detects Change**: Backend polls state endpoint, gets `lastResult`
4. **Broadcast with Result**: Backend broadcasts with `result` field populated
5. **Frontend Updates**: WebSocket handler extracts outputs and updates stream
6. **User Sees Outputs**: Output stream displays accumulated history in real-time

## Benefits

✅ Output stream updates in both manual step and auto-play modes
✅ Consistent behavior across all simulation modes
✅ Real-time output accumulation during streaming
✅ No duplicate outputs (handled by earlier fix)
✅ Works with output highlighting and auto-scroll
✅ Maintains backward compatibility

## Verification

### Test Auto-Play Mode
1. Load a machine with sequences that produce outputs
2. Load input vectors
3. Click "Start" (auto-play)
4. **Expected**: Output stream updates in real-time as simulation plays
5. **Verify**: Each output appears exactly once, in order

### Test Step Mode (Still Works)
1. Load same machine
2. Reset simulation
3. Click "Step" multiple times
4. **Expected**: Output stream updates after each step
5. **Verify**: Same behavior as before the fix

### Test Mode Switching
1. Start auto-play
2. Pause
3. Step manually
4. Resume auto-play
5. **Expected**: Outputs accumulate continuously through all modes
6. **Verify**: No missing outputs, no duplicates

## Related Features

This fix completes the output stream feature set:
- ✅ Output history accumulation (earlier fix)
- ✅ Single source of truth (duplicate fix)
- ✅ Hover highlighting with auto-scroll
- ✅ Auto-play output streaming (this fix)
- ✅ Purple output vector badges on graph nodes

---

**Date**: 2026-01-31
**Version**: 1.0.1
**Status**: Deployed
