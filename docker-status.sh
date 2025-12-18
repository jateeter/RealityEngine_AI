#!/bin/bash

# Reality Engine Docker Status Script
# Shows detailed status of all services

set -e

echo "📊 Reality Engine Service Status"
echo "=================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon is not running"
    exit 1
fi

# Show container status
echo "🐳 Container Status:"
docker-compose ps
echo ""

# Check service health
echo "🏥 Health Checks:"
echo ""

check_service() {
    local name=$1
    local url=$2

    if curl -f -s -o /dev/null -w "%{http_code}" "$url" > /dev/null 2>&1; then
        echo "  ✅ $name is healthy"
    else
        echo "  ❌ $name is not responding"
    fi
}

check_service "Reality Engine API" "http://localhost:3000/api/engine/stats"
check_service "Visualizer Backend" "http://localhost:3001/health"
check_service "Visualizer Frontend" "http://localhost:5173/"
check_service "Qdrant" "http://localhost:6333/"

echo ""
echo "🌐 Access URLs:"
echo "   - Reality Engine API:    http://localhost:3000"
echo "   - Visualizer Frontend:   http://localhost:5173"
echo "   - Visualizer Backend:    http://localhost:3001"
echo "   - Qdrant Dashboard:      http://localhost:6333/dashboard"
echo ""

# Show resource usage
echo "💻 Resource Usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""
