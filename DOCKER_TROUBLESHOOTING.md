# Docker Deployment Troubleshooting Guide

## Common Errors and Solutions

### 1. Container Name Conflict Error
```
Error response from daemon: Conflict. The container name "/reality-engine-qdrant" is already in use
```

**Solution:**
```bash
# Option 1: Use the cleanup script (recommended)
./scripts/stop.sh

# Option 2: Manual cleanup
docker-compose down
docker rm -f reality-engine-qdrant reality-engine-app reality-engine-visualizer-backend reality-engine-visualizer-frontend

# Option 3: Complete cleanup (removes volumes)
./scripts/cleanup.sh

# Then start again
./scripts/start.sh
```

### 2. Port Already in Use
```
Error: Bind for 0.0.0.0:6333 failed: port is already allocated
```

**Solution:**
```bash
# Check what's using the port
lsof -i :6333
lsof -i :3000
lsof -i :3001
lsof -i :5173

# Stop the conflicting service or change ports in docker-compose.yml
```

### 3. Build Failures

**Solution:**
```bash
# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### 4. Network Issues

**Solution:**
```bash
# Remove orphaned networks
docker network prune -f

# Or remove specific network
docker network rm realityengine_ai_reality-network
```

## Useful Commands

### Check Status
```bash
./scripts/docker-status.sh       # Comprehensive status
docker-compose ps                # Running containers
docker-compose logs              # View all logs
docker-compose logs qdrant       # View specific service logs
```

### Start/Stop Services
```bash
./scripts/start.sh               # Start all services
./scripts/stop.sh                # Stop and remove containers
./scripts/restart.sh             # Restart all services
./scripts/cleanup.sh             # Complete cleanup
```

### Debugging
```bash
# Enter a running container
docker exec -it reality-engine-qdrant /bin/sh
docker exec -it reality-engine-app /bin/sh

# View real-time logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f qdrant
docker-compose logs -f visualizer-backend
```

### Clean Slate
```bash
# Complete system reset (WARNING: removes all data)
docker-compose down -v
docker system prune -a -f --volumes
./scripts/start.sh
```

## Architecture

The system consists of 4 containers:

1. **reality-engine-qdrant** - Vector database (ports 6333, 6334)
2. **reality-engine-app** - Main API server (port 3000)
3. **reality-engine-visualizer-backend** - Proxy server (port 3001)
4. **reality-engine-visualizer-frontend** - React UI (port 5173)

## Health Checks

All containers have health checks. Check their status:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Healthy output should show `(healthy)` status for all containers.
