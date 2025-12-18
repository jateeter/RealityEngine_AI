# Reality Engine - Scripts Reference

Complete reference for all deployment and management scripts.

## Table of Contents

- [Core Management Scripts](#core-management-scripts)
- [Example Scripts](#example-scripts)
- [Script Locations](#script-locations)
- [Usage Patterns](#usage-patterns)
- [Script Dependencies](#script-dependencies)

---

## Core Management Scripts

Location: `scripts/`

### setup.sh

**Purpose:** Initial system setup and configuration

**Usage:**
```bash
./scripts/setup.sh
```

**What it does:**
1. Checks prerequisites (Node.js, npm, Docker, Docker Compose)
2. Creates `.env` file from template
3. Installs npm dependencies
4. Builds TypeScript code
5. Creates necessary directories
6. Sets script permissions

**When to run:**
- First-time setup
- After repository clone
- After major updates
- To reset configuration

**Output:**
```
Reality Engine - Initial Setup
=================================
✓ Node.js installed: v22.x.x
✓ npm installed: 10.x.x
✓ Docker installed
✓ Docker Compose installed
✓ Docker daemon is running
✓ .env file created
✓ Dependencies installed successfully
✓ Build completed successfully

Setup Complete!
```

---

### start.sh

**Purpose:** Start all Reality Engine services

**Usage:**
```bash
./scripts/start.sh
```

**What it does:**
1. Validates `.env` file exists
2. Starts Qdrant vector database
3. Waits for Qdrant to be ready (max 60s)
4. Starts Reality Engine API in background
5. Waits for API to be ready (max 60s)
6. Saves API PID to `.api.pid`

**Output:**
```
Reality Engine - Starting Services
====================================
✓ Qdrant is ready
✓ Reality Engine API is ready

Reality Engine Started Successfully!

Services:
  - Qdrant:          http://localhost:6333
  - Reality Engine:  http://localhost:3000

API PID: 12345
```

**Exit codes:**
- `0` - Success
- `1` - Qdrant failed to start
- `1` - API failed to start

---

### stop.sh

**Purpose:** Stop all Reality Engine services gracefully

**Usage:**
```bash
./scripts/stop.sh
```

**What it does:**
1. Stops Reality Engine API process
2. Waits for graceful shutdown (10s)
3. Force kills if necessary
4. Stops Qdrant container
5. Removes PID files

**Output:**
```
Reality Engine - Stopping Services
====================================
✓ Reality Engine API stopped
✓ Qdrant stopped

All Services Stopped
```

**Safe to run:**
- Multiple times
- When services already stopped
- During development

---

### restart.sh

**Purpose:** Restart all services (stop + wait + start)

**Usage:**
```bash
./scripts/restart.sh
```

**What it does:**
1. Calls `stop.sh`
2. Waits 3 seconds
3. Calls `start.sh`

**When to use:**
- After configuration changes
- After code updates
- To clear state issues
- Regular maintenance

---

### status.sh

**Purpose:** Check status of all services

**Usage:**
```bash
./scripts/status.sh
```

**What it displays:**

1. **Qdrant Status:**
   - Container status (RUNNING/STOPPED)
   - Health check (HEALTHY/UNHEALTHY)
   - URLs

2. **Reality Engine API:**
   - Process status (RUNNING/STOPPED)
   - PID
   - Health check
   - Engine statistics

3. **Docker Status:**
   - Daemon status

4. **Overall Status:**
   - System-wide health

**Example output:**
```
Qdrant Vector Database:
  Status: RUNNING
  Health: HEALTHY
  URL:    http://localhost:6333
  UI:     http://localhost:6333/dashboard

Reality Engine API:
  Status: RUNNING
  PID:    12345
  Health: HEALTHY
  URL:    http://localhost:3000

  Engine Statistics:
    Sequences: 3
    Vectors:   12
    Active:    5

Docker:
  Status: RUNNING

Overall: ALL SERVICES RUNNING
```

**Exit codes:**
- `0` - Always (informational only)

---

### logs.sh

**Purpose:** View logs from various services

**Usage:**
```bash
# View all logs (default, last 50 lines)
./scripts/logs.sh

# View specific service
./scripts/logs.sh api
./scripts/logs.sh qdrant

# Specify number of lines
./scripts/logs.sh api 100
./scripts/logs.sh qdrant 200

# Follow logs in real-time
./scripts/logs.sh follow
```

**Services:**
- `api` - Reality Engine API logs
- `qdrant` - Qdrant database logs
- `all` - Both services (default)
- `follow` - Real-time tail of all logs

**Log locations:**
- API: `logs/api.log`
- Qdrant: Docker container logs

**Examples:**
```bash
# Last 100 lines of API logs
./scripts/logs.sh api 100

# Watch all logs in real-time
./scripts/logs.sh follow

# Qdrant logs only
./scripts/logs.sh qdrant
```

---

### health-check.sh

**Purpose:** Comprehensive health check of all components

**Usage:**
```bash
./scripts/health-check.sh
```

**Checks performed:**

1. **Docker Daemon** - Is Docker running?
2. **Qdrant Container** - Is container up?
3. **Qdrant HTTP** - Is HTTP API responding?
4. **Qdrant Collections** - Can access vector collections?
5. **API Process** - Is Node process running?
6. **API HTTP** - Is HTTP API responding?
7. **API Config** - Can access configuration?
8. **Engine Stats** - Can access engine statistics?
9. **Disk Space** - Is disk space available?
10. **Memory Usage** - Is memory usage normal?

**Output:**
```
Reality Engine - Health Check
===============================

[1/10] Docker Daemon
✓ PASS - Docker is running

[2/10] Qdrant Container
✓ PASS - Qdrant container is running

...

[10/10] Memory Usage
✓ PASS - Memory usage normal (245MB)

Health Check Summary
=====================
Passed:   10
Warnings: 0
Failed:   0

Overall Status: HEALTHY
```

**Exit codes:**
- `0` - All checks passed
- `0` - Warnings only (no failures)
- `1` - One or more failures

**Use in automation:**
```bash
# Check health and restart if unhealthy
./scripts/health-check.sh || ./scripts/restart.sh

# In crontab
*/5 * * * * /path/to/scripts/health-check.sh || /path/to/scripts/restart.sh
```

---

## Example Scripts

Location: `scripts/examples/`

### create-sequence.sh

**Purpose:** Create an example binary state machine

**Usage:**
```bash
./scripts/examples/create-sequence.sh
```

**What it creates:**
- Binary state machine (State A ↔ State B)
- State A: value 1.0
- State B: value 0.0
- Bidirectional transitions
- Output vectors for each state

**Output:**
```
Example: Creating a CriticalEventSequence
===========================================

✓ Sequence created successfully!

Sequence ID: abc123...

Next steps:
  - Process inputs: ./scripts/examples/process-input.sh
```

**Prerequisites:**
- Services must be running
- API must be accessible

---

### process-input.sh

**Purpose:** Process example input vectors through the engine

**Usage:**
```bash
./scripts/examples/process-input.sh
```

**What it does:**
1. Processes State A input [1.0]
2. Processes State B input [0.0]
3. Displays outputs
4. Shows active vectors
5. Displays engine statistics

**Output:**
```
Example: Processing Input Vectors
===================================

Processing State A input [1.0]...
Response: {
  "inputVector": [1.0],
  "totalOutputs": 1
}

Processing State B input [0.0]...
Response: {
  "inputVector": [0.0],
  "totalOutputs": 1
}

Engine statistics:
{
  "totalSequences": 1,
  "totalVectors": 2,
  "totalActiveVectors": 1
}
```

---

### sampler-demo.sh

**Purpose:** Demonstrate the Reality Sampler functionality

**Usage:**
```bash
./scripts/examples/sampler-demo.sh
```

**What it does:**
1. Starts sampler with periodic strategy (1000ms)
2. Samples 5 random observations
3. Displays sampler statistics
4. Stops sampler

**Output:**
```
Example: Reality Sampler Demo
===============================

Starting sampler...
✓ Sampler started

Sampling observations...
[1] Sampling value: 0.423
[2] Sampling value: 0.812
[3] Sampling value: 0.156
[4] Sampling value: 0.934
[5] Sampling value: 0.621

Sampler statistics:
{
  "sampleCount": 5,
  "bufferSize": 5
}

✓ Sampler stopped
```

**Duration:** ~3 seconds

---

### pattern-recognition.sh

**Purpose:** Demonstrate pattern recognition with threshold matching

**Usage:**
```bash
./scripts/examples/pattern-recognition.sh
```

**What it does:**
1. Creates pattern recognition sequence
   - Target: [0.5, 0.8, 0.3] ± 0.15
2. Tests with three inputs:
   - Close match: [0.52, 0.79, 0.31]
   - Exact match: [0.5, 0.8, 0.3]
   - No match: [0.9, 0.1, 0.9]

**Output:**
```
Example: Pattern Recognition
==============================

✓ Sequence created

Testing pattern matching:

1. Input [0.52, 0.79, 0.31] (close match):
   matched: true
   outputs: 1

2. Input [0.5, 0.8, 0.3] (exact match):
   matched: true
   outputs: 1

3. Input [0.9, 0.1, 0.9] (no match):
   matched: false
   outputs: 0

Pattern recognition demo complete!
```

---

## Script Locations

```
realityEngine/
├── scripts/
│   ├── setup.sh              # Initial setup
│   ├── start.sh              # Start services
│   ├── stop.sh               # Stop services
│   ├── restart.sh            # Restart services
│   ├── status.sh             # Check status
│   ├── logs.sh               # View logs
│   ├── health-check.sh       # Health check
│   ├── quick-start.sh        # Automated quick start
│   └── examples/
│       ├── create-sequence.sh      # Create example sequence
│       ├── process-input.sh        # Process inputs
│       ├── sampler-demo.sh         # Sampler demonstration
│       └── pattern-recognition.sh  # Pattern matching demo
```

---

## Usage Patterns

### First-Time Setup

```bash
# 1. Setup
./scripts/setup.sh

# 2. Start
./scripts/start.sh

# 3. Verify
./scripts/status.sh

# 4. Test
./scripts/examples/create-sequence.sh
./scripts/examples/process-input.sh
```

---

### Daily Development

```bash
# Morning: Start services
./scripts/start.sh

# Check status
./scripts/status.sh

# View logs during development
./scripts/logs.sh follow

# Evening: Stop services
./scripts/stop.sh
```

---

### After Code Changes

```bash
# 1. Stop services
./scripts/stop.sh

# 2. Rebuild
npm run build

# 3. Start services
./scripts/start.sh

# Or use restart shortcut
./scripts/restart.sh
```

---

### Troubleshooting

```bash
# 1. Check status
./scripts/status.sh

# 2. View logs
./scripts/logs.sh

# 3. Run health check
./scripts/health-check.sh

# 4. Try restart
./scripts/restart.sh

# 5. If still failing, check individual logs
./scripts/logs.sh api 200
./scripts/logs.sh qdrant 200
```

---

### Production Monitoring

```bash
# Periodic health check (add to crontab)
*/5 * * * * /path/to/scripts/health-check.sh

# Automatic restart on failure
*/5 * * * * /path/to/scripts/health-check.sh || /path/to/scripts/restart.sh

# Log rotation (configure logrotate)
# See DEPLOYMENT.md for details
```

---

## Script Dependencies

### System Dependencies

All scripts require:
- Bash shell
- Standard Unix utilities (curl, grep, ps, etc.)

### setup.sh requires:
- Node.js
- npm
- Docker
- Docker Compose

### start.sh requires:
- `.env` file (created by setup.sh)
- Docker daemon running
- Ports 3000, 6333, 6334 available

### Example scripts require:
- Services running (via start.sh)
- API accessible at configured PORT
- `jq` (optional, for pretty JSON output)

---

## Environment Variables

Scripts respect these environment variables:

```bash
PORT=3000                    # API port (from .env)
QDRANT_URL=http://localhost:6333  # Qdrant URL (from .env)
NODE_ENV=development         # Environment (from .env)
```

---

## Exit Codes

Standard exit codes:

- `0` - Success
- `1` - Error or failure

Scripts follow this convention for automation and scripting.

---

## Permissions

All scripts should be executable:

```bash
chmod +x scripts/*.sh
chmod +x scripts/examples/*.sh
```

This is done automatically by `setup.sh`.

---

## Tips and Best Practices

### 1. Always check status first

```bash
./scripts/status.sh
```

### 2. View logs when troubleshooting

```bash
./scripts/logs.sh follow
```

### 3. Use health check for diagnostics

```bash
./scripts/health-check.sh
```

### 4. Restart after configuration changes

```bash
./scripts/restart.sh
```

### 5. Stop services when not in use

```bash
./scripts/stop.sh
```

### 6. Run setup after updates

```bash
git pull
./scripts/setup.sh
./scripts/restart.sh
```

---

## Quick Command Reference

```bash
# Setup & Start
./scripts/setup.sh && ./scripts/start.sh

# Check everything is working
./scripts/status.sh && ./scripts/health-check.sh

# View logs
./scripts/logs.sh

# Run examples
./scripts/examples/create-sequence.sh
./scripts/examples/process-input.sh

# Stop everything
./scripts/stop.sh
```

---

For detailed deployment scenarios and production configuration, see [DEPLOYMENT.md](DEPLOYMENT.md).

For API usage and system architecture, see [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
