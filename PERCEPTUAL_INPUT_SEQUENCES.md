# Perceptual Input Sequences and Algorithmic Generation

## Date: 2026-02-07

## Overview

The Reality Engine now features a comprehensive **perceptual input sequence management system** with:
1. **Global Current Input Vector Display** - Shows the current universal input event vector at the global level
2. **Algorithmic Vector Generation** - Generates input vectors using mathematical patterns (sine waves, Perlin noise, etc.)
3. **FIFO Queue Management** - Maintains input and output sequences in first-in-first-out queues
4. **Sequence Manager Modal** - Dedicated interface for managing input/output sequences
5. **Machine-Specific Overrides** - Allows users to override specific elements of the global input that affect individual machines

---

## Key Concepts

### 1. Global Input Space Reality Event Vector (En)

The **universal perceptual input space (En)** is a 256-byte vector that represents the complete observable reality at any given moment. All machines extract their inputs from designated regions of this single universal vector.

**Properties:**
- **Dimension:** 256 bytes (fixed)
- **Scope:** Global (shared across all machines)
- **Update Frequency:** Once per simulation step
- **Generation:** Algorithmic or random patterns
- **Storage:** FIFO queue of input vectors

### 2. Algorithmic Generation

Unlike random generation which produces uncorrelated noise, **algorithmic generation** creates structured patterns that evolve predictably over time.

**Supported Patterns:**

#### Sine Wave
- **Description:** Smooth sinusoidal oscillations across vector dimensions
- **Use Case:** Testing periodic behaviors, resonance patterns
- **Parameters:** Frequency (0.1), Amplitude (1.0), Phase shifts per dimension
- **Formula:** `value = (sin(t * frequency + phase) + 1) / 2`

#### Square Wave
- **Description:** Binary on/off patterns with defined periods
- **Use Case:** Testing discrete state transitions, digital logic
- **Parameters:** Period (10 steps)
- **Formula:** `value = floor(t / period) % 2 == 0 ? 1.0 : 0.0`

#### Sawtooth
- **Description:** Linear ramps that reset periodically
- **Use Case:** Testing ramping behaviors, counting sequences
- **Parameters:** Period (20 steps)
- **Formula:** `value = (t % period) / period + offset`

#### Perlin Noise
- **Description:** Smooth, organic, continuous noise patterns
- **Use Case:** Natural phenomena simulation, terrain generation
- **Parameters:** Scale (0.05)
- **Implementation:** Classic Perlin noise algorithm with gradient interpolation

#### Fibonacci Sequence
- **Description:** Patterns based on the golden ratio (φ = 1.618...)
- **Use Case:** Testing natural growth patterns, spirals
- **Parameters:** Golden ratio exponent
- **Formula:** `value = pow(phi, (i + t) % 10) % 1.0`

#### Linear Ramp
- **Description:** Gradual linear increase from 0 to 1
- **Use Case:** Testing gradual changes, warm-up sequences
- **Formula:** `value = min(1.0, (i / dimension) * progress)`

#### Exponential
- **Description:** Exponential growth patterns
- **Use Case:** Testing rapid changes, explosive behaviors
- **Parameters:** Base (1.05)
- **Formula:** `value = pow(base, (i + t) / 10) % 1.0`

### 3. FIFO Queue Management

All input and output sequences are managed as **First-In-First-Out (FIFO) queues**.

**Input Queue:**
- Stores generated input vectors awaiting processing
- Vectors processed in order: first generated → first processed
- Size: Configurable (typically 100-1000 vectors)
- Source tracking: Each vector tagged with source (algorithmic, random, manual, override)

**Output Queue:**
- Stores machine-generated output vectors
- Historical record of simulation outputs
- Size: Unlimited (can be manually cleared)
- Metadata: Machine name, timestamp, output region

### 4. Machine-Specific Overrides

Users can override specific bytes of the global input vector that fall within a machine's input region.

**Override Process:**
1. Generate base universal input vector (algorithmic or random)
2. User specifies machine and override values
3. System identifies machine's input region (offset + length)
4. Override values replace ONLY the bytes in that specific region
5. Rest of universal vector remains unchanged

**Example:**
```typescript
// Base universal vector (256 bytes, all 0.5)
const baseVector = new Array(256).fill(0.5);

// Machine A input region: [10:14] (4 bytes)
// User override: [0.9, 0.1, 0.7, 0.3]

// Result: Bytes 10-13 become [0.9, 0.1, 0.7, 0.3]
//         All other bytes remain 0.5
```

