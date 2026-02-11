# Reality Engine Startup Verification

## Changes Made to start.sh

### Problem Identified
The original `scripts/start.sh` had a hybrid architecture issue:
1. Started Docker services (including `reality-engine-app` on port 3000)
2. Then also started Reality Engine API locally via `npm start` (also trying to use port 3000)
3. This created port conflicts and didn't show visualizations properly

### Solution Implemented
Updated `scripts/start.sh` to be **purely Docker-based**:

**Changes:**
1. **Removed local npm start** - No longer starts Reality Engine API as a local Node process
2. **Added service health checks** - Now waits for all three services:
   - Reality Engine API (Docker container on port 3000)
   - Visualizer Backend (Docker container on port 3001)
   - Visualizer Frontend (Docker container on port 5173)
3. **Updated success message** - Clarifies all services run in Docker
4. **Added visualization instructions** - Guides users to the new features

### Architecture Clarity

**Two Deployment Modes:**

1. **Docker Mode** (`./scripts/start.sh`):
   - All services in Docker containers
   - Qdrant: Docker
   - Reality Engine API: Docker
   - Visualizer Backend: Docker
   - Visualizer Frontend: Docker (Nginx serving built React app)

2. **Local Development Mode** (`./scripts/start-local.sh`):
   - Only Qdrant in Docker
   - Reality Engine API: Local Node process
   - Visualizer Backend: Local Node process
   - Visualizer Frontend: Local Vite dev server

## Startup Process (Docker Mode)

### 1. Pre-flight Checks
```bash
./scripts/start.sh
```

The script performs:
- ✅ Check for `.env` file
- ✅ Check for port conflicts (3000, 3001, 5173)
- ✅ Clean up existing containers
- ✅ Clear Docker build cache

### 2. Build Phase
```bash
docker-compose build --no-cache
```

Builds all services from scratch:
- **Qdrant**: From `Dockerfile.qdrant`
- **Reality Engine API**: From `Dockerfile` (root)
- **Visualizer Backend**: From `visualizer/backend/Dockerfile`
- **Visualizer Frontend**: From `visualizer/frontend/Dockerfile`
  - Copies source code
  - Runs `npm install`
  - Runs `npm run build` (includes new UniversalInputVectorDisplay)
  - Serves via Nginx

### 3. Startup Phase
```bash
docker-compose up -d
```

Starts containers in dependency order:
1. **Qdrant** (database)
2. **Reality Engine API** (depends on Qdrant)
3. **Visualizer Backend** (depends on API)
4. **Visualizer Frontend** (depends on Backend)

### 4. Health Check Phase
Script waits for each service:
- Qdrant: `http://localhost:6333/health`
- Reality Engine API: `http://localhost:3000/api/health`
- Visualizer Backend: `http://localhost:3001/health`
- Visualizer Frontend: `http://localhost:5173/`

Maximum 30 retries × 2 seconds = 60 seconds timeout per service.

## Verification Steps

### Step 1: Check Docker Containers
```bash
docker ps
```

Expected output (all 4 containers):
```
CONTAINER ID   IMAGE                                    STATUS         PORTS
<id>           reality-engine_visualizer-frontend       Up X minutes   0.0.0.0:5173->80/tcp
<id>           reality-engine_visualizer-backend        Up X minutes   0.0.0.0:3001->3001/tcp
<id>           reality-engine_reality-engine            Up X minutes   0.0.0.0:3000->3000/tcp
<id>           reality-engine_qdrant                    Up X minutes   0.0.0.0:6333-6334->6333-6334/tcp
```

### Step 2: Check Service Health
```bash
curl http://localhost:6333/          # Qdrant
curl http://localhost:3000/api/health # Reality Engine API
curl http://localhost:3001/health     # Visualizer Backend
curl http://localhost:5173/           # Visualizer Frontend
```

All should return 200 OK.

### Step 3: Check Frontend Build Includes New Components
```bash
# Check if UniversalInputVectorDisplay CSS is included
docker exec reality-engine-visualizer-frontend ls -la /usr/share/nginx/html/assets/

# Should show index-*.css with size around 17-18 KB (includes new styles)
```

### Step 4: Access Visualizer
Open browser to: `http://localhost:5173`

**Expected UI:**
1. Machine selection list
2. Load a machine (e.g., "RSFlipFlop")
3. Switch to "Graph" view
4. Should see:
   - Machine Interconnection Graph (D3.js visualization at top)
   - Universal Input Vector Display (256-byte grid below)
   - Random Stream Generator button

### Step 5: Test Universal Input Vector Display

1. **Scroll down** in the Machine Graph view
2. Look for **"Universal Perceptual Space (En)"** section
3. Should see:
   - 256 bytes in a grid (16 bytes per row)
   - "🎲 Random Stream Generator" button
   - Legend showing machine input/output regions

4. **Click "Random Stream Generator"**
5. Configure:
   - Vector Count: 100
   - Input Region Offset: 0
   - Input Region Length: 16
6. Click "Generate Stream"
7. Should see:
   - Vector grid populated with values
   - Color-coded regions (blue for inputs, pink for outputs)

