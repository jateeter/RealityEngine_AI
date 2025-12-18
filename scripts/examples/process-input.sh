#!/bin/bash

# Example: Process input vectors through the engine

PORT=${PORT:-3000}
API_URL="http://localhost:$PORT/api"

echo "=================================================="
echo "Example: Processing Input Vectors"
echo "=================================================="
echo ""

# Process State A input
echo "Processing State A input [1.0]..."
RESPONSE_A=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [1.0]}')

echo "Response:"
echo "$RESPONSE_A" | jq '.result | {inputVector, totalOutputs: (.totalOutputs | length), timestamp}' 2>/dev/null || echo "$RESPONSE_A"
echo ""

# Process State B input
echo "Processing State B input [0.0]..."
RESPONSE_B=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [0.0]}')

echo "Response:"
echo "$RESPONSE_B" | jq '.result | {inputVector, totalOutputs: (.totalOutputs | length), timestamp}' 2>/dev/null || echo "$RESPONSE_B"
echo ""

# Check active vectors
echo "Checking active vectors..."
ACTIVE=$(curl -s $API_URL/engine/active)
echo "$ACTIVE" | jq '.' 2>/dev/null || echo "$ACTIVE"
echo ""

# Get engine stats
echo "Engine statistics:"
curl -s $API_URL/engine/stats | jq '.stats' 2>/dev/null
echo ""