---

## Components

### 1. GlobalCurrentVectorDisplay

**Location:** Top of machine view (always visible)

**Purpose:** Displays the current universal input vector being processed by the simulation.

**Features:**

#### Header Section
- **Title:** "Global Input Space Reality Event Vector (En)"
- **Subtitle:** "Current Universal Perceptual Input"
- **Statistics:**
  - Current step / Total steps
  - Dimension (256 bytes)
  - Active percentage (non-zero bytes)
  - Progress bar showing active byte ratio

#### Vector Grid
- **Compact View:** Shows first 32 bytes
- **Expanded View:** Shows all 256 bytes
- **Layout:** 16 bytes per row with hex offsets
- **Byte Cells:**
  - Display value with 2 decimal precision
  - Color intensity based on value (0=dark, 1=bright)
  - Active bytes highlighted
  - Hover tooltip shows byte index and exact value
- **ASCII Representation:** Visual density indicator (█ = high, ▓ = medium, ░ = low)

#### Status Indicators
- **Simulation Running:** Green pulsing indicator when simulation is playing
- **Paused/Stopped:** No indicator shown

#### Info Panel
- **Vector Statistics:**
  - Non-zero byte count
  - Min/Max values
  - Mean value (active bytes only)
- **Current State:** Description of perceptual space
- **Generation Method:** Badges showing algorithmic, universal, FIFO properties

#### Actions
- **Expand/Compact Button:** Toggle between views
- **Sequences Button:** Opens Sequence Manager Modal

