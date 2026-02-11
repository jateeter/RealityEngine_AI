# Quick Start: Universal Input Vector Display

## Overview

The Reality Engine now includes a **Universal Input Vector Display** that visualizes the complete 256-byte perceptual space (En) where all machines perceive and interact with reality.

## Accessing the Visualization

### 1. Start the System

```bash
./scripts/start.sh
```

Wait for all services to start (about 30-60 seconds). You'll see:
```
Reality Engine Started Successfully! (Docker Mode)
All Services Running:
  - Visualizer Frontend:   http://localhost:5173
```

### 2. Open the Visualizer

Open your browser to: **http://localhost:5173**

You'll see a list of available machines:
- RS Flip Flop
- RS2
- Multi-Step State Machine
- Kleene Star Operator
- And 14 more example machines

### 3. Load a Machine

Click on any machine with perceptual mappings. Recommended:
- **RS Flip Flop** - Simple 2-input, 2-output machine
- **Multi-Step State Machine** - 3-input, 2-output with state transitions

### 4. Switch to Graph View

At the top of the machine container, click the **"🔗 Interconnections"** button.

You'll now see two visualizations:

#### Top Section: Machine Interconnection Graph
- D3.js force-directed graph showing all machines as nodes
- Lines connect machines with overlapping perceptual regions
- Drag nodes to rearrange
- Zoom with mouse wheel
- Hover over nodes for details

#### Bottom Section: Universal Input Vector Display
- **256-byte grid** showing the complete perceptual space (En)
- **16 bytes per row** for easy reading
- **Color-coded regions**:
  - 🔵 Blue: Machine input regions
  - 🌸 Pink: Machine output regions
- **Hex offset labels** (00, 10, 20, ..., F0) on the left

### 5. Generate Random Stream

Scroll down to the Universal Input Vector Display section and click **"🎲 Random Stream Generator"**.

Configure the generator:
1. **Vector Count**: 100 (how many vectors to generate)
2. **Input Region Offset**: 0 (starting byte)
3. **Input Region Length**: 16 (how many bytes)
4. **Target Region**: Shows `[0:16]` automatically

Click **"Generate Stream"**.

You'll see:
- The 256-byte grid populated with random values in the target region `[0:16]`
- Machine output regions highlighted in pink
- Machine input regions highlighted in blue
- Legend showing which machines read/write which bytes

### 6. Run the Simulation

Use the controls in the **left sidebar**:

- **▶ Play**: Run simulation continuously
- **⏸ Pause**: Pause the simulation
- **⏭ Step**: Advance one step at a time
- **🔄 Reset**: Reset to beginning

Watch the Universal Input Vector Display as the simulation runs:
- Each step applies the next random vector to En
- Machines read from their input regions (blue)
- Machines process the inputs through their sequences
- Machine outputs overwrite En at their output regions (pink)
- The grid updates in real-time showing the current perceptual space

### 7. Observe Data Flow

Look for **overlapping regions** in the grid:

**Example with current machines:**
- **Multi-Step State Machine**:
  - Input: `[0:3]` (bytes 0, 1, 2)
  - Output: `[3:5]` (bytes 3, 4)
- **RS Flip Flop**:
  - Input: `[3:5]` (bytes 3, 4) ← **Overlaps with Multi-Step output!**
  - Output: `[6:8]` (bytes 6, 7)

This means:
1. Random values fill `[0:3]`
2. Multi-Step processes them → outputs to `[3:5]`
3. RS Flip Flop reads `[3:5]` → **receives Multi-Step's output!**
4. RS Flip Flop processes → outputs to `[6:8]`

Data flows: Random → Multi-Step → RS Flip Flop

## Understanding the Visualization

### Byte Cell Colors

Each byte in the 256-element grid shows:
- **Value**: 0.0 to 1.0 (displayed with one decimal place)
- **Background color**:
  - Blue tint: Part of a machine's input region
  - Pink tint: Part of a machine's output region
  - Both: Overlap (one machine's output feeds another's input)
  - Dark: Unused region (no machine reads/writes here)
- **Border color**: Matches the machine that owns this region

### Hover Information

