# Perceptual Space Integration Issues

## Problem Summary

There are **two parallel simulation systems** running independently:
1. **Legacy SimulationController** - processes machine-specific vectors directly through sequences
2. **PerceptualSpaceSimulator** - processes universal 256-byte vectors through perceptual space

The legacy system bypasses the universal perceptual space entirely, creating inconsistencies between what's visualized in the Universal Input Vector Display and what machines actually receive as inputs.

## Critical Issues Identified

### Issue 1: loadRandomVectors Generates Machine-Specific Vectors

**Location:** `visualizer/frontend/src/store.ts:522-602`

**Problem:**
```typescript
loadRandomVectors: async (dimension: number, count: number, binaryThreshold: boolean) => {
  // Generates vectors with machine-specific dimension (e.g., 3D, 5D)
  vectors.push(Array.from({ length: dimension }, () => Math.random()));

  // Loads into LEGACY SimulationController (bypasses perceptual space)
  const result = await api.loadSimulation(vectors, { autoPlayDelayMs: 500, loop: true });
}
```

**Impact:**
- Generates vectors sized to machine's input dimension (not universal 256-byte)
- Feeds directly to machine sequences without going through perceptual space
- Universal Input Vector Display shows empty/zero because perceptual space is not being used
- Machine gets inputs that don't come from En (universal perceptual space)

---

### Issue 2: loadSimulation API Doesn't Support Perceptual Mode

**Location:** `src/api/routes.ts:736-759`

**Problem:**
```typescript
private loadSimulationVectors(req: Request, res: Response): void {
  const { vectors, autoPlayDelayMs, loop } = req.body;

  // Always creates SimulationController in LEGACY mode
  this.simulationController = new SimulationController(this.engine, {
    autoPlayDelayMs: autoPlayDelayMs || 1000,
    inputVectors: vectors,
    loop: loop !== undefined ? loop : true
    // MISSING: machineId, usePerceptualSpace flags!
  });
}
```

**Impact:**
- SimulationController always runs in "legacy mode" (line 193-194)
- Never uses `processUniversalInput()` even though it's implemented
- Completely bypasses perceptual space simulator

---

### Issue 3: Example Loading Uses Machine-Specific Test Data

**Location:** `visualizer/frontend/src/store.ts:184-200`

**Problem:**
```typescript
loadMachine: async (machineId: string) => {
  // Automatically load simulation vectors for example machines
  if (machine.isExample) {
    if (machineId === 'multi-step-example') {
      await get().loadMultiStepExample();  // Loads machine-specific test vectors
    }
  }
}
```

**Impact:**
- Example machines load their own specific test vectors (e.g., 3D for Multi-Step)
- These are NOT universal 256-byte vectors
- Examples run in legacy mode, bypassing perceptual space

---

### Issue 4: Two Separate Control Panels

**Current State:**
- **Left sidebar:** Controls for legacy SimulationController (Play/Pause/Step for machine-specific vectors)
- **Random Generator:** Creates universal vectors for PerceptualSpaceSimulator
- **No integration:** Both systems run independently

**Problem:**
- User clicks "Play" in left sidebar → runs legacy simulation (machine-specific vectors)
- User generates random stream → perceptual simulation (universal vectors)
- Two different input sources, two different state machines
- Confusing UX: which simulation is running?

---

### Issue 5: Input Stream Visualization Shows Wrong Data

**Location:** `visualizer/frontend/src/components/InputStreamVisualization.tsx`

**Problem:**
- Displays `inputVectors` from store (machine-specific vectors from legacy simulation)
- Should display machine's extracted inputs from universal perceptual space
- Mismatch: shows 3D vectors when it should show 256-byte vectors (or extracted slices)

---

### Issue 6: processInput() vs processUniversalInput()

**Location:** `src/engine/RealityEngine.ts`

**Two Methods:**
```typescript
// Legacy: processes machine-specific vector directly
processInput(inputVector: number[]): TransitionResult

// Perceptual: processes universal vector through machines
processUniversalInput(universalInput: number[], machineId: string): MachineTransitionResult
```

**Problem:**
- Frontend only uses `processInput()` (legacy)
- `processUniversalInput()` exists but is never called from frontend simulations
- Only used by perceptual simulation API (separate system)

