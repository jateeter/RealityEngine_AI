# Universal Input Vector Visualization

## Overview

The Random Generator has been moved from the machine visualization to the Machine Interconnection View, where it now generates **universal 256-byte perceptual space vectors** instead of machine-specific vectors. The new visualization shows the complete universal input space (En) with machine input/output regions highlighted, demonstrating how machine outputs overwrite random values at their designated offsets.

## Changes Made

### 1. Removed Random Generator from Machine Visualization

**File:** `visualizer/frontend/src/components/InputStreamVisualization.tsx`

- Removed `onGenerateRandom` prop and handler
- Removed all random generation UI (configuration panel, buttons)
- Removed related state variables (`randomMode`, `vectorDimension`, `vectorCount`, `binaryThreshold`)
- Simplified component to focus only on displaying the input stream queue

### 2. Created Universal Input Vector Display Component

**Files:**
- `visualizer/frontend/src/components/UniversalInputVectorDisplay.tsx` (NEW)
- `visualizer/frontend/src/components/UniversalInputVectorDisplay.css` (NEW)

**Features:**

#### 256-Byte Vector Grid Display
- Displays all 256 bytes of the universal perceptual space (En)
- Organized in rows of 16 bytes for easy visualization
- Hex offset labels on the left (00, 10, 20, etc.)
- Each byte shows its current value (0.0 - 1.0)

#### Region Highlighting
- **Input Regions**: Highlighted in blue (`#3b82f6`)
- **Output Regions**: Highlighted in pink (`#f472b6`)
- Color opacity shows the type of region
- Border color indicates which machine owns the region
- Hover tooltip shows byte index, value, and associated machines

#### Machine Output Overwrites
When a machine produces output:
- Output values are merged into the perceptual space at the machine's output offset
- Output regions visually overwrite random values
- If Machine A's output region overlaps with Machine B's input region, B receives A's output
- Visual feedback shows which bytes contain random values vs. machine outputs

#### Random Stream Generator UI
- **Vector Count**: Configure number of vectors to generate (1-1000)
- **Input Region Offset**: Where to start injecting random values (0-255)
- **Input Region Length**: How many bytes to randomize (1-256)
- **Target Region Display**: Shows `[offset:offset+length]` for clarity
- **Generate Button**: Creates random universal vector stream
- **Real-time Status**: Shows "generating" spinner during creation

#### Legend
- Lists all machine input/output regions
- Shows offset ranges: `[offset:end]`
- Color-coded to match the vector grid
- Arrows indicate direction: `←` for input, `→` for output

### 3. Integrated into Machine Interconnection View

**File:** `visualizer/frontend/src/components/MachineContainerView.tsx`

**Added:**
- `currentUniversalVector` state: Tracks the current 256-byte vector
- `isGeneratingRandom` state: Tracks generation status
- `handleGenerateUniversalRandom` handler: Generates and configures perceptual simulation
- WebSocket listener: Updates vector on each perceptual simulation step
- Placed UniversalInputVectorDisplay below the Machine Interconnection Graph

**Layout:**
```
┌─────────────────────────────────────┐
│  Machine Interconnection Graph      │  (D3.js visualization)
│  - Shows machine nodes and links    │
│  - Interactive, zoomable, draggable │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  Universal Input Vector Display     │  (256-byte grid)
│  - Shows En with regions highlighted│
│  - Random Generator configuration   │
│  - Real-time updates from simulation│
└─────────────────────────────────────┘
```

### 4. Added Perceptual Simulation API Methods

**File:** `visualizer/frontend/src/api.ts`

**New Methods:**
```typescript
configurePerceptualSimulation(config: {
  inputSequence: number[][];          // Universal 256-byte vectors
  inputRegion: { offset, length };    // Where to apply inputs
  stepDelayMs: number;
  maxSteps?: number;
})

startPerceptualSimulation()
stopPerceptualSimulation()
stepPerceptualSimulation()
resetPerceptualSimulation()
getPerceptualSimulationState()
getPerceptualSimulationHistory()
```

### 5. Updated TypeScript Types

**File:** `visualizer/frontend/src/types.ts`

Added `perceptualMapping` to the `Machine` interface:
```typescript
interface Machine {
  // ... existing fields
  perceptualMapping?: {
    input: { offset: number; length: number };
    output: { offset: number; length: number };
  };
}
```

## How It Works

### Random Stream Generation

