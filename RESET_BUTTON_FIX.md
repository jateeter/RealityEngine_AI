# Reset Layout Button Fix

**Date**: January 22, 2026
**Status**: ✅ **FIXED AND DEPLOYED**

---

## Problem

After implementing the "Reset Layout" button, clicking it would cause the graph layout to continuously reset on every render, preventing the force simulation from ever stabilizing.

### Symptoms:
- Click "Reset Layout" button
- Graph nodes start moving/jumping continuously
- Layout never stabilizes
- Positions are lost on every input/state change
- User cannot manually arrange nodes

---

## Root Cause

The reset logic was checking `if (layoutResetKey > 0)` which meant:

1. **Initial state**: `layoutResetKey = 0`, positions preserved ✅
2. **User clicks button**: `layoutResetKey = 1`, positions cleared ✅
3. **Next render** (sequences update): `layoutResetKey = 1`, **positions cleared again** ❌
4. **Every subsequent render**: `layoutResetKey = 1`, **positions keep clearing** ❌

The condition `layoutResetKey > 0` was **always true after the first button click**, causing positions to be cleared on every single render instead of just when the button was clicked.

### Code Before Fix (WRONG):

```typescript
const [layoutResetKey, setLayoutResetKey] = useState(0);

useEffect(() => {
  // ...

  // Clear positions on layout reset
  if (layoutResetKey > 0) {  // ❌ WRONG: Always true after first click
    nodePositionsRef.current.clear();
    zoomTransformRef.current = null;
  }

  // ... rest of effect
}, [sequences, selectedSequenceId, currentMachine, layoutResetKey]);
```

**Why this fails:**
- `layoutResetKey` increments from 0 to 1 on first click
- It stays at 1 (then 2, 3, 4...) on subsequent clicks
- Condition `layoutResetKey > 0` is **always true** after first click
- Positions get cleared on **every render**, not just on button click

---

## Solution

Track the **previous** value of `layoutResetKey` using a ref, and only clear positions when the value **actually changes**.

### Code After Fix (CORRECT):

```typescript
const [layoutResetKey, setLayoutResetKey] = useState(0);
const previousResetKeyRef = useRef<number>(0);

useEffect(() => {
  // ...

  // Clear positions only when layout reset key actually changes
  if (layoutResetKey !== previousResetKeyRef.current) {  // ✅ CORRECT
    nodePositionsRef.current.clear();
    zoomTransformRef.current = null;
    previousResetKeyRef.current = layoutResetKey;
  }

  // ... rest of effect
}, [sequences, selectedSequenceId, currentMachine, layoutResetKey]);
```

**Why this works:**
- `previousResetKeyRef` stores the last processed value
- Positions only clear when `layoutResetKey !== previousResetKeyRef.current`
- After clearing, we update `previousResetKeyRef.current = layoutResetKey`
- On next render (with same `layoutResetKey`), condition is false
- Positions are preserved across normal updates ✅

---

## Behavior Flow

### Before Fix:
1. User arranges nodes manually
2. User clicks "Reset Layout"
3. `layoutResetKey` changes: 0 → 1
4. **Effect runs**: Positions cleared ✅
5. Graph starts recalculating layout
6. Sequences update (normal operation)
7. **Effect runs again**: `layoutResetKey > 0` is true, positions cleared again ❌
8. **Infinite loop**: Positions clear on every render ❌
9. Graph never stabilizes ❌

### After Fix:
1. User arranges nodes manually
2. User clicks "Reset Layout"
3. `layoutResetKey` changes: 0 → 1
4. **Effect runs**: `1 !== 0`, positions cleared ✅, `previousResetKeyRef = 1` ✅
5. Graph starts recalculating layout
6. Sequences update (normal operation)
7. **Effect runs again**: `1 === 1`, positions **NOT** cleared ✅
8. Positions preserved across normal updates ✅
9. Graph stabilizes ✅

---

## Testing

### Test 1: Normal Operation (Position Preservation)
1. Open visualizer: http://localhost:5173
2. Load RS Flip-Flop Circuit machine
3. Drag nodes to custom positions
4. Process multiple inputs
5. **Expected**: Nodes stay in custom positions ✅

### Test 2: Reset Button (Single Click)
1. Arrange nodes manually
2. Zoom and pan to specific view
3. Click "Reset Layout" button **once**
4. **Expected**:
   - Positions clear ✅
   - Zoom resets ✅
   - Layout recalculates from scratch ✅
   - Simulation stabilizes after ~2-3 seconds ✅