---

### Issue 7: Sample Vectors Injection

**Location:** `visualizer/frontend/src/store.ts:525-559`

**Problem:**
```typescript
// 20% chance to inject a single sample vector if available
else if (sampleVectors.length > 0 && Math.random() < 0.2) {
  const sample = sampleVectors[Math.floor(Math.random() * sampleVectors.length)];
  vectors.push([...sample.vector]);  // Machine-specific sample vector
}
```

**Impact:**
- Injects machine-specific sample vectors from metadata
- Not universal perceptual vectors
- Creates biased test data that bypasses perceptual space

---

## Architecture Diagram: Current (Broken) State

```
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend UI                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Left Sidebar:                    Random Generator:              │
│  ┌──────────────────┐            ┌──────────────────┐           │
│  │ Play/Pause/Step  │            │ Generate Random  │           │
│  │ (Legacy Controls)│            │ Universal Vectors│           │
│  └────────┬─────────┘            └────────┬─────────┘           │
│           │                               │                      │
│           │ machine-specific              │ 256-byte            │
│           │ vectors (3D, 5D)              │ universal vectors   │
│           ▼                               ▼                      │
│  ┌────────────────────┐          ┌────────────────────┐         │
│  │ loadSimulation()   │          │ configurePerceptual│         │
│  │ (Legacy API)       │          │ Simulation()       │         │
│  └────────┬───────────┘          └────────┬───────────┘         │
└───────────┼──────────────────────────────┼──────────────────────┘
            │                              │
            ▼                              ▼
┌────────────────────────┐      ┌──────────────────────────────┐
│  SimulationController  │      │  PerceptualSpaceSimulator    │
│  (Legacy Mode)         │      │  (Universal Mode)            │
├────────────────────────┤      ├──────────────────────────────┤
│ - Uses processInput()  │      │ - Uses processUniversalInput │
│ - Machine-specific     │      │ - 256-byte universal vectors │
│ - No perceptual space  │      │ - Extracts machine inputs    │
│ - Direct to sequences  │      │ - Merges machine outputs     │
└────────┬───────────────┘      └─────────┬────────────────────┘
         │                                 │
         │ Both write to                   │
         │ same sequences                  │
         └─────────┬───────────────────────┘
                   ▼
         ┌──────────────────┐
         │ CriticalEvent    │
         │ Sequences        │
         └──────────────────┘

PROBLEM: Two independent systems process inputs differently!
```

---

## Required Fixes

### Fix 1: Unify Simulation Systems

**Solution:** Make SimulationController always use perceptual space mode.

**Changes:**
1. Update `loadSimulationVectors` to require `machineId` parameter
2. Set `usePerceptualSpace: true` by default
3. Convert machine-specific vectors to universal vectors on load
4. Remove legacy `processInput()` path

---

### Fix 2: Update loadRandomVectors to Generate Universal Vectors

**Solution:** Always generate 256-byte universal vectors.

**Changes:**
```typescript
loadRandomVectors: async (vectorCount: number, inputRegion: { offset: number; length: number }) => {
  // Generate universal 256-byte vectors
  const vectors: number[][] = [];
  for (let i = 0; i < vectorCount; i++) {
    const vector = new Array(256).fill(0);
    for (let j = inputRegion.offset; j < inputRegion.offset + inputRegion.length; j++) {
      vector[j] = Math.random();
    }
    vectors.push(vector);
  }

  // Load into perceptual simulation
  await api.configurePerceptualSimulation({
    inputSequence: vectors,
    inputRegion: inputRegion,
    stepDelayMs: 500
  });
}
```

---

### Fix 3: Create Input Flow Visualization

**New Component:** `MachineInputFlowDisplay.tsx`

**Features:**
- Shows En (universal 256-byte vector) at top
- Highlights machine's input region extraction
- Shows machine-specific extracted input (e.g., 3 bytes extracted)
- Shows sequence processing
- Shows machine output
- Shows output merge back to En at output offset

