#!/bin/bash

# Example: Reality Sampler demonstration

PORT=${PORT:-3000}
API_URL="http://localhost:$PORT/api"

echo "=================================================="
echo "Example: Reality Sampler Demo"
echo "=================================================="
echo ""

# Start sampler with periodic strategy
echo "Starting sampler with periodic strategy (1000ms interval)..."
START_RESPONSE=$(curl -s -X POST $API_URL/sampler/start \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "periodic",
    "intervalMs": 1000
  }')

echo "$START_RESPONSE" | jq '.' 2>/dev/null || echo "$START_RESPONSE"
echo ""

# Sample some observations
echo "Sampling observations..."
echo ""

for i in {1..5}; do
    VALUE=$(awk -v seed=$RANDOM 'BEGIN {srand(seed); print rand()}')
    echo "[$i] Sampling value: $VALUE"

    curl -s -X POST $API_URL/sampler/sample \
      -H "Content-Type: application/json" \
      -d '{
        "data": ['$VALUE'],
        "source": "demo-script",
        "metadata": {"iteration": '$i'}
      }' | jq '.success' 2>/dev/null

    sleep 0.5
done

echo ""

# Check sampler stats
echo "Sampler statistics:"
curl -s $API_URL/sampler/stats | jq '.stats' 2>/dev/null
echo ""

# Stop sampler
echo "Stopping sampler..."
curl -s -X POST $API_URL/sampler/stop | jq '.' 2>/dev/null
echo ""
