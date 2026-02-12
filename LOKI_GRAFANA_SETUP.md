# Loki and Grafana Logging Setup

**Date:** 2026-02-12
**Status:** ✅ CONFIGURED

## Overview

Reality Engine now includes centralized logging with Grafana Loki and visualization with Grafana dashboards. All Docker containers automatically forward logs to Loki using the Docker log driver.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Reality Engine Services                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Qdrant  │  │ Reality  │  │Visualizer│  │Visualizer││
│  │          │  │  Engine  │  │ Backend  │  │ Frontend││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       │             │               │              │     │
│       └─────────────┴───────────────┴──────────────┘     │
│                         │                                │
│                   Loki Log Driver                        │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          ▼
                   ┌─────────────┐
                   │    Loki     │
                   │ (Port 3100) │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Grafana   │
                   │ (Port 3002) │
                   └─────────────┘
```

---

## Services

### Loki
- **Port:** 3100
- **Purpose:** Log aggregation and storage
- **Image:** grafana/loki:2.9.3
- **Storage:** Persistent volume (loki_data)
- **Retention:** 30 days (720 hours)

### Grafana
- **Port:** 3002
- **Purpose:** Log visualization and dashboards
- **Image:** grafana/grafana:10.2.3
- **Storage:** Persistent volume (grafana_data)
- **Default Credentials:** admin/admin

---

## Installation

### Automated Setup (Recommended)

The Loki Docker driver is automatically installed when you start the services:

```bash
./scripts/start.sh
```

The start script will:
1. Check if the Loki Docker plugin is installed
2. Install it automatically if not present
3. Verify the plugin is enabled
4. Start all services with Loki logging configured

### Manual Setup (Advanced)

If you prefer to install the plugin manually:

```bash
# Install Loki Docker plugin
./scripts/setup-loki-driver.sh
```

Or install directly:

```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

### Per-Container Configuration

The docker-compose.yml already includes Loki log driver configuration for each service. No additional setup needed.

---

## Starting the Stack

```bash
# Start all services including Loki and Grafana
docker-compose up -d

# Verify Loki is running
curl http://localhost:3100/ready

# Verify Grafana is running
curl http://localhost:3002/api/health
```

---

## Accessing Grafana

1. **Open Grafana:** http://localhost:3002
2. **Login:** admin / admin (change on first login)
3. **Navigate to Dashboard:** Reality Engine Overview

### Pre-configured Dashboard

The "Reality Engine Overview" dashboard includes:
- **Log Rate by Service** - Real-time log volume per service
- **Total Logs (5m)** - Gauge showing recent log volume
- **Reality Engine Logs** - Live log stream with filtering
- **Logs by Service (1h)** - Distribution pie chart
- **Error Logs** - Filtered view of errors only
- **Input Stream Logs** - Perceptual sequence input queue operations
- **Output Stream Logs** - Perceptual sequence output queue operations
- **Perceptual Sequence Operations Rate** - Real-time rate of sequence operations
- **Perceptual Operations Distribution** - Pie chart of operation types

---

## Querying Logs

### LogQL Examples

#### All Reality Engine Logs
```logql
{app="reality-engine"}
```

#### Logs from Specific Service
```logql
{app="reality-engine", service="reality-engine"}
{app="reality-engine", service="qdrant"}
{app="reality-engine", service="visualizer-backend"}
{app="reality-engine", service="visualizer-frontend"}
```

#### Error Logs Only
```logql
{app="reality-engine"} |~ "error|Error|ERROR"
```

#### Logs Containing Specific Text
```logql
{app="reality-engine"} |~ "perceptual"
{app="reality-engine"} |= "simulation"
```

#### Count Logs Over Time
```logql
sum(count_over_time({app="reality-engine"}[5m])) by (service)
```

#### Rate of Logs
```logql
rate({app="reality-engine"}[1m])
```

---

### Perceptual Sequence Queries

#### All Input Queue Operations
```logql
{app="reality-engine", queue_type="input"}
```

#### All Output Queue Operations
```logql
{app="reality-engine", queue_type="output"}
```

#### Vector Generation Logs
```logql
{app="reality-engine", log_type=~"vector-generate-.*"}
```

#### Queue Add Operations
```logql
{app="reality-engine", log_type=~".*-queue-add"}
```

#### Queue Remove Operations
```logql
{app="reality-engine", log_type=~".*-queue-remove|.*-queue-pop"}
```

#### Simulation Step Logs
```logql
{app="reality-engine", log_type="simulation-step"}
```

#### Perceptual Space Updates
```logql
{app="reality-engine", log_type="perceptual-space-update"}
```

