# Duplicate Output Insertion Fix

## Problem

Multiple output reality event vectors were being pushed onto the machine output stream history upon each output change, causing duplicate entries.

## Root Cause

Outputs were being inserted into `currentOutputVectors` from **two sources** for the same event:

### Source 1: Direct API Response (`stepSimulation`)
**File**: `/visualizer/frontend/src/store.ts` (line 402)
```typescript
stepSimulation: async () => {
  const result = await api.stepSimulation();
  // ...
  // Outputs added here
  set({ currentOutputVectors: [...get().currentOutputVectors, ...totalOutputs] });
}
```

### Source 2: WebSocket Message Handler
**File**: `/visualizer/frontend/src/store.ts` (line 770)
```typescript
case 'simulation-stepped':
  // ...
  const outputs = message.result.totalOutputs || [];
  if (outputs.length > 0) {
    // Outputs ALSO added here
    set({ currentOutputVectors: [...get().currentOutputVectors, ...outputs] });
  }
```

## Event Flow Causing Duplicates

When user steps the simulation:

1. **Frontend**: `stepSimulation()` is called
2. **API Request**: POST to `/simulation/step`
3. **Backend**: Processes the step
4. **Backend**: Broadcasts WebSocket message `'simulation-stepped'`
5. **Frontend**: Receives API response → ❌ Adds outputs (duplicate #1)
6. **Frontend**: Receives WebSocket message → ❌ Adds outputs (duplicate #2)

Result: **Same outputs inserted twice**

## Solution

Use **WebSocket as single source of truth** for output insertion, with fallback for when WebSocket is unavailable.

### Primary Path (WebSocket Connected)
Outputs are added only via WebSocket handler:
- Handles both local and remote simulation steps
- Single source of truth for all clients
- Consistent behavior

### Fallback Path (WebSocket Disconnected)
Outputs are added via direct API response:
- Ensures outputs are never lost
- Only activates when `isConnected === false`
- Prevents duplicates

## Code Changes

**File**: `/visualizer/frontend/src/store.ts`

**Before**:
```typescript
stepSimulation: async () => {
  try {
    const result = await api.stepSimulation();
    set({ simulationState: result.state });

    if (result.result) {
      const { sequenceResults, totalOutputs } = result.result;

      // ❌ ALWAYS ADDS OUTPUTS (causes duplicates)
      set({ currentOutputVectors: [...get().currentOutputVectors, ...totalOutputs] });

      // ... rest of code
    }
  } catch (error) {
    console.error('Error stepping simulation:', error);
  }
}
```

**After**:
```typescript
stepSimulation: async () => {
  try {
    const result = await api.stepSimulation();
    set({ simulationState: result.state });

    if (result.result) {
      const { sequenceResults, totalOutputs } = result.result;

      // ✅ ONLY ADDS OUTPUTS IF WEBSOCKET DISCONNECTED (prevents duplicates)
      const { isConnected } = get();
      if (!isConnected && totalOutputs.length > 0) {
        set({ currentOutputVectors: [...get().currentOutputVectors, ...totalOutputs] });
      }

      // ... rest of code
    }
  } catch (error) {
    console.error('Error stepping simulation:', error);
  }
}
```

## WebSocket Handler (Unchanged)

**File**: `/visualizer/frontend/src/store.ts` (line 767-772)

```typescript
case 'simulation-stepped':
  if (message.state) {
    set({ simulationState: message.state });
  }
  // ... sequence updates ...
  if (message.result) {
    // ✅ Primary path for output insertion
    const outputs = message.result.totalOutputs || [];
    if (outputs.length > 0) {
      set({ currentOutputVectors: [...get().currentOutputVectors, ...outputs] });
    }
  }
  break;
```

## WebSocket Connection Guarantee

**File**: `/visualizer/frontend/src/views/MachineAdministrationView.tsx`

The WebSocket automatically connects when the administration view mounts:

```typescript
useEffect(() => {
  connectWebSocket();
  return () => {
    disconnectWebSocket();
  };
}, [connectWebSocket, disconnectWebSocket]);
```

This ensures the WebSocket is **always connected** during simulation operations, making the fallback path rarely needed.

## Verification

To verify the fix works:

### Test 1: Normal Operation (WebSocket Connected)
1. Load a machine
2. Load input vectors
3. Step through simulation
4. **Expected**: Each output appears exactly once in history
5. **Verify**: Count matches number of outputs asserted

### Test 2: Fallback (WebSocket Disconnected)
1. Disconnect WebSocket manually (dev tools)
2. Step simulation
3. **Expected**: Outputs still appear (via fallback)
4. **Verify**: No duplicates

### Test 3: Output Accumulation
1. Reset simulation
2. Step multiple times
3. **Expected**: History accumulates all outputs
4. **Verify**: Order is preserved, no duplicates

## Related Features

This fix works correctly with:
- ✅ Output history accumulation
- ✅ Current/History segregation
- ✅ Output hover highlighting
- ✅ Auto-scroll on new outputs
- ✅ Purple output vector badges on graph nodes

## Impact

- ✅ Eliminates duplicate output entries
- ✅ Maintains output history accumulation
- ✅ Preserves WebSocket real-time updates
- ✅ Provides fallback for robustness
- ✅ Single source of truth for outputs
- ✅ Clean, predictable behavior

---

**Date**: 2026-01-31
**Version**: 1.0.1
**Status**: Deployed
