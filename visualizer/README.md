# Reality Engine Visualizer

A real-time visualization application for the Reality Engine, displaying Critical Event Sequences as interactive directed network graphs.

## Features

### Views
- **Machine Selection** (home): Domain-grouped hierarchical tree — Domain → Machine → CES.  Click a machine to open its Administration view; keyboard arrow keys and Enter also navigate the tree.
- **Machine Administration**: CES graph for the selected machine with live Perception Engine source controls, output stream visualization, and a perceptual-log panel.
- **Machine Interconnection**: Force-directed graph of all machines, coloured by domain, showing shared perceptual-space regions.  Toggle-button legend panel anchored to the left edge of the graph.
- **Tobias**: Real-time AI sequence pulse canvas.

### Visualization
- **Directed CES Graphs**: CriticalEventSequences rendered as interactive directed graphs (D3 / ReactFlow)
- **Active Vector Highlighting**: Real-time green glow and pulsing for active vectors driven by live WebSocket pushes
- **Domain-Coloured Legend Panel**: Click the tab on the left edge of the machine graph to reveal the domain/edge legend
- **Perceptual Region Heatmap**: `UniversalInputVectorDisplay` shows the full elastic perceptual space with machine input/output regions colour-coded
- **3-D Graph Toggle**: Switch the interconnection view between 2-D force-directed and 3-D layouts
- **Reactive Windowing**: Smooth zoom, pan, and fit controls

### Perception Engine Controls
- **Auto-push**: Start/stop the PE push loop and configure interval (ms)
- **Manual step and reset**
- **Source management**: Add, edit, and delete test / sensor / simulated sources
- **MQTT bridge status**: Live view of broker connection and mapping registry

### Interaction
- **Keyboard Controls**: Arrow keys navigate the machine tree; graph keyboard shortcuts (F, C, +, −, arrows) control graph views
- **Interactive Nodes**: Click nodes to view detailed vector and sequence information
- **Real-time Updates**: Single persistent WebSocket connection (`ws://localhost:3001/ws`) drives all live state updates
- **Non-invasive**: Separate application that does not modify the Reality Engine

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Reality Engine                          │
│                   (Port 3000 - Core)                        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP API
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Visualizer Backend (Node.js)                   │
│                   (Port 3001 - Proxy)                       │
│  - Proxies requests to Reality Engine                       │
│  - Transforms data for graph visualization                  │
│  - Provides WebSocket for real-time updates                 │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP + WebSocket
                         │
┌────────────────────────▼────────────────────────────────────┐
│             Visualizer Frontend (React)                     │
│                  (Port 5173 - Vite Dev)                     │
│  - Interactive graph visualization (ReactFlow)              │
│  - Keyboard and mouse controls                              │
│  - Real-time active vector highlighting                     │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+ and npm
- Reality Engine running on port 3000 (default)

## Installation

### Backend Setup

```bash
cd visualizer/backend
npm install
npm run build
```

### Frontend Setup

```bash
cd visualizer/frontend
npm install
npm run build
```

## Running the Application

### 1. Start the Reality Engine (if not already running)

```bash
# From the root directory
npm run dev
# or
npm start
```

The Reality Engine should be running on `http://localhost:3000`

### 2. Start the Visualizer Backend

```bash
cd visualizer/backend
npm run dev
# or for production
npm start
```

The backend will run on `http://localhost:3001`

### 3. Start the Visualizer Frontend

