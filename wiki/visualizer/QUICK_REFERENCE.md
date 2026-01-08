# Reality Engine Visualizer - Quick Reference

## Start Services

```bash
# Quick start (all services)
./start-all.sh

# Or manually:
npm run dev                      # Reality Engine (port 3000)
cd visualizer/backend && npm run dev    # Backend (port 3001)
cd visualizer/frontend && npm run dev   # Frontend (port 5173)
```

## URLs

- **Visualizer**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Reality Engine**: http://localhost:3000

## Keyboard Controls

| Key | Action |
|-----|--------|
| `+` | Zoom in |
| `-` | Zoom out |
| `F` | Fit view |
| `C` | Center |
| `↑↓←→` | Pan |

## Visual Indicators

| Color/Badge | Meaning |
|-------------|---------|
| Blue border | Initial vector |
| Green glow | Active vector |
| Amber border | Selected |
| ⚡ | Has output |
| INIT badge | Initial state |
| Pulsing dot | Active now |

## Demo Setup

```bash
# Create sample sequences
npx ts-node visualizer/demo-setup.ts

# Process test inputs
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.1, 0.2]}'
```

## Common Tasks

### View All Sequences
Click sequences in left sidebar

### View Node Details
Click any node in the graph

### Refresh Data
Click "Refresh Data" button (auto-refreshes every 2s)

### Navigate Graph
- Drag background to pan
- Scroll to zoom
- Double-click background to fit view

### Reset Sequence
Use Reality Engine API:
```bash
curl -X POST http://localhost:3000/api/sequences/{ID}/reset
```

## Troubleshooting

### No sequences shown
1. Check Reality Engine running: `curl http://localhost:3000/api/health`
2. Create demos: `npx ts-node visualizer/demo-setup.ts`

### Can't connect
1. Verify all services running (ports 3000, 3001, 5173)
2. Check backend logs for errors
3. Clear browser cache

### Graph not updating
1. Click "Refresh Data"
2. Check auto-refresh enabled
3. Verify inputs processed in Reality Engine

## File Locations

- **Documentation**: `visualizer/README.md`
- **Getting Started**: `visualizer/GETTING_STARTED.md`
- **Backend**: `visualizer/backend/src/server.ts`
- **Frontend**: `visualizer/frontend/src/App.tsx`
- **Demo**: `visualizer/demo-setup.ts`

## Stop Services

```bash
./stop-all.sh
```