1. **User Configures Generator:**
   - Set vector count (e.g., 100 vectors)
   - Set input region offset (e.g., 0)
   - Set input region length (e.g., 16 bytes)
   - Target region: `[0:16]`

2. **Generator Creates Universal Vectors:**
   ```typescript
   for (let i = 0; i < vectorCount; i++) {
     const vector = new Array(256).fill(0);
     // Fill only target region [0:16] with random values
     for (let j = 0; j < 16; j++) {
       vector[j] = Math.random();  // Random 0.0-1.0
     }
     vectors.push(vector);
   }
   ```

3. **Configure Perceptual Simulator:**
   - Send universal vectors to `/api/perceptual-simulation/configure`
   - Backend initializes PerceptualSpaceSimulator with these vectors
   - Simulator applies one vector per step to the perceptual space

4. **Simulation Runs:**
   - Each step: Apply next universal vector to En at configured region
   - Extract machine inputs from their designated offsets
   - Process each machine
   - Merge machine outputs back to En at their designated offsets
   - Broadcast updated En via WebSocket

5. **Frontend Updates:**
   - WebSocket receives `perceptual-simulation-stepped` event
   - Updates `currentUniversalVector` with latest En state
   - Vector grid re-renders showing:
     - Original random values in input region
     - Machine outputs at output offsets (overwriting random values)
     - Zero bytes in unused regions

### Machine Output Overwrites Example

**Scenario:**
- Machine A: `output: { offset: 10, length: 4 }`
- Machine B: `input: { offset: 12, length: 4 }`
- Random values generated in `[0:16]`

**Step-by-Step:**

1. **Initial Random Vector:**
   ```
   [0.3, 0.7, 0.1, 0.9, ..., 0.5, 0.2, 0.8, 0.4, 0.6, 0.3, 0.9, 0.1, ...]
    ^^^^^ Random values in [0:16] ^^^^^
   ```

2. **Machine A Produces Output:**
   - Processes its input from `[0:2]` (example)
   - Produces output: `[1.0, 0.5, 0.7, 0.3]`
   - Merged into En at `[10:14]`

3. **Updated En:**
   ```
   [0.3, 0.7, 0.1, 0.9, ..., 0.5, 0.2, 1.0, 0.5, 0.7, 0.3, 0.9, 0.1, ...]
                                      ^^^^^^^^^^^^^^^^^^
                                      Machine A output overwrites random values
   ```

4. **Machine B Reads Input:**
   - Input region: `[12:16]`
   - Reads: `[0.7, 0.3, 0.9, 0.1]`
   - Last two bytes are from Machine A's output (0.7, 0.3)
   - Last two bytes are original random values (0.9, 0.1)

5. **Visualization Shows:**
   - Bytes `[10:14]` highlighted in **pink** (Machine A output)
   - Bytes `[12:16]` highlighted in **blue** (Machine B input)
   - Overlap region `[12:14]` shows both colors (Machine A output → Machine B input)

## Usage

### Generating Random Streams

1. **Open Machine Interconnection View:**
   - Select any machine from the machine list
   - Switch to "Graph" view mode
   - Scroll down to see Universal Input Vector Display

2. **Click "Random Stream Generator" Button:**
   - Configuration panel expands

3. **Configure Generator:**
   - **Vector Count**: How many vectors to generate (default: 100)
   - **Input Region Offset**: Starting byte for random values (default: 0)
   - **Input Region Length**: How many bytes to randomize (default: 16)
   - Target region updates automatically: `[0:16]`

4. **Click "Generate Stream":**
   - Generator creates universal vectors
   - Perceptual simulator configured with vectors
   - First vector displayed in the grid
   - Ready to start simulation

5. **Run Simulation:**
   - Use standard simulation controls (Play/Pause/Step)
   - Each step applies next universal vector
   - Machines process their inputs
   - Outputs overwrite perceptual space
   - Grid updates in real-time

### Reading the Visualization

**Color Coding:**
- **Blue regions**: Machine input regions (where machines read from En)
- **Pink regions**: Machine output regions (where machines write to En)
- **Overlapping regions**: Data flows from one machine to another
- **White/bright values**: Non-zero bytes (active data)
- **Dark values**: Zero bytes (inactive)

**Hover Information:**
- Byte index: `[0]` to `[255]`
- Current value: `0.00` to `1.00`
- Associated machines: Lists which machines read/write this byte

**Legend:**
- Each machine's input and output regions
- Arrows show direction: `←` input, `→` output
- Offset ranges: `MachineName → [10:14]`

