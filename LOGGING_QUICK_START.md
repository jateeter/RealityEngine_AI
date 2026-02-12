# Logging Quick Start Guide

**Date:** 2026-02-12
**Status:** ✅ CONFIGURED

## Overview

The Reality Engine suite is now configured with comprehensive logging through Grafana Loki, capturing both backend service logs and frontend perceptual sequence operations.

---

## What's Logged

### Backend Services (Automatic via Docker Log Driver)
- **Qdrant** - Vector database operations
- **Reality Engine API** - Core engine processing
- **Visualizer Backend** - Proxy and WebSocket events
- **Visualizer Frontend** - HTTP requests

### Frontend Perceptual Sequences (Automatic via API Ingestion)
- **Input Queue Operations** - Vector additions, removals, pops, clears
- **Output Queue Operations** - Machine output vectors
- **Vector Generation** - Algorithmic and random sequence generation
- **Vector Processing** - Machine input extraction and output merging
- **Simulation Steps** - Perceptual space updates
- **Queue Snapshots** - State captures

---

## Quick Access

### Grafana Dashboard
**URL:** http://localhost:3002
**Login:** admin / admin

Navigate to: **Dashboards → Reality Engine Overview**

### Dashboard Panels

1. **Log Rate by Service** - Real-time log volume from all services
2. **Total Logs (5m)** - Gauge showing recent activity
3. **Reality Engine Logs** - Live stream of all backend logs
4. **Logs by Service (1h)** - Distribution pie chart
5. **Error Logs** - Filtered error messages only
6. **Input Stream Logs** - Perceptual input queue operations
7. **Output Stream Logs** - Perceptual output queue operations
8. **Perceptual Sequence Operations Rate** - Real-time operation rates
9. **Perceptual Operations Distribution** - Operation type breakdown

---

## Common Queries

### View All Input Queue Operations
```logql
{app="reality-engine", queue_type="input"}
```

### View All Output Queue Operations
```logql
{app="reality-engine", queue_type="output"}
```

### View Vector Generation Events
```logql
{app="reality-engine", log_type=~"vector-generate-.*"}
```

### View Simulation Steps
```logql
{app="reality-engine", log_type="simulation-step"}
```

### View Machine Input/Output Operations
```logql
{app="reality-engine", log_type=~"vector-extract-machine-input|vector-merge-machine-output"}
```

### View Errors Across All Services
```logql
{app="reality-engine"} |~ "error|Error|ERROR"
```

### Rate of Input Queue Operations
```logql
sum(rate({app="reality-engine", queue_type="input"}[1m]))
```

### Operations by Type (Last 5 Minutes)
```logql
sum by (log_type) (count_over_time({app="reality-engine", service="visualizer-frontend"}[5m]))
```

---

## Log Labels

### All Logs
- `app` = "reality-engine"
- `environment` = "production"

### Backend Services
- `service` = "qdrant" | "reality-engine" | "visualizer-backend" | "visualizer-frontend"

### Frontend Perceptual Logs
- `service` = "visualizer-frontend"
- `log_type` = Operation type (see below)
- `log_level` = "debug" | "info" | "warn" | "error"
- `queue_type` = "input" | "output" | "unknown"

---

## Perceptual Log Types

### Input Queue (6 types)
- `input-queue-add` - Single vector added
- `input-queue-add-bulk` - Multiple vectors added
- `input-queue-pop` - Vector popped
- `input-queue-remove` - Vector removed
- `input-queue-clear` - Queue cleared

### Output Queue (3 types)
- `output-queue-add` - Vector added
- `output-queue-remove` - Vector removed
- `output-queue-clear` - Queue cleared

### Vector Operations (6 types)
- `vector-generate-algorithmic` - Algorithmic pattern generated
- `vector-generate-random` - Random vector generated
- `vector-process-start` - Processing started
- `vector-process-complete` - Processing completed
- `vector-extract-machine-input` - Input extracted from universal vector
- `vector-merge-machine-output` - Output merged to universal vector

