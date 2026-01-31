#!/bin/bash

# Reality Engine Docker Restart Script
# Restarts all services with fresh cache

set -e

echo "🔄 Restarting Reality Engine services..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running"
    echo "Please start Docker and try again"
    exit 1
fi

# Stop services
echo "🛑 Stopping services..."
docker-compose down

# Clear Docker build cache
echo "🧹 Clearing Docker build cache..."
docker builder prune -f
docker image prune -f

# Rebuild and start services
echo "📦 Rebuilding services (no cache)..."
docker-compose build --no-cache
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service status
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "✅ Services restarted successfully!"
echo "📝 View logs with: docker-compose logs -f"
echo ""
