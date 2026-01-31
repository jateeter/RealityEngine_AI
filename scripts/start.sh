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

# Start Reality Engine API
print_info "Starting Reality Engine API..."

# Check if already running
if [ -f .api.pid ]; then
    OLD_PID=$(cat .api.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "Reality Engine API is already running (PID: $OLD_PID)"
        echo "Use ./scripts/restart.sh to restart"
        exit 0
    else
        rm .api.pid
    fi
fi

# Start the API in background
nohup npm start > logs/api.log 2>&1 &
API_PID=$!
echo $API_PID > .api.pid

echo ""
print_info "Waiting for Reality Engine API to be ready..."
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:${PORT:-3000}/api/health > /dev/null 2>&1; then
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
    echo "Check logs with: ./scripts/logs.sh"
    kill $API_PID 2>/dev/null || true
    rm .api.pid
    exit 1
fi

echo ""
echo ""
echo "=================================================="
echo "Reality Engine Started Successfully!"
echo "=================================================="
echo ""
echo "Services:"
echo "  - Qdrant Vector DB:      http://localhost:6333"
echo "  - Qdrant Dashboard:      http://localhost:6333/dashboard"
echo "  - Reality Engine API:    http://localhost:${PORT:-3000}"
echo "  - API Health:            http://localhost:${PORT:-3000}/api/health"
echo "  - Visualizer Backend:    http://localhost:3001"
echo "  - Visualizer Frontend:   http://localhost:5173"
echo ""
echo "API PID: $API_PID (saved to .api.pid)"
echo ""
echo "Quick Start:"
echo "  1. Open Visualizer:  http://localhost:5173"
echo "  2. Click 'Load Demo' to load the 30-sequence demonstration"
echo "  3. Select a sequence and use simulation controls"
echo ""
echo "Useful commands:"
echo "  Status:   ./scripts/status.sh"
echo "  Logs:     ./scripts/logs.sh"
echo "  Stop:     ./scripts/stop.sh"
echo "  Restart:  ./scripts/restart.sh"
echo ""