**Layout:**
```
┌────────────────────────────────────────────────────────────┐
│ Universal Perceptual Space (En)                            │
│ [0...255] 256 bytes, machine input region [3:5] highlighted│
└────────────┬───────────────────────────────────────────────┘
             │ Extract [3:5]
             ▼
┌────────────────────────────────────────────────────────────┐
│ Machine Input: [0.4, 0.7] (2 bytes extracted from En)     │
└────────────┬───────────────────────────────────────────────┘
             │ Process through sequences
             ▼
┌────────────────────────────────────────────────────────────┐
│ Sequence Transitions: S1 → S2 → S3                        │
└────────────┬───────────────────────────────────────────────┘
             │ Generate output
             ▼
┌────────────────────────────────────────────────────────────┐
│ Machine Output: [1.0, 0.3, 0.8] (3 bytes)                 │
└────────────┬───────────────────────────────────────────────┘
             │ Merge to En at offset [6:9]
             ▼
┌────────────────────────────────────────────────────────────┐
│ Updated En: Bytes [6:9] now contain [1.0, 0.3, 0.8]       │
└────────────────────────────────────────────────────────────┘
```

---

### Fix 4: Unify Control Panel

**Solution:** Single control panel that always controls perceptual simulation.

**Changes:**
- Remove legacy simulation controls from InputStreamVisualization
- Move all controls to UniversalInputVectorDisplay or central location
- Single "Play/Pause/Step" that controls perceptual simulation
- Show current universal vector being applied

---

### Fix 5: Update Input Stream Visualization

**Solution:** Show machine's extracted inputs from perceptual space.

**Changes:**
- Display: "Extracted Input [3:5] from En"
- Show 2-byte slice instead of full 256-byte vector
- Add tooltip: "This is Machine A's view of reality (bytes 3-5 from En)"

---

### Fix 6: Deprecate Legacy Mode

**Solution:** Remove `processInput()` or mark as internal-only.

**Changes:**
- Update all API calls to use perceptual mode
- Remove `usePerceptualSpace` flag (always true)
- Require `machineId` for all simulations

---

## Summary of Changes Needed

### Backend Changes
1. ✅ `routes.ts`: Update `loadSimulationVectors` to require `machineId`, set `usePerceptualSpace: true`
2. ✅ `SimulationController.ts`: Make perceptual mode the default
3. ✅ `routes.ts`: Remove legacy simulation endpoints or redirect to perceptual

### Frontend Changes
1. ✅ `store.ts`: Update `loadRandomVectors` to generate universal 256-byte vectors
2. ✅ `store.ts`: Remove sample vector injection (or convert to universal)
3. ✅ `store.ts`: Update `loadSimulation` to use perceptual API
4. ✅ `MachineContainerView.tsx`: Add MachineInputFlowDisplay component
5. ✅ `InputStreamVisualization.tsx`: Show extracted inputs from En, not full vector
6. ✅ Unify control panels into single perceptual simulation controller

### New Components
1. ✅ `MachineInputFlowDisplay.tsx`: Shows input extraction → processing → output merge
2. ✅ Update `UniversalInputVectorDisplay.tsx`: Add flow arrows showing machine interactions

---

## Testing Plan

### Test 1: Random Vector Generation
1. Generate 100 random universal vectors
2. Verify all are 256 bytes
3. Verify only target region has non-zero values
4. Verify displayed in Universal Input Vector Display

### Test 2: Perceptual Simulation
1. Load machine with perceptual mapping
2. Start simulation
3. Verify En updates on each step
4. Verify machine input extracted from En
5. Verify machine output merged back to En
6. Verify Universal Input Vector Display updates

### Test 3: Machine Input Flow
1. Open machine view
2. Generate random stream
3. Step through simulation
4. Verify MachineInputFlowDisplay shows:
   - Universal vector → Extracted input → Sequences → Output → Updated En

### Test 4: Multi-Machine Interaction
1. Load 2+ machines with overlapping regions
2. Generate random stream
3. Verify Machine A output appears in Machine B input region
4. Verify data flow visualized correctly

---

## Timeline

1. **Phase 1**: Backend fixes (unify simulation systems) - 1-2 hours
2. **Phase 2**: Frontend store updates (universal vectors only) - 1 hour
3. **Phase 3**: Create MachineInputFlowDisplay component - 2-3 hours
4. **Phase 4**: Update visualizations for compatibility - 1-2 hours
5. **Phase 5**: Testing and documentation - 1 hour

**Total estimated time**: 6-9 hours
