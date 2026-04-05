#!/bin/bash

# Reality Engine - Start Script
# Starts all services (Qdrant + Reality Engine API)

set -e

echo "=================================================="
echo "Reality Engine - Starting Services"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_warning() {
    echo -e "${RED}⚠${NC} $1"
}

# Parse flags
FRESH_START=false
for arg in "$@"; do
    if [ "$arg" = "--fresh" ]; then
        FRESH_START=true
    fi
done

if [ "$FRESH_START" = true ]; then
    echo ""
    print_warning "Fresh start requested — perception source data will be wiped."
    echo ""
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

# Load environment variables
source .env

# Check TLS certificates exist
if [ ! -f certs/server.crt ] || [ ! -f certs/server.key ]; then
    echo ""
    echo "Error: TLS certificates not found (certs/server.crt, certs/server.key)"
    echo "Generate them first:"
    echo "  bash certs/generate-dev-certs.sh"
    echo ""
    exit 1
fi
print_success "TLS certificates found"
echo ""

# Setup Loki Docker driver if needed
print_info "Checking Loki Docker driver..."
if [ -f "./scripts/setup-loki-driver.sh" ]; then
    ./scripts/setup-loki-driver.sh
    echo ""
else
    print_info "Loki driver setup script not found, skipping..."
    echo ""
fi

# Check if ports are in use by local services
print_info "Checking for port conflicts with local services..."

PORTS_IN_USE=""
if lsof -i :3000 > /dev/null 2>&1; then
    PORT_PROCESS=$(lsof -i :3000 | grep LISTEN | awk '{print $1}' | head -1)
    if [ "$PORT_PROCESS" = "node" ]; then
        PORTS_IN_USE="$PORTS_IN_USE 3000(node)"
    fi
fi

if lsof -i :3001 > /dev/null 2>&1; then
    PORT_PROCESS=$(lsof -i :3001 | grep LISTEN | awk '{print $1}' | head -1)
    if [ "$PORT_PROCESS" = "node" ]; then
        PORTS_IN_USE="$PORTS_IN_USE 3001(node)"
    fi
fi

if lsof -i :5173 > /dev/null 2>&1; then
    PORT_PROCESS=$(lsof -i :5173 | grep LISTEN | awk '{print $1}' | head -1)
    if [ "$PORT_PROCESS" = "node" ]; then
        PORTS_IN_USE="$PORTS_IN_USE 5173(node)"
    fi
fi

if lsof -i :3004 > /dev/null 2>&1; then
    PORT_PROCESS=$(lsof -i :3004 | grep LISTEN | awk '{print $1}' | head -1)
    if [ "$PORT_PROCESS" = "node" ]; then
        PORTS_IN_USE="$PORTS_IN_USE 3004(node)"
    fi
fi

if lsof -i :3005 > /dev/null 2>&1; then
    PORT_PROCESS=$(lsof -i :3005 | grep LISTEN | awk '{print $1}' | head -1)
    if [ "$PORT_PROCESS" = "node" ]; then
        PORTS_IN_USE="$PORTS_IN_USE 3005(node)"
    fi
fi

if [ -n "$PORTS_IN_USE" ]; then
    echo ""
    echo "=================================================="
    echo "Error: Local services are running on ports:$PORTS_IN_USE"
    echo "=================================================="
    echo ""
    echo "You are trying to start Docker mode, but local services are running."
    echo "You cannot run both modes simultaneously."
    echo ""
    echo "To switch to Docker mode:"
    echo "  1. Stop local services:  ./scripts/stop-local.sh"
    echo "  2. Start Docker mode:    ./scripts/start.sh"
    echo ""
    echo "Or to continue with local mode:"
    echo "  - Use: ./scripts/start-local.sh"
    echo ""
    exit 1
fi

print_success "No port conflicts detected"
echo ""

# Clean up any existing containers with the same name
print_info "Checking for existing containers..."

