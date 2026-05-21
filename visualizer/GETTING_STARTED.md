# Getting Started with Reality Engine Visualizer

This guide walks you through launching the visualizer and navigating its four main views.

## Prerequisites

- Node.js 18+
- Reality Engine running on port 3000
- Perception Engine running on port 3004

Start the full stack with:

```bash
# From the RealityEngine_AI root
./startUniverse.sh
```

Or start services individually — see `visualizer/README.md` for manual setup.

## Open the Visualizer

Navigate to `http://localhost:5173` in your browser.

## The Four Views

### 1. Machine Selection (Home)

The landing page shows all loaded machines arranged in a domain → machine hierarchy tree.  Each domain is a collapsible group; each machine entry lists its CES sequences below it.

- **Arrow keys + Enter** navigate the tree without a mouse.
- **Click a machine** to open its Administration view.
- The tree is searchable — type to filter machines by name.

### 2. Machine Administration

Opens when you select a machine.  Shows:

- **CES Graph** — directed graph of the machine's Critical Event Sequences, with active vectors highlighted in green.
- **Perception Engine source controls** — start/stop the PE auto-push loop, adjust the push interval (ms), step manually, or reset.
- **Source management panel** — add, edit, and delete test / sensor / simulated PE sources for this machine.
- **Perceptual log panel** — timestamped live record of PE → RE events.

Active vector highlights arrive over the shared WebSocket and update without a page refresh.

### 3. Machine Interconnection

Force-directed graph of every loaded machine.  Nodes are coloured by domain.  Edges represent shared perceptual-space regions between machines.

- **2-D / 3-D toggle** in the toolbar switches between the flat force layout and the 3-D layout.
- **Legend panel** — click the tab anchored to the left edge of the graph to reveal the domain colour key and edge legend.
- **Click a node** to inspect machine details.

### 4. Tobias

Real-time AI sequence pulse canvas — continuous scrolling view of active-vector firing events across all machines.

## Keyboard Controls

| Key | Action |
|-----|--------|
| `↑` `↓` `←` `→` | Navigate machine tree (selection view) / pan graph (other views) |
| `Enter` | Open selected machine |
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `F` | Fit graph to window |
| `C` | Center graph |

## Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| Blue border | Initial vector |
| Green border + glow | Active vector |
| Amber border | Selected node |
| Pulsing green dot | Active state indicator |
| INIT badge | Initial vector |
| ⚡ symbol | Vector has output vectors |

## Troubleshooting

### No machines shown

1. Verify Reality Engine is running: `curl http://localhost:3000/api/health`
2. Verify machines loaded: `curl http://localhost:3000/api/machines`
3. Check visualizer backend logs (port 3001)

### Graph not updating in real time

1. Open browser DevTools → Network → WS tab and verify `ws://localhost:3001/ws` is connected.
2. Restart the visualizer backend if the WebSocket connection is absent.

### Cannot reach Perception Engine controls

1. Verify PE is running: `curl http://localhost:3004/api/health`
2. Check `PERCEPTION_ENGINE_URL` in `visualizer/backend/.env` (default: `http://localhost:3004`).

## Architecture

```
Reality Engine  (port 3000)
Perception Engine (port 3004)
        │ HTTP proxy + SSE/WS subscriptions
        ▼
Visualizer Backend  (port 3001)
  - Proxies API calls to RE and PE
  - Assembles CES graph data
  - Broadcasts live events over WebSocket
        │ HTTP + WebSocket
        ▼
Visualizer Frontend  (port 5173)
  - React / ReactFlow graph views
  - Single persistent WS connection (ws://localhost:3001/ws)
```

For full API reference see `visualizer/README.md`.
