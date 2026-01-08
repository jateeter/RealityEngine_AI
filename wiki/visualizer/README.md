# Reality Engine Visualizer

A real-time visualization application for the Reality Engine, displaying Critical Event Sequences as interactive directed network graphs.

## Features

### Visualization
- **Directed Network Graphs**: Critical Event Sequences displayed as interactive directed graphs
- **Active Vector Highlighting**: Real-time green glow and pulsing for active vectors
- **Slide-out Legend Panel**: Hover on right edge to reveal comprehensive graph legend
- **Event Space Indicators**: Visual grouping for Input and Output event spaces
- **Reactive Windowing**: Smooth zoom, pan, and fit controls
- **Clean Interface**: Production-ready appearance with minimal overlays

### Simulation Controls
- **Reality Sensing Mode**: Automatically generates random input vectors when no test data available
- **Random Vector Generator**:
  - Configurable dimension (1-128) and count (1-1000)
  - Binary Threshold option: Round values to {0.00, 1.00} for discrete event testing
  - Continuous or discrete vector generation
- **Playback Controls**:
  - Speed adjustment: 200ms to 1000ms per vector
  - Manual step-through for detailed analysis
  - Play/Pause/Reset simulation controls
- **Input Stream Visualization**: Real-time display of upcoming input vectors

### Interaction
- **Keyboard Controls**: Navigate and control visualization using keyboard shortcuts
- **Interactive Nodes**: Click nodes to view detailed vector information
- **Real-time Updates**: WebSocket-based live updates during simulation
- **Non-invasive**: Separate application that doesn't modify the Reality Engine

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

The visualizer backend provides these endpoints:

### Graph Data
- `GET /api/viz/sequences` - Get all sequences with graph data
- `GET /api/viz/sequences/:id` - Get specific sequence graph

### Engine Data
- `GET /api/viz/stats` - Get engine statistics
- `GET /api/viz/active` - Get active vectors
- `GET /api/viz/history` - Get transition history

### Operations
- `POST /api/viz/sequences/:id/reset` - Reset sequence to initial state
- `POST /api/viz/process` - Process input vector
- `GET /api/viz/poll` - Poll for updates

### WebSocket
- `ws://localhost:3001/ws` - Real-time updates stream

## Configuration

### Backend Configuration

Create a `.env` file in `visualizer/backend/`:

```env
VIZ_PORT=3001
REALITY_ENGINE_URL=http://localhost:3000
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
