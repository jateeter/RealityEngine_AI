#!/bin/bash

# Reality Engine Docker Start Script
# Starts all services using docker-compose with fresh cache

set -e

echo "🚀 Starting Reality Engine services..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker daemon is not running"
    echo "Please start Docker and try again"
    exit 1
fi

# Create data and logs directories if they don't exist
mkdir -p data logs

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Using default environment variables"
    echo "You can copy .env.example to .env to customize settings"
    echo ""
fi

# Clear Docker build cache to prevent stale cache issues
echo "🧹 Clearing Docker build cache..."
docker builder prune -f

# Start services with no-cache to ensure fresh build
echo "📦 Building and starting services (no cache)..."
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
echo "✅ Reality Engine is starting up!"
echo ""
echo "🌐 Access the services at:"
echo "   - Reality Engine API:    http://localhost:3000"
echo "   - Visualizer Frontend:   http://localhost:5173"
echo "   - Visualizer Backend:    http://localhost:3001"
echo "   - Qdrant Dashboard:      http://localhost:6333/dashboard"
echo ""
echo "📝 View logs with: docker-compose logs -f"
echo "🛑 Stop services with: docker-compose down"
echo "   or use: ./docker-stop.sh"
echo ""