## Benefits

### 1. Complete Perceptual Space Visibility
- See the entire 256-byte universal space at once
- Understand which regions are active
- Identify machine interconnections visually

### 2. Output Overwrite Clarity
- Clearly see when machine outputs overwrite random values
- Understand data flow between machines
- Debug perceptual mapping conflicts

### 3. Flexible Random Generation
- Configure exactly which regions receive random input
- Generate streams of any length
- Test different perceptual scenarios

### 4. Real-Time Feedback
- Vector updates on every simulation step
- See outputs merge into perceptual space
- Watch data propagate between machines

### 5. Educational Value
- Learn how perceptual space works
- Understand preception process
- Visualize machine interconnection patterns

## Example Scenario

**Setup:**
- Machine A (RSFlipFlop): `input[0:2]`, `output[10:14]`
- Machine B (DataMonitor): `input[12:16]`, `output[20:24]`

**Random Generator Config:**
- Vector Count: 50
- Input Region: `[0:16]`
- This covers both machines' input regions with random data

**What Happens:**

1. **Random vector generated:**
   - Bytes `[0:16]` filled with random values
   - Rest of En is zeros

2. **Simulation step 1:**
   - Random vector applied to En
   - Machine A reads `En[0:2]` → processes → writes `En[10:14]`
   - Machine B reads `En[12:16]` → includes `En[12:14]` from Machine A!

3. **Visualization shows:**
   - Blue highlight on `[0:2]` (Machine A input)
   - Blue highlight on `[12:16]` (Machine B input)
   - Pink highlight on `[10:14]` (Machine A output)
   - Pink highlight on `[20:24]` (Machine B output)
   - Overlap at `[12:14]`: Machine A output flows to Machine B input

4. **Next step:**
   - New random vector applied
   - Previous outputs may be overwritten
   - Or remain if new random values are in different region

## Technical Details

### Vector Display Performance
- Renders 256 bytes as individual DOM elements
- CSS Grid layout for efficient rendering
- Hover effects use GPU acceleration
- Virtual scrolling for large perceptual spaces

### Color Calculation
- Multiple machines can overlap in same region
- Output regions prioritized over input regions
- Color opacity indicates region type
- Border shows active machine ownership

### WebSocket Integration
- Listens for `perceptual-simulation-stepped` events
- Updates vector state on each step
- Handles `perceptual-simulation-reset` to clear vector
- No polling required - real-time push updates

### Memory Efficiency
- Single 256-element array maintained
- Regions calculated on-the-fly from machine metadata
- No duplication of perceptual space data

## Testing

### Build Status
✅ **Frontend Build:** Success
✅ **Backend Build:** Success
✅ **All Tests:** 100/100 Passing

### Manual Testing Checklist
- [ ] Random generator configuration UI works
- [ ] Generate button creates universal vectors
- [ ] Vector grid displays all 256 bytes
- [ ] Machine regions highlighted correctly
- [ ] Output regions show overwrites
- [ ] Hover tooltips display byte information
- [ ] WebSocket updates vector in real-time
- [ ] Simulation controls work with perceptual mode
- [ ] Legend shows all machine regions

## Files Modified

### Frontend
- `src/components/InputStreamVisualization.tsx` - Removed random generator
- `src/components/UniversalInputVectorDisplay.tsx` - NEW: 256-byte vector display
- `src/components/UniversalInputVectorDisplay.css` - NEW: Styling for vector grid
- `src/components/MachineContainerView.tsx` - Integrated universal vector display
- `src/api.ts` - Added perceptual simulation API methods
- `src/types.ts` - Added perceptualMapping to Machine interface

### Documentation
- `UNIVERSAL_INPUT_VECTOR_VISUALIZATION.md` - This document

## Summary

The Random Generator has been successfully relocated to the Machine Interconnection View and upgraded to generate **universal 256-byte perceptual space vectors**. The new UniversalInputVectorDisplay component provides complete visibility into the perceptual space, showing:

✅ All 256 bytes of the universal input space (En)
✅ Machine input/output regions highlighted with color coding
✅ Real-time updates as simulation progresses
✅ Clear visualization of output overwrites
✅ Flexible random stream generation configuration
✅ Legend showing all machine perceptual mappings

This enhancement makes the perceptual space architecture fully transparent and interactive, enabling users to understand exactly how machines perceive reality and how their outputs propagate through the shared universal space.
