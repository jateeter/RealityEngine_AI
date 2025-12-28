#!/bin/bash

# Reality Engine - Stop Script
# Stops all services gracefully

echo "=================================================="
echo "Reality Engine - Stopping Services"
echo "=================================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Stop Reality Engine API
if [ -f .api.pid ]; then
    API_PID=$(cat .api.pid)
    print_info "Stopping Reality Engine API (PID: $API_PID)..."

    if ps -p $API_PID > /dev/null 2>&1; then
        kill $API_PID

        # Wait for graceful shutdown
        WAIT_COUNT=0
        while ps -p $API_PID > /dev/null 2>&1 && [ $WAIT_COUNT -lt 10 ]; do
            sleep 1
            WAIT_COUNT=$((WAIT_COUNT + 1))
        done

        # Force kill if still running
        if ps -p $API_PID > /dev/null 2>&1; then
            kill -9 $API_PID 2>/dev/null || true
        fi

        print_success "Reality Engine API stopped"
    else
        echo "Reality Engine API was not running"
    fi

    rm .api.pid
else
    echo "Reality Engine API is not running (no .api.pid file found)"
fi

echo ""

# Stop Docker services
print_info "Stopping Docker services (Qdrant, Visualizer Backend, Visualizer Frontend)..."
docker-compose stop

if [ $? -eq 0 ]; then
    print_success "All Docker services stopped"
else
    echo "Warning: Failed to stop some Docker services"
fi

echo ""
echo "=================================================="
echo "All Services Stopped"
echo "=================================================="
echo ""
echo "To start again: ./scripts/start.sh"
echo ""
