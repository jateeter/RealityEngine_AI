#!/bin/bash

# Example: Create a CriticalEventSequence via API

PORT=${PORT:-3000}
API_URL="http://localhost:$PORT/api"

echo "=================================================="
echo "Example: Creating a CriticalEventSequence"
echo "=================================================="
echo ""

echo "Creating a simple 2-state sequence..."
echo ""

# Create the sequence
RESPONSE=$(curl -s -X POST $API_URL/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Binary State Machine",
    "vectors": [
      {
        "elements": [
          {"value": 1.0, "comparatorType": "equals"}
        ],
        "isInitial": true,
        "nextVectorIds": ["state-b"],
        "outputVectors": [
          {
            "id": "state-a-output",
            "vector": [1.0],
            "timestamp": '$(date +%s000)',
            "metadata": {"state": "A", "message": "Entering State A"}
          }
        ],
        "id": "state-a"
      },
      {
        "elements": [
          {"value": 0.0, "comparatorType": "equals"}
        ],
        "isInitial": false,
        "nextVectorIds": ["state-a"],
        "outputVectors": [
          {
            "id": "state-b-output",
            "vector": [0.0],
            "timestamp": '$(date +%s000)',
            "metadata": {"state": "B", "message": "Entering State B"}
          }
        ],
        "id": "state-b"
      }
    ]
  }')

if [ $? -eq 0 ]; then
    echo "✓ Sequence created successfully!"
    echo ""
    echo "Response:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""

    # Extract sequence ID
    SEQUENCE_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo ""
    echo "Sequence ID: $SEQUENCE_ID"
    echo ""
    echo "Next steps:"
    echo "  - Process inputs: ./scripts/examples/process-input.sh"
    echo "  - Check stats: curl $API_URL/engine/stats | jq"
else
    echo "✗ Failed to create sequence"
    exit 1
fi
