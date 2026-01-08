# Docker Quick Start Guide

Run the entire Reality Engine stack with a single command.

## TL;DR

```bash
./docker-start.sh
```

Then open http://localhost:5173 in your browser.

## Prerequisites

- Docker Desktop installed and running
- 4GB+ RAM available
- Ports 3000, 3001, 5173, 6333, 6334 available

## All Services in One Command

```bash
# Start everything
./docker-start.sh

# Check status
./docker-status.sh

# View logs
./docker-logs.sh

# Stop everything
./docker-stop.sh
```

## What Gets Started

| Service | Port | URL |
|---------|------|-----|
| Visualizer Frontend | 5173 | http://localhost:5173 |
| Reality Engine API | 3000 | http://localhost:3000 |
| Visualizer Backend | 3001 | http://localhost:3001 |
| Qdrant Database | 6333 | http://localhost:6333/dashboard |

## Helper Scripts

All scripts are executable and ready to use:

### `./docker-start.sh`
Builds and starts all services in the correct order with health checks.

### `./docker-stop.sh`
Gracefully stops all services.

### `./docker-restart.sh`
Restarts all services without rebuilding.

### `./docker-status.sh`
Shows detailed status of all services including health checks and resource usage.

### `./docker-logs.sh [service]`
Shows logs. Examples:
```bash
./docker-logs.sh                    # All services
./docker-logs.sh reality-engine     # Just the API
./docker-logs.sh visualizer-frontend # Just the frontend
```

## Manual Docker Compose Commands

If you prefer using docker-compose directly:

```bash
# Start (detached mode)
docker-compose up -d

# Start with build
docker-compose up -d --build

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop
docker-compose down

# Stop and remove volumes (deletes data!)
docker-compose down -v

# Restart specific service
docker-compose restart reality-engine

# Rebuild specific service
docker-compose up -d --build reality-engine
```

## Configuration

Optional: Create `.env` file for custom settings:

```env
VECTOR_DIMENSION=256
MATCH_THRESHOLD=0.90
```

## First Time Setup

1. Make sure Docker Desktop is running
2. Clone/navigate to the project directory
3. Run `./docker-start.sh`
4. Wait for services to be healthy (30-60 seconds)
5. Open http://localhost:5173

## Troubleshooting

### "Port already in use"
```bash
# Find what's using the port
lsof -i :3000
# Kill the process or change ports in docker-compose.yml
```

### "Docker daemon not running"
Start Docker Desktop application.

### Services unhealthy
```bash
# Check logs for errors
./docker-logs.sh

# Check which service is failing
./docker-status.sh
```

### Need to reset everything
```bash
docker-compose down -v  # Removes all data!
./docker-start.sh
```

## Development vs Production

### Development (hot reload)
```bash
npm run dev  # Local development
```

### Production (Docker)
```bash
./docker-start.sh  # Containerized deployment
```

## Data Persistence

Your data is persisted in:
- `./data/` - Reality Engine data
- `./logs/` - Application logs
- Docker volume `qdrant_storage` - Vector database

## Next Steps

1. Access the visualizer at http://localhost:5173
2. Check out the API at http://localhost:3000/api/engine/stats
3. Read DOCKER.md for advanced configuration
4. View logs with `./docker-logs.sh`

## Full Documentation

For detailed information, see:
- `DOCKER.md` - Complete Docker guide
- `README.md` - Application documentation
- `visualizer/README.md` - Visualizer documentation