### Simulation (3 types)
- `perceptual-space-update` - Perceptual space modified
- `simulation-step` - Simulation advanced
- `queue-state-snapshot` - State captured

---

## Testing the Setup

### Step 1: Start the Services
```bash
./scripts/start.sh
```

The Loki Docker driver will be installed automatically if not present.

### Step 2: Open Grafana
Navigate to http://localhost:3002 and login with admin/admin.

### Step 3: Open the Dashboard
Go to **Dashboards → Reality Engine Overview**

### Step 4: Generate Perceptual Sequence Logs

1. Open the visualizer: http://localhost:5173
2. Load a machine (e.g., RS Flip Flop)
3. Click "📋 Logs" in the Global Current Vector Display
4. Generate some random vectors or load an algorithmic sequence
5. Run a simulation

### Step 5: View Logs in Grafana

Return to Grafana and you should see:
- Backend service logs appearing in "Reality Engine Logs"
- Input queue operations in "Input Stream Logs"
- Output queue operations in "Output Stream Logs"
- Operation rates updating in the time series chart
- Operation distribution in the pie chart

---

## Log Retention

- **Duration:** 30 days (720 hours)
- **Compaction:** Every 10 minutes
- **Max Query Lookback:** 30 days

---

## How It Works

### Backend Services → Loki
```
Docker Container → Loki Docker Driver → Loki (port 3100)
```

Each container is configured with the Loki log driver in docker-compose.yml.

### Frontend Perceptual Logs → Loki
```
Frontend Logger → Buffer (10 logs or 5 sec) → Visualizer Backend /api/logs/ingest → Loki (port 3100)
```

The perceptual sequence logger batches logs and sends them to the backend, which converts them to Loki format and forwards them.

---

## Troubleshooting

### No Logs Appearing

**Check Loki:**
```bash
curl http://localhost:3100/ready
```

**Check Grafana Connection:**
```bash
docker exec reality-engine-grafana wget -O- http://loki:3100/ready
```

**View Loki Logs:**
```bash
docker logs reality-engine-loki
```

### Frontend Logs Not Appearing

**Check Browser Console:**
Open browser dev tools and look for errors related to log ingestion.

**Check Visualizer Backend:**
```bash
docker logs reality-engine-visualizer-backend
```

**Test Manual Log Ingestion:**
```bash
curl -X POST http://localhost:3001/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"logs": [{"timestamp": 1234567890, "level": "info", "type": "test", "message": "test"}]}'
```

### High Memory Usage

**Reduce Retention:**
Edit `config/loki-config.yml` and change `retention_period: 168h` (7 days).

**Restart Loki:**
```bash
docker-compose restart loki
```

---

## Advanced Usage

### Create Custom Dashboard

1. Go to Dashboards → New Dashboard
2. Add Panel
3. Select Loki datasource
4. Enter LogQL query
5. Configure visualization
6. Save dashboard

### Set Up Alerts

1. Go to Alerting → Alert rules
2. Create new alert rule
3. Example: Alert on high error rate
   ```logql
   sum(count_over_time({app="reality-engine"} |~ "ERROR"[5m])) > 10
   ```
4. Configure notification channel (email, Slack, etc.)

### Export Logs

**From Grafana:**
1. Open the logs panel
2. Click "..." menu
3. Select "Export data"

**From Frontend Logger:**
1. Click "📋 Logs" in the visualizer
2. Click "Export JSON" or "Export CSV"

---

## Resources

- **Loki API:** http://localhost:3100
- **Grafana:** http://localhost:3002
- **Full Documentation:** See LOKI_GRAFANA_SETUP.md
- **LogQL Reference:** https://grafana.com/docs/loki/latest/logql/

---

## Summary

✅ **Backend Logs:** Automatically captured via Docker log driver
✅ **Frontend Logs:** Automatically captured and forwarded to Loki
✅ **Dashboard:** Pre-configured with 9 panels
✅ **Retention:** 30 days
✅ **Setup:** Fully automated via ./scripts/start.sh

All Reality Engine suite logs are now centralized in Grafana for monitoring, debugging, and analysis!
