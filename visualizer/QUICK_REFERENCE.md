# Reality Engine Visualizer — Quick Reference

## Start Services

```bash
# Recommended: full stack via universe orchestrator
./startUniverse.sh

# Or start visualizer components manually:
cd visualizer/backend && npm run dev    # Backend  (port 3001)
cd visualizer/frontend && npm run dev  # Frontend (port 5173)
```

## URLs

| Service | URL |
|---------|-----|
| Visualizer | http://localhost:5173 |
| Visualizer Backend API | http://localhost:3001 |
| Reality Engine | http://localhost:3000 |
| Perception Engine | http://localhost:3004 |

## Views

| View | How to reach |
|------|-------------|
| Machine Selection (home) | `/` — domain → machine hierarchy tree |
| Machine Administration | Click any machine in the tree |
| Machine Interconnection | "Interconnection" button in nav |
| Tobias | "Tobias" button in nav |

## Keyboard Controls

| Key | Action |
|-----|--------|
| `↑` `↓` `←` `→` | Navigate tree (selection) / pan (graph views) |
| `Enter` | Open selected machine |
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |
| `F` | Fit view |
| `C` | Center |

## Visual Indicators

| Indicator | Meaning |
|-----------|---------|
| Blue border | Initial vector |
| Green glow | Active vector |
| Amber border | Selected node |
| INIT badge | Initial state |
| Pulsing dot | Active now |
| ⚡ | Has output vectors |

## Common Tasks

### Browse machines
Open the app — the domain tree is the home view.  Expand a domain to see machines; expand a machine to see its CES sequences.

### View a machine's CES graph
Click the machine name in the tree.  The Administration view opens with the live CES graph.

### Control the Perception Engine push loop
In the Administration view, use the PE Controls panel on the right: start/stop auto-push, adjust interval, or step manually.

### View the domain/edge legend (Interconnection view)
Click the tab anchored to the **left edge** of the graph.

### Toggle 2-D / 3-D layout (Interconnection view)
Use the 2D/3D toggle button in the graph toolbar.

## Key API Endpoints (backend on port 3001)

```bash
# Machine data
curl http://localhost:3001/api/machines
curl http://localhost:3001/api/machines/<id>
curl http://localhost:3001/api/machine-graph

# CES sequences
curl http://localhost:3001/api/viz/sequences
curl http://localhost:3001/api/viz/paging-decisions

# Perception Engine (proxied)
curl http://localhost:3001/api/perception/sources
curl http://localhost:3001/api/perception/mqtt/status
```

## Troubleshooting

### No machines shown
```bash
curl http://localhost:3000/api/health      # RE must be running
curl http://localhost:3001/api/machines    # backend must reach RE
```

### Graph not updating live
Check browser DevTools → Network → WS: `ws://localhost:3001/ws` must be open.

### Perception Engine controls unavailable
```bash
curl http://localhost:3004/api/health      # PE must be running
```
Check `PERCEPTION_ENGINE_URL` in `visualizer/backend/.env`.

## File Locations

| Purpose | Path |
|---------|------|
| Full docs | `visualizer/README.md` |
| Getting started | `visualizer/GETTING_STARTED.md` |
| Backend routes | `visualizer/backend/src/server.ts` |
| Frontend entry | `visualizer/frontend/src/App.tsx` |
| API helpers | `visualizer/frontend/src/api.ts` |

## Stop Services

```bash
./stopUniverse.sh
```
