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
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please run ./scripts/setup.sh first"
    exit 1
fi

# Load environment variables
source .env

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
    docker-compose down 2>/dev/null || true

    # Force remove any stubborn containers
    docker rm -f reality-engine-qdrant reality-engine-app reality-engine-visualizer-backend reality-engine-visualizer-frontend 2>/dev/null || true

    print_success "Old containers removed"
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
print_info "Waiting for Qdrant to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:6333/health > /dev/null 2>&1; then
        print_success "Qdrant is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "Error: Qdrant failed to start"
    exit 1
fi

echo ""
echo ""

# Wait for Reality Engine API (running in Docker)
print_info "Waiting for Reality Engine API (Docker) to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
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

# Wait for Visualizer Backend
print_info "Waiting for Visualizer Backend to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
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

# Wait for Visualizer Frontend
print_info "Waiting for Visualizer Frontend to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:5173/ > /dev/null 2>&1; then
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
echo ""
echo "=================================================="
echo "Reality Engine Started Successfully! (Docker Mode)"
echo "=================================================="
echo ""
echo "All Services Running in Docker:"
echo "  - Qdrant Vector DB:      http://localhost:6333"
echo "  - Qdrant Dashboard:      http://localhost:6333/dashboard"
echo "  - Reality Engine API:    http://localhost:3000"
echo "  - API Health:            http://localhost:3000/api/health"
echo "  - Visualizer Backend:    http://localhost:3001"
echo "  - Visualizer Frontend:   http://localhost:5173"
echo ""
echo "Quick Start Guide:"
echo "  1. Open Visualizer:         http://localhost:5173"
echo "  2. Load machine from list (e.g., RSFlipFlop, DataCenterMonitoring)"
echo "  3. View Machine Graph:      Shows interconnected machines in perceptual space"
echo "  4. Generate Random Stream:  Use Random Generator in Universal Input Vector Display"
echo "  5. Run Simulation:          Observe perceptual space propagation in real-time"
echo ""
echo "New Features:"
echo "  - Universal Input Vector Display (256-byte perceptual space)"
echo "  - Machine interconnection visualization with perceptual mappings"
echo "  - Random stream generator for universal perceptual space"
echo "  - Real-time visualization of machine output overwrites"
echo ""
echo "Useful Commands:"
echo "  Status:          ./scripts/status.sh"
echo "  Docker Logs:     docker logs reality-engine-app"
echo "                   docker logs reality-engine-visualizer-frontend"
echo "  Stop All:        ./scripts/stop.sh"
echo "  Restart:         ./scripts/restart.sh"
echo ""
echo "Note: All services are containerized. Check container status with:"
echo "      docker ps"
echo ""
