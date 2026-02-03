# Local Development Scripts

Comprehensive scripts for managing Reality Engine services in local development mode (non-Docker).

## 🚀 Quick Start

```bash
# Start all services
./scripts/start-local.sh

# Stop all services
./scripts/stop-local.sh

# Restart all services
./scripts/restart-local.sh

# Validate system health
./scripts/validate.sh
```

## 📋 Scripts Overview

### `start-local.sh` - Start All Services

**What it does:**
1. ✅ Creates necessary directories (logs/, qdrant_storage/)
2. ✅ Checks if project is built (runs `npm run build` if needed)
3. ✅ Starts Qdrant vector database via Docker
4. ✅ Starts Reality Engine backend (port 3000)
5. ✅ Validates machine JSON files are accessible
6. ✅ Starts Visualizer backend (port 3001)
7. ✅ Starts Visualizer frontend (port 5173)
8. ✅ Validates all services are healthy

**Validation checks:**
- Health endpoints respond correctly
- Machine JSON API returns files
- All required ports are available
- Services start without errors

**Output:**
```
✓ Found 5 machine JSON files
✓ Reality Engine Backend: OK
✓ Visualizer Backend: OK
✓ Visualizer Frontend: OK

✨ Reality Engine Started Successfully! ✨
```

**Logs stored in:**
- `logs/api.log` - Backend logs
- `logs/viz-backend.log` - Visualizer backend logs
- `logs/viz-frontend.log` - Visualizer frontend logs

**PID files:**
- `.api.pid` - Backend process ID
- `.viz-backend.pid` - Visualizer backend process ID
- `.viz-frontend.pid` - Visualizer frontend process ID

---

### `stop-local.sh` - Stop All Services

**What it does:**
1. Gracefully stops Visualizer frontend
2. Gracefully stops Visualizer backend
3. Gracefully stops Reality Engine backend
4. Stops Qdrant Docker container
5. Cleans up any stray processes on known ports
6. Removes PID files

**Features:**
- 10-second graceful shutdown timeout
- Force kills if processes don't stop
- Cleans up stray processes on ports 3000, 3001, 5173
- Comprehensive cleanup

**Output:**
```
✓ Visualizer Frontend stopped
✓ Visualizer Backend stopped
✓ Reality Engine Backend stopped
✓ Qdrant stopped
✓ Cleaned up 0 stray process(es)

All Services Stopped
```

---

### `restart-local.sh` - Restart All Services

**What it does:**
1. Runs `stop-local.sh` to stop all services
2. Waits 5 seconds for graceful shutdown
3. Runs `start-local.sh` to start all services
4. Validates all services are healthy

**Use cases:**
- After code changes
- After configuration updates
- When services become unresponsive
- To apply updates

**Output:**
```
Phase 1: Stopping all services...
Phase 2: Waiting for graceful shutdown...
Phase 3: Starting all services...

✨ Restart Complete! ✨
All services restarted and validated successfully
```

---

### `validate.sh` - System Health Check

**What it does:**
Runs 10 comprehensive tests:

1. ✅ **Qdrant Vector Database** - Health endpoint
2. ✅ **Reality Engine Backend API** - Health endpoint & PID
3. ✅ **Machine JSON Files API** - Lists available machines
4. ✅ **Machine JSON Directory** - Verifies examples/machines/
5. ✅ **Visualizer Backend** - Health endpoint & PID
6. ✅ **Visualizer Frontend** - Port check & PID
7. ✅ **Visualizer Proxy** - Tests frontend → backend communication
8. ✅ **Node Dependencies** - Checks node_modules/ in all projects
9. ✅ **Build Artifacts** - Checks dist/ directories
10. ✅ **Docker Environment** - Docker installed & daemon running

**Output:**
```
✓ Qdrant is running and healthy
✓ Backend API is running
✓ Found 5 machine JSON files
  Available machines:
    - RS Flip Flop
    - RS2
    - Multi-Step State Machine
    - Data Center Monitoring
    - Kleene Star Operator

Validation Summary
Passed:   10 tests
✓ All critical tests passed!
```

**When to use:**
- After starting services
- Before running tests
- When debugging issues
- To verify system state

---

## 🔧 Troubleshooting

### Services Won't Start

**Issue:** Port already in use
```
✗ Port 3000 already in use
```

**Fix:**
```bash
# Kill process on specific port
lsof -ti:3000 | xargs kill -9

# Or use stop script to clean all
./scripts/stop-local.sh
```

---

**Issue:** Docker not running
```
✗ Docker daemon is not running
```

**Fix:**
1. Start Docker Desktop application
2. Wait for Docker to fully start
3. Try again

---

**Issue:** Machine JSON files not found
```
✗ No machine JSON files found
```

**Fix:**
```bash
# Check if directory exists
ls -la examples/machines/

# Should contain:
# - RSFlipFlop.json
# - RS2.json
# - MultiStep.json
# - DataCenterMonitoring.json
# - KleeneStar.json
```

