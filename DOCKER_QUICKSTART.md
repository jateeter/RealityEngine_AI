# Docker Quick Start

Run the entire Reality Engine stack (9 services) with a single command.

## TL;DR

```bash
bash certs/generate-dev-certs.sh   # first time only
./start.sh
```

Then open **https://localhost:5173** in your browser (accept the self-signed certificate warning).

## Prerequisites

- Docker Desktop installed and running
- 4 GB+ RAM available
- Ports 3000–3005, 5173, 6333, 6334, 3100 free

## Commands

```bash
./start.sh          # build (if needed) and start all services
./stop.sh           # stop all services
docker-compose ps   # check health status
docker-compose logs -f <service>   # stream logs for one service
```

## Services Started

| Service | External URL | Internal name |
|---|---|---|
| Visualizer Frontend | https://localhost:5173 | visualizer-frontend |
| Visualizer Backend (WebSocket) | https://localhost:3001 | visualizer-backend |
| Reality Engine API | https://localhost:3000 | reality-engine |
| Perception Engine UI | https://localhost:3005 | perception-engine-frontend |
| Perception Engine API | https://localhost:3004 | perception-engine-backend |
| Grafana | https://localhost:3002 | grafana |
| Qdrant | http://localhost:6333/dashboard | qdrant |
| Loki | http://localhost:3100 | loki |

All HTTPS ports are handled by the **TLS proxy** (nginx) container which terminates TLS and forwards to each service over plain HTTP on the internal Docker network.

## First Run: TLS Certificates

Dev certificates are required for the nginx TLS proxy:

```bash
bash certs/generate-dev-certs.sh
```

This creates `certs/server.crt` and `certs/server.key`. They are bind-mounted into the TLS proxy container at startup.

To trust the certificate in Chrome/Firefox, import `certs/server.crt` into your system or browser trust store, or simply accept the "Not Secure" warning for local dev.

## Rebuilding After Code Changes

```bash
# Rebuild a specific service
docker-compose build --no-cache <service>
docker-compose up -d <service>

# Rebuild everything
docker-compose build --no-cache
./start.sh
```

## Useful Log Queries

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f perception-engine-backend

# Reality Engine errors
docker-compose logs reality-engine | grep -i error
```

## Health Checks

All services define Docker health checks. Use `docker-compose ps` to see status. Services that depend on others will wait until dependencies are healthy before starting.