### Step 6: Run Perceptual Simulation

1. Use simulation controls in left sidebar:
   - Click "Start" or "Step"
2. Watch the Universal Input Vector Display:
   - Should update on each step
   - Machine outputs overwrite random values
   - Colors show which regions are active

## Troubleshooting

### Issue: Containers not starting
```bash
# Check logs
docker logs reality-engine-app
docker logs reality-engine-visualizer-frontend
docker logs reality-engine-visualizer-backend
docker logs reality-engine-qdrant

# Full cleanup and restart
./scripts/stop.sh
docker system prune -f
./scripts/start.sh
```

### Issue: Frontend shows old UI (no Universal Input Vector Display)
```bash
# Force rebuild without cache
docker-compose build --no-cache visualizer-frontend
docker-compose up -d visualizer-frontend

# Or full restart
./scripts/stop.sh
./scripts/start.sh
```

### Issue: Port conflicts
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :3001
lsof -i :5173

# If local services are running, stop them
./scripts/stop-local.sh

# Then start Docker mode
./scripts/start.sh
```

### Issue: "Cannot connect to Docker daemon"
```bash
# Start Docker Desktop
open -a Docker

# Wait for Docker to be ready
docker ps

# Then start services
./scripts/start.sh
```

## Frontend Build Verification

The frontend build includes the new components:

### Files Added
- `src/components/UniversalInputVectorDisplay.tsx` (7.8 KB)
- `src/components/UniversalInputVectorDisplay.css` (5.8 KB)

### Files Modified
- `src/components/InputStreamVisualization.tsx` - Removed random generator
- `src/components/MachineContainerView.tsx` - Added UniversalInputVectorDisplay
- `src/api.ts` - Added perceptual simulation API methods
- `src/types.ts` - Added perceptualMapping to Machine interface

### Build Output
```
dist/index.html                   0.59 kB
dist/assets/index-DrQ2elr6.css   17.50 kB  ← Includes UniversalInputVectorDisplay.css
dist/assets/index-6gJdfMJO.js   372.71 kB  ← Includes UniversalInputVectorDisplay.tsx
```

The larger CSS file size (17.50 kB vs typical 13 kB) confirms the new styles are included.

## Expected User Experience

### 1. Initial Access
User opens `http://localhost:5173` and sees:
- Machine selection list
- All example machines loaded (RSFlipFlop, DataCenterMonitoring, etc.)

### 2. Load Machine
User clicks on a machine (e.g., "RSFlipFlop"):
- Left sidebar shows input stream (if available)
- Center shows Machine Graph View
- Right sidebar shows output stream

### 3. Switch to Graph View
User clicks "Graph" tab:
- Top section: Machine Interconnection Graph (D3.js)
  - Shows all machines as nodes
  - Lines connect machines with overlapping perceptual regions
  - Tooltips show machine metadata and perceptual mappings
- Bottom section: Universal Input Vector Display
  - 256-byte grid showing perceptual space
  - Machine regions highlighted (blue/pink)
  - Random Stream Generator button

### 4. Generate Random Stream
User clicks "🎲 Random Stream Generator":
- Configuration panel expands
- User sets:
  - Vector Count: 100
  - Input Region: [0:16]
- Clicks "Generate Stream"
- Vector grid fills with random values in target region
- Machine output regions highlighted
- Ready to simulate

### 5. Run Simulation
User clicks "Play" or "Step":
- Each step:
  - Next universal vector applied to En
  - Machines process their inputs
  - Outputs merged back to En
  - Vector grid updates in real-time
  - Output regions show overwrites

### 6. Observe Perceptual Propagation
User watches the visualization:
- Random values in input regions (blue)
- Machine A outputs overwrite En at offset 10-14 (pink)
- Machine B reads from 12-16 (includes Machine A output)
- Data flow visible through overlapping regions
- Legend shows all mappings

## Success Criteria

✅ All 4 Docker containers running
✅ All health checks passing
✅ Visualizer frontend accessible at port 5173
✅ Machine Graph View displays correctly
✅ Universal Input Vector Display visible below graph
✅ 256-byte grid shows perceptual space
✅ Random Stream Generator button present
✅ Configuration panel works
✅ Generate button creates universal vectors
✅ Vector grid updates on simulation steps
✅ Machine regions highlighted correctly
✅ Output overwrites visible in real-time
✅ Legend shows all machine perceptual mappings

## Summary

The startup script has been fixed to:
1. **Run entirely in Docker mode** (no hybrid local/Docker)
2. **Wait for all services** to be healthy before declaring success
3. **Build with --no-cache** to ensure latest frontend code is included
4. **Provide clear instructions** for accessing the new visualization features

The Universal Input Vector Display is now part of the Docker build and will be visible when:
- User accesses http://localhost:5173
- Loads a machine
- Views the "Graph" tab
- Scrolls down to see the 256-byte perceptual space visualization

All services start cleanly with proper health checks, and the frontend includes the latest code with the new perceptual space propagation visualizations.