### Test 3: Reset Button (Multiple Clicks)
1. Click "Reset Layout" button
2. Wait for stabilization
3. Click "Reset Layout" button again
4. **Expected**:
   - Layout resets again ✅
   - No continuous resetting ✅
   - Simulation stabilizes each time ✅

### Test 4: Reset + Manual Positioning
1. Click "Reset Layout"
2. While simulation is running, drag a node
3. **Expected**: Node stays where dragged ✅

---

## Changes Made

### File: `/visualizer/frontend/src/components/CriticalEventGraphView.tsx`

**Line 46**: Added previous value tracking
```typescript
const previousResetKeyRef = useRef<number>(0);
```

**Lines 54-58**: Fixed reset condition
```typescript
// Clear positions only when layout reset key actually changes
if (layoutResetKey !== previousResetKeyRef.current) {
  nodePositionsRef.current.clear();
  zoomTransformRef.current = null;
  previousResetKeyRef.current = layoutResetKey;
}
```

---

## Technical Details

### Why Use a Ref?

**Option 1: useState** (would cause extra render)
```typescript
const [previousResetKey, setPreviousResetKey] = useState(0);

// This would trigger another render when we update previousResetKey
if (layoutResetKey !== previousResetKey) {
  // ... clear positions ...
  setPreviousResetKey(layoutResetKey);  // ❌ Causes extra render
}
```

**Option 2: useRef** (no extra render) ✅
```typescript
const previousResetKeyRef = useRef<number>(0);

// This does NOT trigger a render when we update the ref
if (layoutResetKey !== previousResetKeyRef.current) {
  // ... clear positions ...
  previousResetKeyRef.current = layoutResetKey;  // ✅ No render
}
```

**Why ref is better:**
- Refs persist across renders but don't trigger re-renders
- We only need to **track** the previous value, not **react** to it
- Avoids unnecessary render cycles
- More efficient

### D3 Simulation Behavior

When positions are cleared:
1. Nodes have `x` and `y` set to `undefined`
2. D3 force simulation calculates initial positions
3. Forces (charge, collision, x, y) move nodes
4. Simulation runs until alpha decays to alpha min
5. Positions stabilize

When positions are restored:
1. Nodes have `x` and `y` set to saved values
2. D3 force simulation uses these as starting positions
3. Forces are still active (for dragging, new nodes)
4. Simulation runs briefly then stabilizes
5. Positions remain close to saved values

---

## Deployment

### Docker Image
- **Built**: January 22, 2026
- **Image**: `realityengine_ai-visualizer-frontend`
- **SHA**: `acaef42eef634b2dee7932b1495cb009bab5b77d9124e5583a1a71bf0a42cad7`

### Container Status
```bash
NAMES                                STATUS                    PORTS
reality-engine-visualizer-frontend   Up (healthy)              0.0.0.0:5173->80/tcp
```

### Verification
```bash
# Check container
docker ps --filter "name=visualizer-frontend"

# Rebuild if needed
docker-compose build visualizer-frontend
docker-compose restart visualizer-frontend
```

---

## Related Files

| File | Changes | Status |
|------|---------|--------|
| `/visualizer/frontend/src/components/CriticalEventGraphView.tsx` | Fixed reset logic | ✅ Complete |
| Docker image: `visualizer-frontend` | Rebuilt with fix | ✅ Deployed |

---

## Lessons Learned

### 1. State vs Derived State
- `layoutResetKey` is **state** (triggers renders)
- `previousResetKeyRef` is **derived tracking** (no renders)
- Use refs for tracking values that don't need to trigger renders

### 2. Condition Checking
- ❌ `if (value > 0)` - Always true after first increment
- ✅ `if (value !== previousValue)` - Only true on change

### 3. Effect Dependencies
- When a value in dependency array changes, effect runs
- Need to distinguish between "changed" vs "current value"
- Refs are perfect for this pattern

### 4. Testing Edge Cases
- Test button multiple times in a row
- Test button during simulation
- Test with different graph states
- Verify no continuous re-rendering

---

## Conclusion

✅ **Reset button now works correctly**

**Before:**
- Button click → positions clear on every render
- Graph never stabilizes
- Unusable feature

**After:**
- Button click → positions clear once
- Graph stabilizes normally
- Layout resets only when requested

**Status**: Production ready and deployed

---

**Fix Date**: January 22, 2026
**Deployed**: ✅ Complete
**Tested**: ✅ Verified
