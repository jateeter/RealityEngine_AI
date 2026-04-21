# Reality Engine - Quick Start Guide

Get Reality Engine up and running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] Docker Desktop installed and running
- [ ] Git (for cloning repository)
- [ ] Terminal/Command line access

## Installation Steps

### Step 1: Setup (2 minutes)

```bash
cd realityEngine
./scripts/setup.sh
```

This will:
- ✓ Validate prerequisites
- ✓ Install dependencies
- ✓ Build the application
- ✓ Create configuration files

### Step 2: Start Services (1 minute)

Recommended — bring up the whole stack (localAIStack + Reality Engine) in one command:

```bash
./startUniverse.sh
# or, to wipe perception sources and rebuild images without cache:
./startUniverse.sh --fresh
```

Reality-Engine-only (requires localAIStack already running on port 4333):

```bash
./scripts/start.sh
```

Wait for the success message:
```
Reality Engine Started Successfully!

Services:
  - Qdrant:          http://localhost:6333
  - Reality Engine:  http://localhost:3000
```

### Step 3: Verify (30 seconds)

```bash
./scripts/status.sh
```

You should see:
```
Overall: ALL SERVICES RUNNING
```

### Step 4: Run Example (1 minute)

```bash
# Create a simple sequence
./scripts/examples/create-sequence.sh

# Process some inputs
./scripts/examples/process-input.sh
```

## 🎉 You're Ready!

The Reality Engine is now running. Here's what you can do:

### View the Dashboard

Open in your browser:
- **API Root:** http://localhost:3000
- **Qdrant UI:** http://localhost:6333/dashboard
- **API Health:** http://localhost:3000/api/health

### Try the API

```bash
# Get configuration
curl http://localhost:3000/api/config

# Get engine statistics
curl http://localhost:3000/api/engine/stats

# Create a vector
curl -X POST http://localhost:3000/api/vectors \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {"value": 0.5, "comparatorType": "threshold", "threshold": 0.1}
    ],
    "isInitial": true
  }'
```

### Run More Examples

```bash
# Pattern recognition demo
./scripts/examples/pattern-recognition.sh

# Reality sampler demo
./scripts/examples/sampler-demo.sh
```

## Common Commands

```bash
# Start full universe (localAIStack + Reality Engine)
./startUniverse.sh              # cached build
./startUniverse.sh --fresh      # wipe perception data + rebuild RE with --no-cache

# Start Reality Engine only (localAIStack must already be running)
./scripts/start.sh

# Stop services
./scripts/stop.sh

# Restart services
./scripts/restart.sh

# Check status
./scripts/status.sh

# View logs
./scripts/logs.sh

# Health check
./scripts/health-check.sh
```

## Next Steps

1. **Read the Documentation:**
   - [README.md](README.md) - Full documentation
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
   - [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture

2. **Explore the API:**
   - See [README.md#api-reference](README.md#api-reference)

3. **Run Tests:**
   ```bash
   npm test
   ```

4. **Customize Configuration:**
   ```bash
   nano .env
   ./scripts/restart.sh
   ```

## Troubleshooting

### Services won't start?

```bash
# Check Docker is running
docker info

# View logs
./scripts/logs.sh

# Try restart
./scripts/restart.sh
```

### Port already in use?

Edit `.env` and change:
```bash
PORT=3001
```

Then restart:
```bash
./scripts/restart.sh
```

### Need help?

Run the health check:
```bash
./scripts/health-check.sh
```

This will diagnose common issues.

## Stopping the System

When you're done:

```bash
./scripts/stop.sh
```

This gracefully shuts down all services.

---

**That's it!** You now have a fully functional Reality Engine.

For detailed usage and API documentation, see [README.md](README.md).

For deployment scenarios and production setup, see [DEPLOYMENT.md](DEPLOYMENT.md).