#### Machine Input/Output Operations
```logql
{app="reality-engine", log_type=~"vector-extract-machine-input|vector-merge-machine-output"}
```

#### Rate of Input Queue Operations
```logql
sum(rate({app="reality-engine", queue_type="input"}[1m]))
```

#### Rate of Output Queue Operations
```logql
sum(rate({app="reality-engine", queue_type="output"}[1m]))
```

#### Operations by Type
```logql
sum by (log_type) (count_over_time({app="reality-engine", service="visualizer-frontend"}[5m]))
```

---

## Log Labels

All logs are automatically tagged with the following labels:

### Backend Service Labels (Docker Log Driver)

- **app:** `reality-engine` (all services)
- **service:** Service name (qdrant, reality-engine, visualizer-backend, visualizer-frontend)
- **environment:** `production`

Additional Docker labels:
- **container_name:** Docker container name
- **image_name:** Docker image name
- **compose_service:** Service name from docker-compose.yml

### Frontend Perceptual Sequence Labels (API Ingestion)

Frontend logs from the perceptual sequence logger include:

- **app:** `reality-engine`
- **service:** `visualizer-frontend`
- **environment:** `production`
- **log_type:** Operation type (see below)
- **log_level:** Log level (debug, info, warn, error)
- **queue_type:** Queue type (input, output, unknown)

#### Log Types

The perceptual sequence logger generates these log types:

**Input Queue Operations:**
- `input-queue-add` - Single vector added to input queue
- `input-queue-add-bulk` - Multiple vectors added to input queue
- `input-queue-pop` - Vector popped from input queue
- `input-queue-remove` - Vector removed from input queue
- `input-queue-clear` - Input queue cleared

**Output Queue Operations:**
- `output-queue-add` - Vector added to output queue
- `output-queue-remove` - Vector removed from output queue
- `output-queue-clear` - Output queue cleared

**Vector Operations:**
- `vector-generate-algorithmic` - Algorithmic vector sequence generated
- `vector-generate-random` - Random vector sequence generated
- `vector-process-start` - Vector processing started
- `vector-process-complete` - Vector processing completed
- `vector-extract-machine-input` - Machine input extracted from universal vector
- `vector-merge-machine-output` - Machine output merged into universal vector

**Simulation Operations:**
- `perceptual-space-update` - Perceptual space updated
- `simulation-step` - Simulation step executed
- `queue-state-snapshot` - Queue state snapshot captured

---

## Configuration Files

### Loki Configuration
**File:** `config/loki-config.yml`

Key settings:
- **Storage:** Filesystem (BoltDB + filesystem chunks)
- **Retention:** 30 days (720 hours)
- **Max query lookback:** 30 days
- **Ingestion rate:** 16MB/s (32MB burst)
- **Max streams:** 10,000 per user
- **Compaction:** Every 10 minutes

### Grafana Datasources
**File:** `config/grafana-datasources.yml`

Configures Loki as the default datasource at `http://loki:3100`

### Grafana Dashboards
**File:** `config/grafana-dashboards.yml`

Auto-provisions dashboards from `config/dashboards/` directory

### Docker Daemon Configuration
**File:** `config/docker-daemon.json`

System-wide Loki log driver configuration (optional)

---

## Log Driver Configuration

Each service in docker-compose.yml uses the Loki log driver:

```yaml
logging:
  driver: loki
  options:
    loki-url: "http://localhost:3100/loki/api/v1/push"
    loki-batch-size: "400"
    loki-retries: "2"
    loki-max-backoff: "1000ms"
    labels: "service=<service-name>,environment=production,app=reality-engine"
```

**Driver Options:**
- **loki-url:** Loki push endpoint
- **loki-batch-size:** Number of logs to batch before sending
- **loki-retries:** Number of retry attempts
- **loki-max-backoff:** Maximum backoff time between retries
- **labels:** Static labels attached to all logs

---

## Troubleshooting

### Logs Not Appearing in Grafana

1. **Check Loki health:**
   ```bash
   curl http://localhost:3100/ready
   ```

2. **Check Loki logs:**
   ```bash
   docker logs reality-engine-loki
   ```

3. **Verify containers are using Loki driver:**
   ```bash
   docker inspect reality-engine-app | grep LogConfig -A 10
   ```

4. **Test log ingestion manually:**
   ```bash
   curl -H "Content-Type: application/json" \
        -XPOST http://localhost:3100/loki/api/v1/push \
        --data '{"streams": [{"stream": {"test": "test"}, "values": [["'$(date +%s)'000000000", "test log"]]}]}'
   ```

### Grafana Can't Connect to Loki

1. **Check Docker network:**
   ```bash
   docker network inspect reality-network
   ```