Hover over any byte to see:
```
[12] = 0.73
Multi-Step State Machine output
RS Flip Flop input
```

This tells you:
- Byte index: 12
- Current value: 0.73
- Which machines use this byte

### Legend

The legend at the bottom shows all machine regions:
```
Multi-Step State Machine ← [0:3]   (input region)
Multi-Step State Machine → [3:5]   (output region)
RS Flip Flop ← [3:5]               (input region)
RS Flip Flop → [6:8]               (output region)
...
```

Arrows indicate direction:
- `←` = Input (machine reads from En)
- `→` = Output (machine writes to En)

## Key Features

### Real-Time Updates
- Vector grid updates every simulation step
- No refresh needed - uses WebSocket for live updates
- See machine outputs overwrite random values instantly

### Machine Output Overwrites
- Random generator fills target region with random values
- As simulation runs, machine outputs **overwrite** these random values at their designated offsets
- Next step: New random vector applied, but outputs persist until overwritten again
- Creates dynamic data flow between machines

### Flexible Configuration
- Generate any number of vectors (1-1000)
- Target any region of the 256-byte space
- Test different perceptual scenarios
- See how machines interconnect through shared regions

## Example Workflow

### Scenario: Test Data Flow Between Machines

1. **Start** the system: `./scripts/start.sh`
2. **Open** http://localhost:5173
3. **Load** "Multi-Step State Machine"
4. **Switch** to "🔗 Interconnections" view
5. **Scroll down** to Universal Input Vector Display
6. **Click** "🎲 Random Stream Generator"
7. **Configure**:
   - Vector Count: 50
   - Input Region Offset: 0
   - Input Region Length: 10
8. **Generate** Stream
9. **Observe** the grid:
   - Bytes `[0:10]` filled with random values (target region)
   - Bytes `[0:3]` highlighted blue (Multi-Step input)
   - Bytes `[3:5]` highlighted pink (Multi-Step output)
   - Bytes `[3:5]` also highlighted blue (RS Flip Flop input) ← **Overlap!**
10. **Click** "▶ Play" in left sidebar
11. **Watch** the simulation:
    - Step 1: Random vector `[0:10]` applied
    - Multi-Step reads `[0:3]`, outputs to `[3:5]` (pink region updates)
    - RS Flip Flop reads `[3:5]` (receives Multi-Step output!), outputs to `[6:8]`
    - Step 2: Next random vector applied
    - Process repeats for all 50 vectors
12. **Pause** and **Step** through slowly to see individual overwrites

## Verification

To verify everything is working:

```bash
./scripts/verify-startup.sh
```

Expected output:
```
✓ Docker is running
✓ All 4 containers running
✓ All health endpoints responsive
✓ Frontend build includes new components
✓ Machines loaded: 18
✓ Machines with perceptual mappings: 4
```

## Troubleshooting

### Issue: Visualization not showing

**Solution:**
```bash
./scripts/stop.sh
./scripts/start.sh
```

### Issue: Port conflicts

**Solution:**
```bash
./scripts/stop-local.sh  # Stop any local services
./scripts/start.sh       # Start Docker mode
```

### Issue: Old UI (no Universal Input Vector Display)

**Solution:**
```bash
docker-compose build --no-cache visualizer-frontend
docker-compose up -d visualizer-frontend
```

## Documentation

For more details, see:
- `PERCEPTUAL_SPACE_ARCHITECTURE.md` - Complete architecture documentation
- `UNIVERSAL_INPUT_VECTOR_VISUALIZATION.md` - Detailed visualization documentation
- `STARTUP_VERIFICATION.md` - Startup process and verification guide

## Summary

The Universal Input Vector Display provides complete visibility into the perceptual space where all machines perceive and interact. Key benefits:

✅ **See the entire 256-byte perceptual space** at once
✅ **Understand data flow** between machines through overlapping regions
✅ **Watch outputs overwrite inputs** in real-time
✅ **Test different scenarios** with configurable random generation
✅ **Educational tool** for understanding perceptual computing architecture

Open http://localhost:5173, load a machine, switch to Graph view, and explore the universal perceptual space!
