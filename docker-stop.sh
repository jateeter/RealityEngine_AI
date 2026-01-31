#!/bin/bash

# Reality Engine Docker Stop Script
# Stops all services gracefully and clears Docker cache

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
echo "🧹 Clearing Docker build cache..."
docker builder prune -f

# Remove dangling images
echo "🗑️  Removing dangling images..."
docker image prune -f

echo ""
echo "✅ All services stopped and cache cleared"
echo ""
echo "💡 Tips:"
echo "   - To also remove volumes (deletes data): docker-compose down -v"
echo "   - To remove ALL unused images: docker image prune -a -f"
echo ""