---

### Build Failures

**Issue:** TypeScript compilation errors

**Fix:**
```bash
# Clean and rebuild
rm -rf dist/
npm run build

# Check for errors
npm run build 2>&1 | grep error
```

---

### Process Management

**Issue:** PID file exists but process is dead

**Fix:**
```bash
# Remove stale PID files
rm .api.pid .viz-backend.pid .viz-frontend.pid

# Start fresh
./scripts/start-local.sh
```

---

**Issue:** Multiple instances running

**Fix:**
```bash
# Stop all and clean up
./scripts/stop-local.sh

# Verify no processes remain
lsof -ti:3000,3001,5173,6333

# Start fresh
./scripts/start-local.sh
```

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────┐
│  Visualizer Frontend (Port 5173)                │
│  - React + Vite                                 │
│  - Machine Management Modal                     │
│  - Graph Visualizations                         │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Visualizer Backend (Port 3001)                 │
│  - Proxies requests to Reality Engine           │
│  - WebSocket broadcasting                       │
│  - Health checks                                │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Reality Engine Backend (Port 3000)             │
│  - Core API                                     │
│  - Machine JSON endpoints                       │
│  - Sequence processing                          │
│  - Loads machines from examples/machines/       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Qdrant Vector Database (Port 6333)             │
│  - Docker container                             │
│  - Vector storage                               │
│  - Similarity search                            │
└─────────────────────────────────────────────────┘
```

## 🎯 Startup Sequence

1. **Qdrant** (5-10 seconds)
   - Docker container starts
   - Health check at `/health`
   - Dashboard available at `/dashboard`

2. **Reality Engine Backend** (10-15 seconds)
   - Connects to Qdrant
   - Loads machine JSON files
   - Initializes API routes
   - Health check at `/api/health`

3. **Visualizer Backend** (5-10 seconds)
   - Connects to Reality Engine
   - Sets up proxy routes
   - WebSocket server ready
   - Health check at `/health`

4. **Visualizer Frontend** (5-10 seconds)
   - Vite dev server starts
   - Hot module reload enabled
   - Available at `http://localhost:5173`

**Total startup time:** ~30-45 seconds

## 🔍 Log Files

All logs are stored in the `logs/` directory:

```bash
# View all logs in real-time
tail -f logs/*.log

# View specific service
tail -f logs/api.log
tail -f logs/viz-backend.log
tail -f logs/viz-frontend.log

# Search logs for errors
grep -i error logs/*.log

# View last 50 lines of each log
tail -50 logs/*.log
```

## 📝 Best Practices

### During Development

1. **Always use validation script after changes:**
   ```bash
   npm run build
   ./scripts/restart-local.sh
   ./scripts/validate.sh
   ```

2. **Monitor logs when debugging:**
   ```bash
   # Terminal 1: Watch logs
   tail -f logs/*.log

   # Terminal 2: Make changes and restart
   ./scripts/restart-local.sh
   ```

3. **Clean shutdown before system sleep:**
   ```bash
   ./scripts/stop-local.sh
   ```

### Before Committing

1. Run full validation:
   ```bash
   ./scripts/validate.sh
   ```

2. Test machine loading:
   ```bash
   curl http://localhost:3000/api/machines/json/list
   ```

3. Verify frontend loads:
   ```bash
   open http://localhost:5173
   ```

## 🆚 Docker vs Local Scripts

| Feature | Docker Scripts | Local Scripts |
|---------|---------------|---------------|
| **Start** | `./scripts/start.sh` | `./scripts/start-local.sh` |
| **Stop** | `./scripts/stop.sh` | `./scripts/stop-local.sh` |
| **Restart** | `./scripts/restart.sh` | `./scripts/restart-local.sh` |
| **All services in Docker** | ✅ Yes | ❌ No (only Qdrant) |
| **Hot reload** | ❌ No | ✅ Yes |
| **Build caching** | Container-based | Host-based |
| **Development speed** | Slower (rebuilds) | Faster (live reload) |
| **Production ready** | ✅ Yes | ❌ No |
| **Best for** | Production/CI | Development |

## 📚 Additional Resources

- **Main README:** `/README.md`
- **Machine JSON Format:** `/docs/MACHINE_JSON_FORMAT.md`
- **Machine JSON API:** `/docs/MACHINE_JSON_API.md`
- **Implementation Summary:** `/MACHINE_JSON_IMPLEMENTATION.md`

## 🆘 Getting Help

If you encounter issues:

1. Run validation: `./scripts/validate.sh`
2. Check logs: `tail -f logs/*.log`
3. Review error messages carefully
4. Check GitHub issues: https://github.com/jateeter/RealityEngine_AI/issues
5. Clean restart: `./scripts/stop-local.sh && ./scripts/start-local.sh`

---

**Last Updated:** 2026-02-03
**Scripts Version:** 1.0.0