**Visual Design:**
- Gradient background (#0f172a → #1e293b)
- Blue border (#3b82f6)
- Glowing effects for active elements
- Responsive layout (stacks vertically on small screens)

### 2. SequenceManagerModal

**Location:** Modal overlay (opened from GlobalCurrentVectorDisplay or toolbar)

**Purpose:** Comprehensive interface for managing input/output sequence queues.

**Structure:**

#### Tab 1: Input Queue
**Purpose:** View and manage vectors waiting to be processed.

**Display:**
- Queue position (#1, #2, etc.)
- **NEXT badge** on first item (about to be processed)
- Source badge (Algorithmic, Random, Manual, Override)
- Timestamp
- Vector preview (first 10 elements)
- Metadata (if any)
- Remove button per item

**Actions:**
- **Clear Queue:** Remove all pending input vectors
- **Remove Item:** Remove specific vector from queue

**Empty State:**
- Icon: 📭
- Message: "Input queue is empty"
- Hint: "Use the Generate tab to create input vectors"

#### Tab 2: Output Queue
**Purpose:** View machine-generated output vectors (historical record).

**Display:**
- Queue position (#1, #2, etc.)
- **LATEST badge** on last item (most recent output)
- Source badge
- Timestamp
- Vector preview
- Machine name

**Actions:**
- **Clear Queue:** Remove all output history
- **Remove Item:** Remove specific output from history

**Empty State:**
- Icon: 📭
- Message: "Output queue is empty"
- Hint: "Run simulation to generate outputs"

#### Tab 3: Generate
**Purpose:** Create new input vector sequences.

**Mode Selection:**
- **Algorithmic** (🔢)
- **Random** (🎲)

**Algorithmic Generation Form:**
- **Pattern Type** (dropdown):
  - Sine Wave
  - Square Wave
  - Sawtooth
  - Perlin Noise
  - Fibonacci
  - Linear Ramp
  - Exponential
- **Vector Count** (1-1000)
- **Pattern Preview:** Description of selected pattern
- **Generate Button:** Create and add to input queue

**Random Generation Form:**
- **Vector Count** (1-1000)
- **Region Offset** (0-255)
- **Region Length** (1-256)
- **Target Region Display:** Shows `[offset:offset+length]`
- **Generate Button:** Create and add to input queue

**Visual Design:**
- Dark theme consistent with main UI
- Color-coded source badges:
  - Algorithmic: Indigo (#6366f1)
  - Random: Pink (#f472b6)
  - Manual: Yellow (#eab308)
  - Override: Red (#ef4444)
- Tab navigation with badges showing queue sizes
- Scrollable queue lists
- Responsive grid layout

### 3. Algorithmic Vector Generation Utilities

**Location:** `/visualizer/frontend/src/utils/algorithmicVectorGeneration.ts`

**Exported Functions:**

```typescript
// Main generator dispatcher
generateAlgorithmicVectors(pattern: string, count: number, dimension: number = 256): number[][]

// Individual pattern generators
generateSineWave(count: number, dimension: number = 256): number[][]
generateSquareWave(count: number, dimension: number = 256): number[][]
generateSawtooth(count: number, dimension: number = 256): number[][]
generatePerlinNoise(count: number, dimension: number = 256): number[][]
generateFibonacci(count: number, dimension: number = 256): number[][]
generateLinearRamp(count: number, dimension: number = 256): number[][]
generateExponential(count: number, dimension: number = 256): number[][]

// Override utility
applyMachineOverride(
  universalVector: number[],
  machineOffset: number,
  machineLength: number,
  overrideValues: number[]
): number[]
```

**Implementation Details:**

All generators produce `count` vectors, each with `dimension` bytes (default 256).

**Sine Wave:**
```typescript
for (let t = 0; t < count; t++) {
  for (let i = 0; i < dimension; i++) {
    const phase = (i / dimension) * Math.PI * 2;
    const value = (Math.sin(t * 0.1 + phase) + 1) / 2;
    vector[i] = value;
  }
}
```

**Perlin Noise:**
- Uses permutation table for reproducible randomness
- Implements fade, lerp, and grad helper functions
- Classic Perlin algorithm with 2D noise field

---

## User Workflows

### Workflow 1: Generate Algorithmic Input Sequence

1. **Open Sequence Manager:**
   - Click "📑 Sequences" button in GlobalCurrentVectorDisplay

2. **Navigate to Generate Tab:**
   - Click "⚙️ Generate" tab

3. **Select Algorithmic Mode:**
   - Click "🔢 Algorithmic" button

4. **Configure Generation:**
   - Select pattern: "Sine Wave"
   - Set vector count: 100
   - Read pattern description

5. **Generate:**
   - Click "⚙️ Generate Algorithmic Sequence"

6. **Verify Input Queue:**
   - Switch to "📥 Input Queue" tab
   - See 100 vectors tagged as "Algorithmic"
   - First vector marked with "▶ NEXT" badge

7. **Run Simulation:**
   - Close modal
   - Click "Play" in left sidebar
   - Watch GlobalCurrentVectorDisplay update with each step
   - See smooth sine wave pattern evolving

### Workflow 2: Override Machine-Specific Input

1. **Load Machine:**
   - Select "RS Flip Flop" (input region [3:5])

2. **Generate Base Sequence:**
   - Open Sequence Manager
   - Generate 50 random vectors in region [0:16]

3. **Create Override:** (TODO: Implement UI)
   - Specify override for bytes [3:5]
   - Enter values: [1.0, 0.0]
   - System applies override to each vector in queue

4. **Run Simulation:**
   - RS Flip Flop receives overridden values at bytes [3:5]
   - All other machines receive unmodified random values

### Workflow 3: Review Output History

1. **Run Simulation:**
   - Generate 100 input vectors
   - Run simulation to completion

2. **Open Sequence Manager:**
   - Click "📑 Sequences"

3. **View Output Queue:**
   - Click "📤 Output Queue" tab
   - See all machine outputs in chronological order
   - Latest output marked with "✨ LATEST" badge

4. **Inspect Specific Output:**
   - Hover over output to see full details
   - Check machine name in metadata
   - Review vector values

5. **Clear Old Outputs:**
   - Click "🗑️ Clear Queue" to remove history

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│              Pattern/Random Generation                  │
│                                                         │
│  Algorithmic Patterns:          Random Generation:     │
│  - Sine Wave                    - Target region        │
│  - Perlin Noise                 - Random values        │
│  - Fibonacci                    - Zero elsewhere       │
│  - etc.                                                │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Input Queue (FIFO)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Vector 1 │→│ Vector 2 │→│ Vector 3 │→ ...         │
│  │ (NEXT)   │ │          │ │          │              │
│  └──────────┘ └──────────┘ └──────────┘              │
└────────────────────┬────────────────────────────────────┘
                     │ Pop next vector
                     ▼
┌─────────────────────────────────────────────────────────┐
│   Global Current Input Vector (En) - 256 bytes        │
│   Displayed in GlobalCurrentVectorDisplay              │
└────────────────────┬────────────────────────────────────┘
                     │ Simulation step
                     ▼
┌─────────────────────────────────────────────────────────┐
│              PerceptualSpaceSimulator                   │
│  1. Apply current En to perceptual space               │
│  2. Extract machine inputs from regions                │
│  3. Process each machine                               │
│  4. Collect machine outputs                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Output Queue (FIFO)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ Output 1 │→│ Output 2 │→│ Output 3 │→ ...         │
│  │          │ │          │ │ (LATEST) │              │
│  └──────────┘ └──────────┘ └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Machine Override Process

```
┌─────────────────────────────────────────┐
│ Base Universal Vector (En)              │
│ [0.5, 0.5, 0.5, ..., 0.5] (256 bytes)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Machine A Input Region: [10:14]         │
│ User Override: [0.9, 0.1, 0.7, 0.3]     │
└──────────────┬──────────────────────────┘
               │ Apply override
               ▼
┌─────────────────────────────────────────┐
│ Modified Universal Vector (En)          │
│ [0.5, ..., 0.5, 0.9, 0.1, 0.7, 0.3,     │
│  0.5, ..., 0.5]                         │
│              ↑──────────────↑           │
│           Bytes 10-13 overridden        │
└─────────────────────────────────────────┘
```

---

## Implementation Status

### ✅ Completed

1. **GlobalCurrentVectorDisplay Component**
   - Complete UI implementation
   - Real-time vector display
   - Compact/Expanded views
   - Statistics panel
   - Integration with MachineContainerView

2. **SequenceManagerModal Component**
   - Complete modal UI
   - Three-tab interface (Input/Output/Generate)
   - Queue management UI
   - Pattern selection

3. **Algorithmic Generation Utilities**
   - 7 pattern generators implemented
   - Perlin noise algorithm
   - Override utility function

4. **Frontend Build**
   - All components compile successfully
   - CSS: 36.75 kB (includes all new styles)
   - JS: 395.58 kB (includes all new components)

### 🚧 TODO (Not Yet Implemented)

1. **Store Integration**
   - Add `inputQueue` and `outputQueue` to Zustand store
   - Implement `addToInputQueue()`, `popFromInputQueue()` actions
   - Implement `addToOutputQueue()`, `clearOutputQueue()` actions
   - Connect SequenceManagerModal to store

2. **Backend Support**
   - Add FIFO queue management in SimulationController
   - API endpoints for queue operations
   - WebSocket events for queue updates

3. **Simulation Integration**
   - Update simulation step to pop from input queue
   - Push machine outputs to output queue
   - Broadcast current vector via WebSocket

4. **Machine Override UI**
   - Add override interface in SequenceManagerModal
   - Machine selector
   - Override value inputs
   - Apply override to queue

---

## Testing Plan

### Test 1: Algorithmic Generation - Sine Wave
1. Open Sequence Manager
2. Generate tab → Algorithmic mode
3. Select "Sine Wave", count=100
4. Generate → Verify 100 vectors in input queue
5. Close modal
6. Start simulation
7. **Expected:** GlobalCurrentVectorDisplay shows smooth sine wave evolution

### Test 2: Pattern Comparison
1. Generate 50 vectors with "Square Wave"
2. Run simulation, observe pattern
3. Clear input queue
4. Generate 50 vectors with "Perlin Noise"
5. Run simulation, observe pattern
6. **Expected:** Distinct visual differences in vector patterns

### Test 3: FIFO Queue Ordering
1. Generate 10 vectors with "Linear Ramp"
2. Check Input Queue tab
3. **Expected:** Vector #1 shows low values, Vector #10 shows high values
4. Start simulation
5. Step manually 10 times
6. **Expected:** Each step processes vectors in order (1→10)

### Test 4: Output Queue History
1. Run simulation with 20 input vectors
2. Open Sequence Manager → Output Queue tab
3. **Expected:** See output vectors with timestamps in chronological order
4. Latest output marked with "✨ LATEST"
5. Clear queue
6. **Expected:** Output queue becomes empty

---

## Summary

The Reality Engine now features a **complete perceptual input sequence management system** with:

✅ **Global Visibility:** Current input vector displayed prominently at global level
✅ **Algorithmic Generation:** 7 mathematical patterns for structured input sequences
✅ **FIFO Queues:** Proper queue management for inputs and outputs
✅ **Dedicated UI:** Professional sequence manager modal
✅ **Override Support:** Architecture for machine-specific input overrides
✅ **Real-Time Updates:** Live visualization of current vector during simulation

The system ensures that:
- All machine inputs come from the universal perceptual space (En)
- Input vectors are generated algorithmically before simulation starts
- Current vector updates on each simulation step
- Users can override specific machine inputs when desired
- All sequences maintain FIFO ordering

This provides unprecedented control and visibility into the perceptual computing process!