```bash
cd visualizer/frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Keyboard Controls

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `F` | Fit view to show all nodes |
| `C` | Center view |
| `Arrow Keys` | Pan view in direction |

## Visual Indicators

### Node Colors

- **Blue Border**: Initial vector (always active at start)
- **Green Border + Glow**: Active vector
- **Purple Lightning**: Vector has output
- **Amber Border**: Selected node

### Node States

- **Pulsing Green Dot**: Active state indicator
- **INIT Badge**: Initial vector badge
- **ACTIVE Label**: Current active status
- **⚡ Symbol**: Has output vectors

## API Endpoints

The visualizer backend exposes these endpoints (all proxied or assembled by the backend on port 3001):

### Visualizer Data
- `GET /api/viz/sequences` - All CES sequences with graph node/edge data
- `GET /api/viz/sequences/:id` - Single CES sequence graph
- `GET /api/viz/paging-decisions` - Resolved governance paging decisions (RAG table)

### Machine Management
- `GET /api/machines` - List all loaded machines (supports `?domain=` filter)
- `GET /api/machines/:id` - Get single machine
- `POST /api/machines` - Create machine
- `PATCH /api/machines/:id` - Partial update
- `PUT /api/machines/:id` - Full replace
- `DELETE /api/machines/:id` - Delete machine
- `GET /api/machines/:id/export` - Export machine as JSON
- `GET /api/machines/json/list` - List machine JSON files on disk
- `GET /api/machines/json/:name` - Get machine JSON file contents
- `POST /api/machines/json/import` - Import machine JSON from disk into the engine
- `GET /api/machine-graph` - Machine interconnection graph (all machines, domains, shared regions)

### Perceptual Simulation
- `GET /api/perceptual-simulation/state` - Current simulation state
- `GET /api/perceptual-simulation/history` - Simulation step history
- `POST /api/perceptual-simulation/configure/chunk` - Stage a simulation configuration chunk
- `POST /api/perceptual-simulation/configure/commit` - Apply staged configuration
- `POST /api/perceptual-simulation/start` - Start simulation
- `POST /api/perceptual-simulation/stop` - Stop simulation
- `POST /api/perceptual-simulation/step` - Step simulation forward
- `POST /api/perceptual-simulation/reset` - Reset simulation

### Perception Engine (proxy to PE)
- `GET /api/perception/sources` - List PE sensor/test sources
- `GET /api/perception/mqtt/status` - MQTT bridge connection state and counters
- `GET /api/perception/mqtt/mappings` - MQTT mapping registry
- `PUT /api/perception/mqtt/mappings` - Replace and reload MQTT mapping registry
- `POST /api/perceive` - Direct perceptual input push

### Demo Sequences
- `GET /api/demo/data-center` - Data-center demo CES graph
- `GET /api/demo/multi-step` - Multi-step demo CES graph
- `GET /api/demo/kleene-star` - Kleene-star demo CES graph

### WebSocket
- `ws://localhost:3001/ws` - Real-time updates stream (active-vector highlights, MQTT ingest events, heartbeat)

## Configuration

### Backend Configuration

Create a `.env` file in `visualizer/backend/`:

```env
VIZ_PORT=3001
REALITY_ENGINE_URL=http://localhost:3000
PERCEPTION_ENGINE_URL=http://localhost:3004
```

### Frontend Configuration

The frontend proxies API requests through Vite. To change the backend URL, edit `visualizer/frontend/vite.config.ts`:

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

## Development

### Backend Development

```bash
cd visualizer/backend
npm run dev  # Uses ts-node for hot reload
```

### Frontend Development

```bash
cd visualizer/frontend
npm run dev  # Vite dev server with hot reload
```

## Production Deployment

### Build Backend

```bash
cd visualizer/backend
npm run build
npm start
```

### Build Frontend

```bash
cd visualizer/frontend
npm run build
npm run preview  # Preview production build
```

For production deployment, serve the built frontend (`dist/`) using a static file server (nginx, Apache, etc.) and run the backend as a Node.js service.

## Troubleshooting

### Cannot connect to Reality Engine

1. Ensure Reality Engine is running on port 3000
2. Check `REALITY_ENGINE_URL` in backend `.env` file
3. Verify no firewall blocking localhost connections

### Graph not updating

1. Check browser console for errors
2. Verify WebSocket connection in Network tab
3. Try manual refresh using the "Refresh Data" button
4. Check that auto-refresh is enabled

### Nodes overlapping

1. Press `F` to fit view
2. The layout uses circular arrangement - more nodes = larger radius
3. Try zooming out with `-` key

## Technology Stack

### Backend
- **Express.js**: HTTP server and REST API
- **WebSocket (ws)**: Real-time updates
- **Axios**: HTTP client for Reality Engine API
- **TypeScript**: Type safety

### Frontend
- **React 18**: UI framework
- **ReactFlow**: Graph visualization library
- **Zustand**: State management
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety
- **Axios**: HTTP client

## License

MIT
