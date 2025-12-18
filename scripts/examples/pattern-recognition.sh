#!/bin/bash

# Example: Pattern Recognition Sequence

PORT=${PORT:-3000}
API_URL="http://localhost:$PORT/api"

echo "=================================================="
echo "Example: Pattern Recognition"
echo "=================================================="
echo ""

echo "Creating pattern recognition sequence..."
echo ""

# Create sequence
RESPONSE=$(curl -s -X POST $API_URL/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pattern Recognition Demo",
    "vectors": [
      {
        "elements": [
          {"value": 0.5, "comparatorType": "threshold", "threshold": 0.15},
          {"value": 0.8, "comparatorType": "threshold", "threshold": 0.15},
          {"value": 0.3, "comparatorType": "threshold", "threshold": 0.15}
        ],
        "isInitial": true,
        "nextVectorIds": [],
        "outputVectors": [
          {
            "id": "pattern-recognized",
            "vector": [1.0, 1.0, 1.0],
            "timestamp": '$(date +%s000)',
            "metadata": {
              "type": "recognition",
              "pattern": "target-pattern",
              "confidence": 0.95
            }
          }
        ]
      }
    ]
  }')

if [ $? -eq 0 ]; then
    echo "✓ Sequence created"
    echo ""

    # Test various inputs
    echo "Testing pattern matching with various inputs:"
    echo ""

    # Close match
    echo "1. Input [0.52, 0.79, 0.31] (close match):"
    curl -s -X POST $API_URL/engine/process \
      -H "Content-Type: application/json" \
      -d '{"vector": [0.52, 0.79, 0.31]}' \
      | jq '.result | {matched: (.totalOutputs | length > 0), outputs: .totalOutputs}' 2>/dev/null
    echo ""

    # Exact match
    echo "2. Input [0.5, 0.8, 0.3] (exact match):"
    curl -s -X POST $API_URL/engine/process \
      -H "Content-Type: application/json" \
      -d '{"vector": [0.5, 0.8, 0.3]}' \
      | jq '.result | {matched: (.totalOutputs | length > 0), outputs: .totalOutputs}' 2>/dev/null
    echo ""

    # No match
    echo "3. Input [0.9, 0.1, 0.9] (no match):"
    curl -s -X POST $API_URL/engine/process \
      -H "Content-Type: application/json" \
      -d '{"vector": [0.9, 0.1, 0.9]}' \
      | jq '.result | {matched: (.totalOutputs | length > 0), outputs: .totalOutputs}' 2>/dev/null
    echo ""

    echo "Pattern recognition demo complete!"
else
    echo "✗ Failed to create sequence"
    exit 1
fi
