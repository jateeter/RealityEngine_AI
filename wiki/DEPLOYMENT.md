# Reality Engine - Deployment Guide

Complete guide for deploying and managing the Reality Engine system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Scripts](#deployment-scripts)
- [Configuration](#configuration)
- [Deployment Scenarios](#deployment-scenarios)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Production Considerations](#production-considerations)

---

## Prerequisites

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| Node.js | 18.x | Runtime environment |
| npm | 8.x | Package management |
| Docker | 20.x | Container platform |
| Docker Compose | 2.x | Multi-container orchestration |

### System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4GB
- Disk: 10GB available
- OS: Linux, macOS, or Windows with WSL2

**Recommended:**
- CPU: 4+ cores
- RAM: 8GB+
- Disk: 50GB+ SSD
- OS: Linux (Ubuntu 20.04+)

### Network Requirements

**Required Ports:**
- `3000` - Reality Engine API (configurable via `PORT` env var)
- `6333` - Qdrant HTTP API
- `6334` - Qdrant gRPC

**Firewall Rules:**
If deploying to production, configure firewall to allow:
- Inbound: Port 3000 (API access)
- Internal: Ports 6333, 6334 (Qdrant)

---

## Quick Start

### 1. Initial Setup

Clone and set up the repository:

```bash
cd realityEngine

# Run automated setup
./scripts/setup.sh
```

The setup script will:
- ✓ Check prerequisites
- ✓ Create `.env` file from template
- ✓ Install npm dependencies
- ✓ Build TypeScript code
- ✓ Create necessary directories
- ✓ Set script permissions

### 2. Start Services

```bash
./scripts/start.sh
```

This starts:
- Qdrant vector database
- Reality Engine API

### 3. Verify Deployment

```bash
./scripts/status.sh
```

Expected output:
```
Reality Engine - Service Status
=================================

Qdrant Vector Database:
  Status: RUNNING
  Health: HEALTHY
  URL:    http://localhost:6333

Reality Engine API:
  Status: RUNNING
  Health: HEALTHY
  URL:    http://localhost:3000
```

### 4. Run Health Check

```bash
./scripts/health-check.sh
```

### 5. Test with Example

```bash
./scripts/examples/create-sequence.sh
./scripts/examples/process-input.sh
```

---

## Deployment Scripts

All scripts are located in the `scripts/` directory.

### Core Management Scripts

#### `setup.sh` - Initial Setup

Prepares the environment for first-time deployment.

```bash
./scripts/setup.sh
```

**What it does:**
- Validates prerequisites
- Creates configuration files
- Installs dependencies
- Builds application
- Sets permissions

**When to use:**
- First-time setup
- After fresh clone
- After major updates

---

#### `start.sh` - Start Services

Starts all Reality Engine services.

```bash
./scripts/start.sh
```

**What it does:**
- Starts Qdrant container
- Waits for Qdrant to be ready
- Starts Reality Engine API
- Verifies health of all services

**Output:**
- Service URLs
- API PID (saved to `.api.pid`)
- Status of each component

**Post-start verification:**
```bash
curl http://localhost:3000/api/health
curl http://localhost:6333/health
```

---

#### `stop.sh` - Stop Services

Gracefully stops all services.

```bash
./scripts/stop.sh
```

**What it does:**
- Sends SIGTERM to API process
- Waits for graceful shutdown (10s)
- Force kills if necessary
- Stops Qdrant container
- Cleans up PID files

**Safe to run:**
- Even if services already stopped
- Multiple times without errors

---

#### `restart.sh` - Restart Services

Restarts all services (stop + start).

```bash
./scripts/restart.sh
```

**When to use:**
- After configuration changes
- After code updates
- To clear state issues
- Regular maintenance restarts

---

#### `status.sh` - Check Status

Shows current status of all services.

```bash
./scripts/status.sh
```

**Displays:**
- Qdrant: Status, Health, URLs
- API: Status, PID, Health, Stats
- Docker: Status
- Overall system status

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
```

---

#### `logs.sh` - View Logs

View logs from various services.

```bash
# View all logs (default)
./scripts/logs.sh

# View API logs only
./scripts/logs.sh api

# View Qdrant logs only
./scripts/logs.sh qdrant

# Specify number of lines
./scripts/logs.sh api 100

# Follow logs in real-time
./scripts/logs.sh follow
```

**Log Locations:**
- API logs: `logs/api.log`
- Qdrant logs: Docker container logs

---

#### `health-check.sh` - Comprehensive Health Check

Performs detailed health checks on all components.

```bash
./scripts/health-check.sh
```

**Checks performed:**
1. Docker daemon status
2. Qdrant container status
3. Qdrant HTTP endpoint
4. Qdrant collections
5. API process status
6. API HTTP endpoint
7. API configuration access
8. Engine statistics access
9. Disk space availability
10. Memory usage

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed

**Use in monitoring:**
```bash
# In crontab for periodic checks
*/5 * * * * /path/to/scripts/health-check.sh || /path/to/scripts/restart.sh
```

---

### Example Scripts

Located in `scripts/examples/`.

#### `create-sequence.sh` - Create Example Sequence

Creates a binary state machine sequence.

```bash
./scripts/examples/create-sequence.sh
```

**Creates:**
- State A (value: 1.0)
- State B (value: 0.0)
- Bidirectional transitions
- Output vectors for each state

---

#### `process-input.sh` - Process Input Vectors

Demonstrates processing input through the engine.

```bash
./scripts/examples/process-input.sh
```

**Tests:**
- State A input [1.0]
- State B input [0.0]
- Displays outputs and active vectors

---

#### `sampler-demo.sh` - Reality Sampler Demo

Demonstrates the reality sampling system.

```bash
./scripts/examples/sampler-demo.sh
```

**Demonstrates:**
- Starting sampler with periodic strategy
- Sampling random observations
- Checking sampler statistics
- Stopping sampler

---

#### `pattern-recognition.sh` - Pattern Recognition

Creates and tests a pattern recognition sequence.

```bash
./scripts/examples/pattern-recognition.sh
```

**Tests:**
- Close match (within threshold)
- Exact match
- No match (outside threshold)

---

## Configuration

### Environment Variables

Configuration is managed through the `.env` file.

**Template:** `.env.example`

#### Core Settings

```bash
# Vector Configuration
VECTOR_DIMENSION=128        # Dimension of reality vectors (1-4096)
MATCH_THRESHOLD=0.85        # Default match threshold (0.0-1.0)

# Server Configuration
PORT=3000                   # API server port
NODE_ENV=development        # Environment (development|production)

# Qdrant Configuration
QDRANT_URL=http://localhost:6333  # Qdrant connection URL
COLLECTION_NAME=reality_vectors    # Vector collection name
```

#### Modifying Configuration

1. **Edit `.env` file:**
   ```bash
   nano .env
   ```

2. **Restart services:**
   ```bash
   ./scripts/restart.sh
   ```

3. **Verify changes:**
   ```bash
   curl http://localhost:3000/api/config
   ```

#### Runtime Configuration

Some settings can be changed via API without restart:

```bash
# Update vector dimension
curl -X PUT http://localhost:3000/api/config/dimension \
  -H "Content-Type: application/json" \
  -d '{"dimension": 256}'

# Update match threshold
curl -X PUT http://localhost:3000/api/config/threshold \
  -H "Content-Type: application/json" \
  -d '{"threshold": 0.90}'
```

⚠️ **Warning:** Changing vector dimension after storing vectors may cause issues. Migrate data first.

---

## Deployment Scenarios

### Scenario 1: Development Environment

**Goal:** Local development and testing

**Steps:**
```bash
# 1. Setup
./scripts/setup.sh

# 2. Start services
./scripts/start.sh

# 3. Run tests
npm test

# 4. Develop with auto-reload
npm run dev

# 5. View logs during development
./scripts/logs.sh follow
```

**Configuration:**
```bash
NODE_ENV=development
VECTOR_DIMENSION=128
PORT=3000
```

---

### Scenario 2: Production Deployment (Single Server)

**Goal:** Production deployment on single server

**Steps:**

1. **System Setup:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER

   # Install Node.js 22
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs
   ```

2. **Application Setup:**
   ```bash
   cd /opt/reality-engine
   ./scripts/setup.sh
   ```

3. **Configure for Production:**
   ```bash
   # Edit .env
   NODE_ENV=production
   VECTOR_DIMENSION=256
   PORT=3000
   QDRANT_URL=http://qdrant:6333
   ```

4. **Start Services:**
   ```bash
   ./scripts/start.sh
   ```

5. **Setup systemd service:**
   ```bash
   sudo nano /etc/systemd/system/reality-engine.service
   ```

   ```ini
   [Unit]
   Description=Reality Engine
   After=docker.service
   Requires=docker.service

   [Service]
   Type=forking
   User=reality-engine
   WorkingDirectory=/opt/reality-engine
   ExecStart=/opt/reality-engine/scripts/start.sh
   ExecStop=/opt/reality-engine/scripts/stop.sh
   Restart=on-failure
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable reality-engine
   sudo systemctl start reality-engine
   ```

6. **Setup monitoring:**
   ```bash
   # Add to crontab
   crontab -e
   ```

   ```
   */5 * * * * /opt/reality-engine/scripts/health-check.sh || /opt/reality-engine/scripts/restart.sh
   ```

7. **Configure firewall:**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw enable
   ```

---

### Scenario 3: Docker Compose Production

**Goal:** Full containerized deployment

**Steps:**

1. **Build production image:**
   ```bash
   docker-compose build
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **Check status:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

4. **Scale API (if needed):**
   ```bash
   docker-compose up -d --scale reality-engine=3
   ```

---

### Scenario 4: Behind Reverse Proxy (Nginx)

**Goal:** Deploy behind Nginx with SSL

**Nginx Configuration:**

```nginx
upstream reality_engine {
    server localhost:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name reality-engine.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name reality-engine.example.com;

    ssl_certificate /etc/ssl/certs/reality-engine.crt;
    ssl_certificate_key /etc/ssl/private/reality-engine.key;

    location / {
        proxy_pass http://reality_engine;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Monitoring & Maintenance

### Health Monitoring

**Automated Health Checks:**

Add to crontab:
```bash
crontab -e
```

```bash
# Check health every 5 minutes
*/5 * * * * /path/to/scripts/health-check.sh >> /var/log/reality-engine-health.log 2>&1

# Restart if unhealthy
*/5 * * * * /path/to/scripts/health-check.sh || /path/to/scripts/restart.sh
```

**Monitoring Endpoints:**
- Health: `GET /api/health`
- Stats: `GET /api/engine/stats`
- Config: `GET /api/config`
- Active Vectors: `GET /api/engine/active`

**Monitoring Script Example:**

```bash
#!/bin/bash
# monitor.sh - Custom monitoring script

while true; do
    if ! curl -s http://localhost:3000/api/health > /dev/null; then
        echo "$(date): API unhealthy, restarting..." >> /var/log/monitor.log
        ./scripts/restart.sh
    fi

    # Check memory usage
    MEM=$(ps aux | grep 'npm start' | awk '{print $4}' | head -1)
    if (( $(echo "$MEM > 80" | bc -l) )); then
        echo "$(date): High memory usage: ${MEM}%" >> /var/log/monitor.log
    fi

    sleep 60
done
```

---

### Log Management

**Log Rotation Configuration:**

Create `/etc/logrotate.d/reality-engine`:

```
/path/to/realityEngine/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 reality-engine reality-engine
    postrotate
        /path/to/scripts/restart.sh > /dev/null 2>&1
    endscript
}
```

**View Logs:**
```bash
# Last 100 lines of API logs
./scripts/logs.sh api 100

# Follow all logs
./scripts/logs.sh follow

# Search logs
grep "ERROR" logs/api.log

# View Qdrant logs
./scripts/logs.sh qdrant
```

---

### Backup and Restore

**Backup Qdrant Data:**

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/reality-engine"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup Qdrant data
docker-compose exec qdrant tar czf /tmp/qdrant-backup.tar.gz /qdrant/storage
docker cp reality-engine-qdrant:/tmp/qdrant-backup.tar.gz $BACKUP_DIR/qdrant-$DATE.tar.gz

# Backup configurations
tar czf $BACKUP_DIR/config-$DATE.tar.gz .env docker-compose.yml

echo "Backup completed: $BACKUP_DIR/qdrant-$DATE.tar.gz"
```

**Restore from Backup:**

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: ./restore.sh <backup-file.tar.gz>"
    exit 1
fi

# Stop services
./scripts/stop.sh

# Restore Qdrant data
docker cp $BACKUP_FILE reality-engine-qdrant:/tmp/qdrant-backup.tar.gz
docker-compose exec qdrant tar xzf /tmp/qdrant-backup.tar.gz -C /

# Start services
./scripts/start.sh

echo "Restore completed"
```

---

### Performance Tuning

**Node.js Memory Settings:**

```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**Qdrant Performance:**

Edit `docker-compose.yml`:

```yaml
qdrant:
  image: qdrant/qdrant:latest
  environment:
    - QDRANT__SERVICE__MAX_REQUEST_SIZE_MB=128
    - QDRANT__STORAGE__PERFORMANCE__MAX_SEARCH_THREADS=8
  deploy:
    resources:
      limits:
        memory: 4G
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

---

#### Issue 2: Qdrant Won't Start

**Symptoms:**
```
Error: Qdrant container exited
```

**Solution:**
```bash
# Check Qdrant logs
./scripts/logs.sh qdrant

# Remove container and volumes
docker-compose down -v

# Restart
./scripts/start.sh
```

---

#### Issue 3: API Not Responding

**Symptoms:**
- API health check fails
- Connection refused errors

**Diagnosis:**
```bash
# Check if process is running
./scripts/status.sh

# Check logs for errors
./scripts/logs.sh api

# Check port binding
netstat -tlnp | grep 3000
```

**Solution:**
```bash
# Restart services
./scripts/restart.sh

# If still failing, check for code errors
npm run build
```

---

#### Issue 4: Out of Memory

**Symptoms:**
```
FATAL ERROR: Reached heap limit
```

**Solution:**
```bash
# Increase Node.js memory
echo 'NODE_OPTIONS="--max-old-space-size=4096"' >> .env

# Restart
./scripts/restart.sh
```

---

#### Issue 5: Docker Daemon Not Running

**Symptoms:**
```
Cannot connect to the Docker daemon
```

**Solution:**
```bash
# Start Docker
sudo systemctl start docker

# Enable on boot
sudo systemctl enable docker
```

---

### Debug Mode

Enable detailed logging:

```bash
# Set in .env
DEBUG=*
LOG_LEVEL=debug

# Restart
./scripts/restart.sh

# View logs
./scripts/logs.sh follow
```

---

## Production Considerations

### Security Checklist

- [ ] Change default ports
- [ ] Enable firewall rules
- [ ] Use environment-specific `.env` files
- [ ] Implement API authentication
- [ ] Enable HTTPS/TLS
- [ ] Restrict Qdrant access
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Implement rate limiting
- [ ] Use secrets management

### High Availability

For production HA setup:

1. **Load Balancer:** Use Nginx/HAProxy
2. **Multiple API Instances:** Scale horizontally
3. **Qdrant Clustering:** Configure Qdrant cluster
4. **Health Checks:** Automated monitoring
5. **Failover:** Automatic service recovery
6. **Backups:** Regular automated backups

### Scaling Guidelines

**Vertical Scaling:**
- Increase memory allocation
- Add more CPU cores
- Use SSD storage

**Horizontal Scaling:**
```bash
# Scale API instances
docker-compose up -d --scale reality-engine=5
```

**Database Scaling:**
- Configure Qdrant cluster
- Use separate storage volumes
- Implement sharding

---

## Quick Reference

### Essential Commands

```bash
# Setup
./scripts/setup.sh

# Start/Stop
./scripts/start.sh
./scripts/stop.sh
./scripts/restart.sh

# Monitoring
./scripts/status.sh
./scripts/health-check.sh
./scripts/logs.sh

# Examples
./scripts/examples/create-sequence.sh
./scripts/examples/process-input.sh
./scripts/examples/sampler-demo.sh
```

### API Quick Reference

```bash
# Health
curl http://localhost:3000/api/health

# Config
curl http://localhost:3000/api/config

# Stats
curl http://localhost:3000/api/engine/stats

# Create sequence
curl -X POST http://localhost:3000/api/sequences \
  -H "Content-Type: application/json" \
  -d @sequence.json

# Process input
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.5, 0.8]}'
```

---

## Support

For issues and questions:

1. Check logs: `./scripts/logs.sh`
2. Run health check: `./scripts/health-check.sh`
3. Review this guide and README.md
4. Check ARCHITECTURE.md for system details
5. Report issues on GitHub

---

**Version:** 1.0.0
**Last Updated:** 2025-12-05
**Maintainer:** Reality Engine Team
