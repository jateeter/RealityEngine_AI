# Docker Deployment Guide

This guide explains how to run the entire Reality Engine application stack using Docker Compose.

## Architecture

The application consists of four services:

1. **Qdrant** - Vector database (ports 6333, 6334)
2. **Reality Engine API** - Core engine (port 3000)
3. **Visualizer Backend** - Proxy server (port 3001)
4. **Visualizer Frontend** - Web UI (port 5173)

All services run in isolated containers and communicate over a Docker network.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM recommended
- 2GB+ free disk space

## Quick Start

### 1. Start All Services

```bash
docker-compose up -d
```

This will:
- Build Docker images for all services
- Start containers in the correct order
- Set up networking and volumes
- Run health checks

### 2. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f reality-engine
docker-compose logs -f visualizer-backend
docker-compose logs -f visualizer-frontend
docker-compose logs -f qdrant
```

### 3. Check Status

```bash
docker-compose ps
```

### 4. Access Services

- **Reality Engine API**: http://localhost:3000
- **Visualizer Frontend**: http://localhost:5173
- **Visualizer Backend**: http://localhost:3001
- **Qdrant Dashboard**: http://localhost:6333/dashboard

### 5. Stop Services

```bash
# Stop but keep containers
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and delete volumes (WARNING: deletes data)
docker-compose down -v
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Vector Configuration
VECTOR_DIMENSION=128
MATCH_THRESHOLD=0.85

# Optional: Override ports
# PORT=3000
# VIZ_PORT=3001
```

The docker-compose.yml uses these variables with defaults.

### Persistent Data

Data is persisted in Docker volumes:

- `qdrant_storage` - Vector database data
- `./data` - Reality Engine data (host mount)
- `./logs` - Application logs (host mount)

## Service Details

### Qdrant (Vector Database)

```yaml
Ports: 6333 (HTTP), 6334 (gRPC)
Health Check: HTTP GET to /
Restart: unless-stopped
```

### Reality Engine API

```yaml
Port: 3000
Depends On: Qdrant
Health Check: GET /api/engine/stats
Environment:
  - QDRANT_URL=http://qdrant:6333
  - VECTOR_DIMENSION=128
  - MATCH_THRESHOLD=0.85
```

### Visualizer Backend

```yaml
Port: 3001
Depends On: Reality Engine
Health Check: GET /health
Environment:
  - REALITY_ENGINE_URL=http://reality-engine:3000
```

### Visualizer Frontend

```yaml
Port: 5173 (mapped from 80)
Depends On: Visualizer Backend
Technology: Nginx serving React build
Proxy: /api -> visualizer-backend:3001
```

## Development vs Production

### Development Mode (Local)

Use this for development with hot reload:

```bash
# Terminal 1: Reality Engine
npm run dev

# Terminal 2: Visualizer Backend
cd visualizer/backend && npm run dev

# Terminal 3: Visualizer Frontend
cd visualizer/frontend && npm run dev
```

### Production Mode (Docker)

Use docker-compose for production deployment:

```bash
docker-compose up -d
```

The Docker setup uses:
- Multi-stage builds for smaller images
- Production dependencies only
- Nginx for efficient static file serving
- Health checks for reliability
- Automatic restarts

## Useful Commands

### Build and Restart Specific Service

```bash
# Rebuild after code changes
docker-compose build reality-engine
docker-compose up -d reality-engine

# Or rebuild and restart in one command
docker-compose up -d --build reality-engine
```

### Scale Services (if needed)

```bash
# Note: Currently not configured for horizontal scaling
docker-compose up -d --scale reality-engine=2
```

### Execute Commands in Container

```bash
# Open shell
docker-compose exec reality-engine sh

# Run command
docker-compose exec reality-engine npm test
```

### View Resource Usage

```bash
docker stats
```

### Clean Up Everything

```bash
# Remove all containers, networks, and images
docker-compose down --rmi all

# Also remove volumes (deletes data!)
docker-compose down --rmi all -v

# Prune unused Docker resources
docker system prune -a
```

## Troubleshooting

### Services Won't Start

1. Check if ports are already in use:
   ```bash
   lsof -i :3000
   lsof -i :3001
   lsof -i :5173
   lsof -i :6333
   ```

2. Check Docker logs:
   ```bash
   docker-compose logs reality-engine
   ```

3. Verify Docker daemon is running:
   ```bash
   docker ps
   ```

### Health Checks Failing

Wait for services to fully initialize. Health checks may fail during startup.

```bash
# Watch health status
watch docker-compose ps
```

### Build Failures

1. Clear Docker cache:
   ```bash
   docker-compose build --no-cache
   ```

2. Check Dockerfile syntax

3. Ensure all dependencies are in package.json

### Connection Issues Between Services

Services communicate using container names as hostnames:
- `http://qdrant:6333` (not localhost)
- `http://reality-engine:3000`
- `http://visualizer-backend:3001`

### Qdrant Data Corruption

If Qdrant data is corrupted, recreate the volume:

```bash
docker-compose down
docker volume rm realityengine_qdrant_storage
docker-compose up -d
```

### Out of Disk Space

Check Docker disk usage:

```bash
docker system df

# Clean up
docker system prune -a --volumes
```

## Performance Tuning

### Resource Limits

Add resource constraints in docker-compose.yml:

```yaml
services:
  reality-engine:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### Qdrant Performance

Adjust Qdrant settings for your workload:

```yaml
qdrant:
  environment:
    - QDRANT__STORAGE__OPTIMIZERS__DEFAULT_SEGMENT_NUMBER=4
    - QDRANT__STORAGE__WAL_CAPACITY_MB=128
```

## Security Considerations

### Production Deployment

For production, consider:

1. **Use secrets management**:
   ```bash
   docker secret create qdrant_api_key ./qdrant_key.txt
   ```

2. **Enable TLS**:
   - Use reverse proxy (nginx, traefik)
   - Add SSL certificates

3. **Network isolation**:
   - Don't expose internal ports
   - Use internal networks

4. **Regular updates**:
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

## Monitoring

### Health Status

```bash
curl http://localhost:3000/api/engine/stats
curl http://localhost:3001/health
curl http://localhost:6333/
```

### Logs

Configure logging driver in docker-compose.yml:

```yaml
services:
  reality-engine:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Backup and Restore

### Backup Qdrant Data

```bash
docker-compose exec qdrant tar czf /tmp/qdrant-backup.tar.gz /qdrant/storage
docker cp reality-engine-qdrant:/tmp/qdrant-backup.tar.gz ./backups/
```

### Restore Qdrant Data

```bash
docker-compose down
docker volume rm realityengine_qdrant_storage
docker volume create realityengine_qdrant_storage
docker run --rm -v realityengine_qdrant_storage:/qdrant/storage \
  -v $(pwd)/backups:/backup alpine \
  tar xzf /backup/qdrant-backup.tar.gz -C /
docker-compose up -d
```

## CI/CD Integration

### Example GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and Deploy
        run: |
          docker-compose build
          docker-compose up -d
```

## Additional Resources

- Docker Compose Documentation: https://docs.docker.com/compose/
- Qdrant Documentation: https://qdrant.tech/documentation/
- Node.js Docker Best Practices: https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md

## Support

For issues specific to Docker deployment, check:
1. Docker logs: `docker-compose logs`
2. Container status: `docker-compose ps`
3. Network connectivity: `docker network inspect realityengine_reality-network`
