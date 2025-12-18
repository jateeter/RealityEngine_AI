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

# Start Docker services
print_info "Starting Qdrant vector database..."
docker-compose up -d qdrant

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
echo "  - Qdrant:          http://localhost:6333"
echo "  - Qdrant UI:       http://localhost:6333/dashboard"
echo "  - Reality Engine:  http://localhost:${PORT:-3000}"
echo "  - API Health:      http://localhost:${PORT:-3000}/api/health"
echo ""
echo "API PID: $API_PID (saved to .api.pid)"
echo ""
echo "Useful commands:"
echo "  Status:   ./scripts/status.sh"
echo "  Logs:     ./scripts/logs.sh"
echo "  Stop:     ./scripts/stop.sh"
echo "  Restart:  ./scripts/restart.sh"
echo ""
