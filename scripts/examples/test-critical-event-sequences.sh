#!/bin/bash
# Test Critical Event Sequences for RS Flip-Flop

API_URL="http://localhost:3000/api"

echo "=========================================="
echo "Testing RS Flip-Flop Critical Event Sequences"
echo "=========================================="
echo ""

# Get the machine
MACHINE=$(curl -s $API_URL/machines | jq '.machines[] | select(.name == "RS Flip-Flop Circuit")')
MACHINE_ID=$(echo "$MACHINE" | jq -r '.id')

echo "Machine: RS Flip-Flop Circuit"
echo "ID: $MACHINE_ID"
echo "Sequences: $(echo "$MACHINE" | jq -r '.sequenceCount')"
echo ""

# List the sequences
echo "Sequences in machine:"
echo "$MACHINE" | jq -r '.sequences[] | "  - \(.name) (\(.id))"'
echo ""

# Test SequenceA: [(00,01) -> (10)]
echo "=========================================="
echo "Testing SequenceA: [(00,01) -> (10)]"
echo "=========================================="
echo ""

echo "Step 1: Input [0, 0] (HOLD)"
RESULT1=$(curl -s -X POST $API_URL/engine/process \
  -H 'Content-Type: application/json' \
  -d '{"vector": [0, 0]}')
echo "$RESULT1" | jq '.result.totalOutputs[] | "  Output: [\(.vector[0]), \(.vector[1])] - \(.metadata.description // "No description")"'
echo ""

echo "Step 2: Input [0, 1] (RESET)"
RESULT2=$(curl -s -X POST $API_URL/engine/process \
  -H 'Content-Type: application/json' \
  -d '{"vector": [0, 1]}')
echo "$RESULT2" | jq '.result.totalOutputs[] | "  Output: [\(.vector[0]), \(.vector[1])] - \(.metadata.description // .metadata.sequenceName // "No description")"'
echo ""

# Check for SequenceA output
SEQ_A_OUTPUT=$(echo "$RESULT2" | jq '.result.totalOutputs[] | select(.metadata.sequenceName == "SequenceA")')
if [ -n "$SEQ_A_OUTPUT" ]; then
  echo "✓ SequenceA output detected!"
  echo "$SEQ_A_OUTPUT" | jq '.'
else
  echo "⚠ SequenceA output not found"
fi
echo ""

# Reset by sending a different input
echo "Resetting state..."
curl -s -X POST $API_URL/engine/reset > /dev/null
echo ""

# Test SequenceB: [(00,10) -> (01)]
echo "=========================================="
echo "Testing SequenceB: [(00,10) -> (01)]"
echo "=========================================="
echo ""

echo "Step 1: Input [0, 0] (HOLD)"
RESULT3=$(curl -s -X POST $API_URL/engine/process \
  -H 'Content-Type: application/json' \
  -d '{"vector": [0, 0]}')
echo "$RESULT3" | jq '.result.totalOutputs[] | "  Output: [\(.vector[0]), \(.vector[1])] - \(.metadata.description // "No description")"'
echo ""

echo "Step 2: Input [1, 0] (SET)"
RESULT4=$(curl -s -X POST $API_URL/engine/process \
  -H 'Content-Type: application/json' \
  -d '{"vector": [1, 0]}')
echo "$RESULT4" | jq '.result.totalOutputs[] | "  Output: [\(.vector[0]), \(.vector[1])] - \(.metadata.description // .metadata.sequenceName // "No description")"'
echo ""

# Check for SequenceB output
SEQ_B_OUTPUT=$(echo "$RESULT4" | jq '.result.totalOutputs[] | select(.metadata.sequenceName == "SequenceB")')
if [ -n "$SEQ_B_OUTPUT" ]; then
  echo "✓ SequenceB output detected!"
  echo "$SEQ_B_OUTPUT" | jq '.'
else
  echo "⚠ SequenceB output not found"
fi
echo ""

echo "=========================================="
echo "Test Complete"
echo "=========================================="
