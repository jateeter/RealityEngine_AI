#!/bin/bash

# Reality Engine - Status Check Script
# Shows status of all services

echo "=================================================="
echo "Reality Engine - Service Status"
echo "=================================================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    source .env
fi

PORT=${PORT:-3000}

# Check Qdrant
echo "Qdrant Vector Database:"
if docker-compose ps qdrant 2>/dev/null | grep -q "Up"; then
    echo -e "  Status: ${GREEN}RUNNING${NC}"

    if curl -s http://localhost:6333/health > /dev/null 2>&1; then
        echo -e "  Health: ${GREEN}HEALTHY${NC}"
        echo "  URL:    http://localhost:6333"
        echo "  UI:     http://localhost:6333/dashboard"
    else
        echo -e "  Health: ${RED}UNHEALTHY${NC}"
    fi
else
    echo -e "  Status: ${RED}STOPPED${NC}"
fi

echo ""

# Check Reality Engine API
echo "Reality Engine API:"
if [ -f .api.pid ]; then
    API_PID=$(cat .api.pid)

    if ps -p $API_PID > /dev/null 2>&1; then
        echo -e "  Status: ${GREEN}RUNNING${NC}"
        echo "  PID:    $API_PID"

        if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
            echo -e "  Health: ${GREEN}HEALTHY${NC}"
            echo "  URL:    http://localhost:$PORT"

            # Get engine stats
            STATS=$(curl -s http://localhost:$PORT/api/engine/stats)
            if [ $? -eq 0 ]; then
                echo ""
                echo "  Engine Statistics:"
                echo "$STATS" | grep -o '"totalSequences":[0-9]*' | sed 's/"totalSequences":/    Sequences: /'
                echo "$STATS" | grep -o '"totalVectors":[0-9]*' | sed 's/"totalVectors":/    Vectors:   /'
                echo "$STATS" | grep -o '"totalActiveVectors":[0-9]*' | sed 's/"totalActiveVectors":/    Active:    /'
            fi
        else
            echo -e "  Health: ${RED}UNHEALTHY${NC}"
        fi
    else
        echo -e "  Status: ${RED}STOPPED${NC} (stale PID file)"
        rm .api.pid
    fi
else
    echo -e "  Status: ${RED}STOPPED${NC}"
fi

echo ""

# Check Docker
echo "Docker:"
if docker info > /dev/null 2>&1; then
    echo -e "  Status: ${GREEN}RUNNING${NC}"
else
    echo -e "  Status: ${RED}NOT RUNNING${NC}"
fi

echo ""
echo "=================================================="

# Overall status
if [ -f .api.pid ] && ps -p $(cat .api.pid) > /dev/null 2>&1 && docker-compose ps qdrant 2>/dev/null | grep -q "Up"; then
    echo -e "Overall: ${GREEN}ALL SERVICES RUNNING${NC}"
else
    echo -e "Overall: ${YELLOW}SOME SERVICES DOWN${NC}"
fi

echo "=================================================="
echo ""