# Check if any of our containers exist
EXISTING_CONTAINERS=$(docker ps -a --filter "name=reality-engine-" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')

if [ "$EXISTING_CONTAINERS" -gt 0 ]; then
    print_info "Found $EXISTING_CONTAINERS existing container(s). Cleaning up to avoid conflicts..."

    # Gracefully stop Qdrant first (SIGTERM + 15s wait) so it can flush its WAL
    # and release file locks before we remove the container.  Force-killing Qdrant
    # (SIGKILL via docker rm -f) can leave flock() locks held on macOS Docker
    # volumes momentarily, causing the next startup to fail with EAGAIN.
    docker stop --time 15 reality-engine-qdrant 2>/dev/null || true

    # Gracefully stop remaining services, then tear down the network.
    # Do NOT pass -v — named volumes (perception sources, Qdrant, Grafana) are preserved.
    docker-compose down 2>/dev/null || true

    # Force-remove any containers that docker-compose down could not reach
    # (does not affect volumes).
    docker rm -f reality-engine-qdrant reality-engine-app reality-engine-visualizer-backend reality-engine-visualizer-frontend reality-engine-perception-backend reality-engine-perception-frontend reality-engine-tls-proxy 2>/dev/null || true

    # Brief settle — on macOS Docker Desktop, VirtioFS file-lock release can
    # lag by ~1 s after the container process exits.
    sleep 2

    print_success "Old containers removed"
    echo ""
fi

# Fresh start: remove the perception sources volume so the engine starts empty
if [ "$FRESH_START" = true ]; then
    PERCEPTION_VOLUME=$(docker volume ls --format "{{.Name}}" | grep "_perception_sources_data$" | head -1)
    if [ -n "$PERCEPTION_VOLUME" ]; then
        print_info "Removing perception sources volume: $PERCEPTION_VOLUME"
        docker volume rm "$PERCEPTION_VOLUME" 2>/dev/null || true
        print_success "Perception source data cleared"
    else
        print_info "No existing perception sources volume found (already clean)"
    fi
    echo ""
fi

# Clear Docker build cache to prevent stale builds
print_info "Clearing Docker build cache..."
docker builder prune -f > /dev/null 2>&1
docker image prune -f > /dev/null 2>&1
print_success "Docker cache cleared"
echo ""

# Build and start Docker services
print_info "Building Docker services (no cache)..."
docker-compose build --no-cache

print_info "Starting Docker services (Qdrant, Visualizer Backend, Visualizer Frontend)..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: Failed to start Docker services"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. Run: ./scripts/cleanup.sh"
    echo "  2. Or manually: docker-compose down -v && docker system prune -f"
    echo "  3. Then try: ./scripts/start.sh again"
    echo ""
    echo "Check logs with: docker-compose logs"
    exit 1
fi

print_success "Docker services started"

echo ""
# Note: Qdrant is an internal Docker service (no host port binding).
# Its health is validated transitively — tls-proxy waits on reality-engine,
# which depends on Qdrant being healthy before it starts.

# Wait for TLS proxy to be ready (it starts after all upstream services are healthy)
print_info "Waiting for TLS proxy to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "TLS proxy is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: TLS proxy failed to start"
    echo "Check Docker logs with: docker logs reality-engine-tls-proxy"
    exit 1
fi

echo ""
echo ""

# Wait for Reality Engine API (via TLS proxy)
print_info "Waiting for Reality Engine API to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "Reality Engine API is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: Reality Engine API failed to start"
    echo "Check Docker logs with: docker logs reality-engine-app"
    exit 1
fi

echo ""

# Wait for Visualizer Backend (via TLS proxy)
print_info "Waiting for Visualizer Backend to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:3001/health > /dev/null 2>&1; then
        print_success "Visualizer Backend is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: Visualizer Backend failed to start"
    echo "Check Docker logs with: docker logs reality-engine-visualizer-backend"
    exit 1
fi

echo ""

# Wait for Visualizer Frontend (via TLS proxy)
print_info "Waiting for Visualizer Frontend to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:5173/ > /dev/null 2>&1; then
        print_success "Visualizer Frontend is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: Visualizer Frontend failed to start"
    echo "Check Docker logs with: docker logs reality-engine-visualizer-frontend"
    exit 1
fi

echo ""

# Wait for Perception Engine Backend (via TLS proxy)
print_info "Waiting for Perception Engine Backend to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:3004/api/health > /dev/null 2>&1; then
        print_success "Perception Engine Backend is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: Perception Engine Backend failed to start"
    echo "Check Docker logs with: docker logs reality-engine-perception-backend"
    exit 1
fi

# Report how many sources were restored from persistent storage
PERCEPTION_SOURCE_COUNT=$(curl -sk https://localhost:3004/api/sources 2>/dev/null | grep -o '"id":"' | wc -l | tr -d ' ')
if [ "$PERCEPTION_SOURCE_COUNT" -gt 0 ] 2>/dev/null; then
    print_success "Perception sources: $PERCEPTION_SOURCE_COUNT source(s) restored from persistent storage"
else
    print_info "Perception sources: none (storage is empty — add sources via the UI)"
fi

echo ""

# Wait for Perception Engine Frontend (via TLS proxy)
print_info "Waiting for Perception Engine Frontend to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sk https://localhost:3005/ > /dev/null 2>&1; then
        print_success "Perception Engine Frontend is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: Perception Engine Frontend failed to start"
    echo "Check Docker logs with: docker logs reality-engine-perception-frontend"
    exit 1
fi

echo ""
echo ""
echo "=================================================="
echo "Reality Engine Started Successfully! (Docker Mode)"
echo "=================================================="
echo ""
echo "All Services Running in Docker (TLS — self-signed cert):"
echo "  - Reality Engine API:         https://localhost:3000"
echo "  - API Health:                 https://localhost:3000/api/health"
echo "  - Visualizer Backend:         https://localhost:3001"
echo "  - Visualizer Frontend:        https://localhost:5173"
echo "  - Perception Engine Backend:  https://localhost:3004"
echo "  - Perception Engine Frontend: https://localhost:3005"
echo "  - Grafana (Logs):             https://localhost:3002"
echo "  - Loki (Log API):             http://localhost:3100  (internal, no TLS)"
echo "  - Qdrant (internal only):     not accessible from host"
echo ""
echo "  Note: Browser will warn about the self-signed certificate."
echo "  To silence it: bash certs/generate-dev-certs.sh (see script for trust instructions)"
echo ""
echo "Quick Start Guide:"
echo "  1. Open Visualizer:         https://localhost:5173"
echo "  2. Load machine from list (e.g., RSFlipFlop, DataCenterMonitoring)"
echo "  3. View Machine Graph:      Shows interconnected machines in perceptual space"
echo "  4. Generate Random Stream:  Use Random Generator in Universal Input Vector Display"
echo "  5. Run Simulation:          Observe perceptual space propagation in real-time"
echo "  6. View Logs in Grafana:    https://localhost:3002 (admin/admin)"
echo ""
echo "New Features:"
echo "  - Universal Input Vector Display (256-byte perceptual space)"
echo "  - Machine interconnection visualization with perceptual mappings"
echo "  - Random stream generator for universal perceptual space"
echo "  - Real-time visualization of machine output overwrites"
echo "  - Centralized logging with Grafana Loki (auto-configured)"
echo "  - Perceptual sequence logging with detailed operation tracking"
echo ""
echo "Persistent Data (survives stop/start):"
echo "  - Perception sources: Docker volume perception_sources_data"
echo "  - Qdrant vector store: Docker volume qdrant_storage"
echo "  - Grafana dashboards:  Docker volume grafana_data"
echo ""
echo "Useful Commands:"
echo "  Status:          ./scripts/status.sh"
echo "  Docker Logs:     docker logs reality-engine-app"
echo "                   docker logs reality-engine-visualizer-frontend"
echo "  Stop All:        ./scripts/stop.sh  (data preserved)"
echo "  Restart:         ./scripts/restart.sh"
echo "  Fresh Start:     ./scripts/start.sh --fresh  (clears perception sources)"
echo ""
echo "Note: All services are containerized. Check container status with:"
echo "      docker ps"
echo ""
