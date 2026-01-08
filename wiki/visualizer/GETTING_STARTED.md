# Getting Started with Reality Engine Visualizer

This guide will help you get the Reality Engine Visualizer up and running quickly.

## Quick Start (Automated)

The easiest way to start all services:

```bash
# From the visualizer directory
./start-all.sh
```

This will start:
1. Reality Engine (port 3000)
2. Visualizer Backend (port 3001)
3. Visualizer Frontend (port 5173)

Then open `http://localhost:5173` in your browser.

To stop all services:

```bash
./stop-all.sh
```

## Manual Setup (Step by Step)

### Step 1: Start Reality Engine

From the root directory:

```bash
npm run dev
```

The Reality Engine should start on `http://localhost:3000`

### Step 2: Create Demo Sequences (Optional but Recommended)

To populate the Reality Engine with demo sequences for visualization:

```bash
# Make sure you're in the root directory
npx ts-node visualizer/demo-setup.ts
```

This creates three example sequences:
- **Linear State Machine**: Simple 3-vector linear flow
- **Branching Detector**: Detector that branches to 2 paths
- **Complex Event Network**: Multi-initial, multi-path network

### Step 3: Start Visualizer Backend

Open a new terminal:

```bash
cd visualizer/backend
npm run dev
```

The backend will start on `http://localhost:3001`

### Step 4: Start Visualizer Frontend

Open another terminal:

```bash
cd visualizer/frontend
npm run dev
```

The frontend will start on `http://localhost:5173`

### Step 5: Open in Browser

Navigate to `http://localhost:5173`

You should see the Reality Engine Visualizer with:
- Sidebar showing all sequences
- Statistics panel
- Graph visualization area

## Using the Visualizer

### Navigating the Interface

#### Sidebar (Left)
- **Connection Status**: Green dot = connected to Reality Engine
- **Statistics**: Total sequences, vectors, and active vectors
- **Refresh Button**: Manually refresh data from Reality Engine
- **Sequence List**: Click any sequence to visualize it

#### Main Canvas (Center)
- **Sequence Name**: Current sequence being viewed (top-left)
- **Graph Visualization**: Directed network of vectors
- **Controls**: Zoom, pan, fit view controls (bottom-right)
- **Keyboard Shortcuts**: Help panel (bottom-left)

#### Info Panel (Right)
- Appears when you click a node
- Shows detailed vector information
- Displays vector elements, outputs, and metadata
- Click X to close

### Keyboard Controls

| Key | Action |
|-----|--------|
| `+` or `=` | Zoom in |
| `-` or `_` | Zoom out |
| `F` | Fit view (show all nodes) |
| `C` | Center view |
| `Arrow Up` | Pan up |
| `Arrow Down` | Pan down |
| `Arrow Left` | Pan left |
| `Arrow Right` | Pan right |

### Mouse Controls

- **Click and Drag**: Pan the canvas
- **Mouse Wheel**: Zoom in/out
- **Click Node**: Show node details in info panel
- **Click Background**: Deselect node

## Understanding the Visualization

### Node Colors and Indicators

#### Border Colors
- **Blue**: Initial vector (always starts active)
- **Green with Glow**: Currently active vector
- **Amber**: Selected node
- **Gray**: Inactive vector

#### Badges and Icons
- **INIT**: Initial vector badge (blue)
- **ACTIVE**: Currently active label with pulsing dot
- **⚡ Lightning**: Vector has output vectors
- **+ metadata**: Vector has additional metadata

#### Edges (Arrows)
- **Green Animated Arrows**: Show transition paths between vectors
- **Direction**: Points from source to target vector

### Node Information

Click any node to see:
- **Label**: Short identifier
- **ID**: Full UUID
- **Status**: Initial, Active, Has Output badges
- **Vector Elements**: Dimension, value, comparator type, threshold
- **Output Vectors**: What gets asserted when matched
- **Metadata**: Additional custom data

## Testing the Visualization

### Processing Inputs

You can process inputs through the Reality Engine API to see the visualization update:

```bash
# Example: Process input for Linear State Machine
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1, 0.2]}'
```

After processing, click "Refresh Data" in the visualizer to see:
- Active vectors change (green glow)
- Transitions occur
- New outputs generated

### Demo Sequence Test Cases

If you ran the demo setup, try these:

#### Sequence 1: Linear State Machine
```bash
# Step 1: Start -> Process
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1, 0.2]}'

# Step 2: Process -> End
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.5, 0.6]}'

# Step 3: End (final state)
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.9, 0.9]}'
```

#### Sequence 2: Branching Detector
```bash
# Activate detector
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.5]}'

# Take path A (low value)
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.3]}'

# Or reset and take path B (high value)
curl -X POST http://localhost:3000/api/sequences/{SEQUENCE_ID}/reset
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.7]}'
```

## Advanced Features

### Auto-Refresh

The visualizer automatically refreshes every 2 seconds to show real-time updates. This means:
- Active vectors update automatically
- New sequences appear automatically
- Statistics update in real-time

### WebSocket Support (Future)

The backend includes WebSocket support for push-based updates. This will enable instant visualization updates without polling.

### Multiple Sequences

The visualizer can handle multiple sequences simultaneously:
- Each sequence is visualized independently
- Switch between sequences using the sidebar
- All sequences refresh together

## Troubleshooting

### Visualizer shows "No sequences available"

1. Check Reality Engine is running: `http://localhost:3000/api/health`
2. Create demo sequences: `npx ts-node visualizer/demo-setup.ts`
3. Check backend logs for connection errors

### Nodes overlapping

1. Press `F` to fit view
2. Zoom out with `-` key
3. Nodes are arranged in a circle - more nodes = larger circle

### Backend connection errors

1. Verify Reality Engine is on port 3000
2. Check `.env` file in `visualizer/backend/`
3. Ensure no firewall blocking localhost

### Frontend won't start

1. Check Node version (requires 18+, may work on 16)
2. Clear node_modules: `rm -rf node_modules && npm install`
3. Check port 5173 is not in use

### Graph not updating after processing input

1. Click "Refresh Data" button manually
2. Check auto-refresh is enabled (should be by default)
3. Verify input was processed: check Reality Engine logs
4. Verify sequence state: `http://localhost:3000/api/sequences`

## Architecture Overview

```
┌─────────────────┐
│ Reality Engine  │  (Port 3000)
│  - Core Engine  │  - Manages sequences
│  - REST API     │  - Processes inputs
└────────┬────────┘
         │ HTTP
         │
┌────────▼────────┐
│ Viz Backend     │  (Port 3001)
│  - Proxy Server │  - Transforms data to graph format
│  - WebSocket    │  - Real-time updates (future)
└────────┬────────┘
         │ HTTP + WS
         │
┌────────▼────────┐
│ Viz Frontend    │  (Port 5173)
│  - React App    │  - Interactive graph visualization
│  - ReactFlow    │  - Keyboard/mouse controls
└─────────────────┘
```

## Next Steps

1. **Create your own sequences**: Use the Reality Engine API
2. **Process inputs**: Watch the visualization update in real-time
3. **Explore complex networks**: Build multi-path sequences
4. **Customize**: Modify node styles in `VectorNode.tsx`
5. **Extend**: Add new features to the visualizer

## Support

For issues or questions:
- Check the main README: `visualizer/README.md`
- Review Reality Engine docs: Root `README.md`
- Check API documentation: `http://localhost:3000/`

Enjoy visualizing your Reality Engine sequences!
