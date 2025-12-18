#!/bin/bash

# Reality Engine Docker Stop Script
# Stops all services gracefully

set -e

echo "🛑 Stopping Reality Engine services..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running"
    exit 1
fi

# Stop services
docker-compose down

echo ""
echo "✅ All services stopped"
echo ""
echo "💡 Tip: To also remove volumes (deletes data), use:"
echo "   docker-compose down -v"
echo ""