2. **Verify Loki is in network:**
   ```bash
   docker inspect reality-engine-loki | grep NetworkMode
   ```

3. **Test connectivity from Grafana container:**
   ```bash
   docker exec reality-engine-grafana wget -O- http://loki:3100/ready
   ```

### High Memory Usage

If Loki consumes too much memory:

1. **Reduce retention period** in `config/loki-config.yml`:
   ```yaml
   table_manager:
     retention_period: 168h  # 7 days instead of 30
   ```

2. **Reduce ingestion limits:**
   ```yaml
   limits_config:
     ingestion_rate_mb: 8
     ingestion_burst_size_mb: 16
   ```

3. **Restart Loki:**
   ```bash
   docker-compose restart loki
   ```

### Docker Daemon Won't Start After Configuration

If Docker fails to start after applying daemon.json:

1. **Check syntax:**
   ```bash
   python -m json.tool /etc/docker/daemon.json
   ```

2. **View Docker daemon logs:**
   ```bash
   sudo journalctl -u docker.service --no-pager | tail -50
   ```

3. **Revert to backup:**
   ```bash
   sudo cp /etc/docker/daemon.json.backup /etc/docker/daemon.json
   sudo systemctl restart docker
   ```

---

## Performance Considerations

### Log Volume

Typical log volumes:
- **Reality Engine API:** ~100-500 logs/min
- **Qdrant:** ~50-100 logs/min
- **Visualizer Backend:** ~50-200 logs/min
- **Visualizer Frontend:** ~10-50 logs/min

**Total:** ~200-850 logs/min (~12,000-51,000 logs/hour)

### Storage

Estimated storage requirements:
- **Average log size:** 200-500 bytes
- **Hourly storage:** 2.4-25.5 MB/hour
- **Daily storage:** 57.6-612 MB/day
- **30-day storage:** 1.7-18.4 GB

With compression, expect ~30-50% reduction.

### Resource Usage

**Loki:**
- **CPU:** 0.1-0.5 cores (idle-active)
- **Memory:** 256MB-1GB
- **Disk I/O:** Low-moderate

**Grafana:**
- **CPU:** 0.05-0.2 cores
- **Memory:** 128MB-512MB
- **Disk I/O:** Low

---

## Advanced Usage

### Creating Custom Dashboards

1. **Open Grafana:** http://localhost:3002
2. **Navigate to:** Dashboards → New Dashboard
3. **Add Panel**
4. **Select Loki datasource**
5. **Enter LogQL query**
6. **Configure visualization**
7. **Save dashboard**

### Alerting

Configure alerts in Grafana:

1. **Navigate to:** Alerting → Alert rules
2. **Create alert rule**
3. **Set query:**
   ```logql
   sum(count_over_time({app="reality-engine"} |~ "ERROR"[5m])) > 10
   ```
4. **Configure notification channel** (email, Slack, etc.)

### Log Retention Policies

Modify retention in `config/loki-config.yml`:

```yaml
table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days

compactor:
  retention_enabled: true
  retention_delete_delay: 2h
```

### Multi-Tenant Setup

Enable authentication in `config/loki-config.yml`:

```yaml
auth_enabled: true

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

# Add tenant configuration
```

Then use `X-Scope-OrgID` header in log driver:

```yaml
logging:
  driver: loki
  options:
    loki-url: "http://localhost:3100/loki/api/v1/push"
    loki-external-labels: "X-Scope-OrgID=tenant-1"
```

---

## Integration with Perceptual Sequence Logger

The frontend perceptual sequence logger can also be exported and ingested into Loki:

```typescript
import { perceptualLogger } from './utils/perceptualSequenceLogger';

// Export logs
const logs = perceptualLogger.exportToJSON();

// Send to backend endpoint for Loki ingestion
fetch('/api/logs/ingest', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: logs
});
```

---

## References

- [Grafana Loki Documentation](https://grafana.com/docs/loki/latest/)
- [LogQL Language](https://grafana.com/docs/loki/latest/logql/)
- [Docker Loki Driver](https://grafana.com/docs/loki/latest/clients/docker-driver/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)

---

## Summary

**Components Added:**
- ✅ Loki log aggregation service (port 3100)
- ✅ Grafana visualization service (port 3002)
- ✅ Loki Docker log driver configuration
- ✅ Pre-configured Reality Engine dashboard
- ✅ Automated log collection from all services

**Benefits:**
- Centralized log management
- Real-time log streaming
- Powerful query language (LogQL)
- Beautiful visualizations
- 30-day retention
- Low resource overhead

**Access Points:**
- **Grafana UI:** http://localhost:3002
- **Loki API:** http://localhost:3100

All Reality Engine services now automatically send logs to Loki for centralized monitoring and analysis!
