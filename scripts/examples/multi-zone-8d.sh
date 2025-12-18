#!/bin/bash

# Multi-Zone Sensor Monitoring Example
# Demonstrates 8-dimensional vectors with 3 CriticalEventSequences
#
# Scenario: Smart Building with 3 Zones
# - Zone 1: Office Area (Temperature, Humidity, Light, Motion, CO2, Sound, Pressure, Air Quality)
# - Zone 2: Server Room (Temperature, Humidity, Power, Network, CPU, Memory, Disk, Cooling)
# - Zone 3: Security Area (Motion, Door, Window, Camera, Alarm, Access, Vibration, Heat)

PORT=${PORT:-3000}
API_URL="http://localhost:$PORT/api"

echo "=================================================================="
echo "Multi-Zone 8D Vector Example"
echo "=================================================================="
echo ""
echo "Using 8-dimensional vectors with 3 CriticalEventSequences"
echo "Each sequence represents a different monitoring zone"
echo ""

# ============================================================
# ZONE 1: Office Area Monitoring
# ============================================================
echo "Creating Zone 1: Office Area Monitoring..."
echo ""

ZONE1_RESPONSE=$(curl -s -X POST $API_URL/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zone 1: Office Area",
    "vectors": [
      {
        "id": "z1-normal",
        "elements": [
          {"value": 22.0, "comparatorType": "threshold", "threshold": 2.0},
          {"value": 45.0, "comparatorType": "threshold", "threshold": 10.0},
          {"value": 500.0, "comparatorType": "threshold", "threshold": 100.0},
          {"value": 0.3, "comparatorType": "threshold", "threshold": 0.2},
          {"value": 800.0, "comparatorType": "threshold", "threshold": 200.0},
          {"value": 40.0, "comparatorType": "threshold", "threshold": 10.0},
          {"value": 1013.0, "comparatorType": "threshold", "threshold": 5.0},
          {"value": 85.0, "comparatorType": "threshold", "threshold": 15.0}
        ],
        "isInitial": true,
        "nextVectorIds": ["z1-alert"],
        "outputVectors": []
      },
      {
        "id": "z1-alert",
        "elements": [
          {"value": 28.0, "comparatorType": "threshold", "threshold": 1.0},
          {"value": 65.0, "comparatorType": "threshold", "threshold": 5.0},
          {"value": 200.0, "comparatorType": "threshold", "threshold": 50.0},
          {"value": 0.8, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 1200.0, "comparatorType": "threshold", "threshold": 100.0},
          {"value": 70.0, "comparatorType": "threshold", "threshold": 5.0},
          {"value": 1010.0, "comparatorType": "threshold", "threshold": 3.0},
          {"value": 60.0, "comparatorType": "threshold", "threshold": 10.0}
        ],
        "isInitial": false,
        "nextVectorIds": ["z1-normal"],
        "outputVectors": [
          {
            "id": "z1-alert-output",
            "vector": [1, 0, 0, 0, 0, 0, 0, 0],
            "timestamp": '$(date +%s000)',
            "metadata": {
              "zone": "Office Area",
              "status": "ALERT",
              "message": "Environmental conditions out of range",
              "priority": "high"
            }
          }
        ]
      }
    ]
  }')

echo "Zone 1 Created:"
echo "$ZONE1_RESPONSE" | jq '.sequence | {id, name, vectors: (.vectors | length)}' 2>/dev/null || echo "$ZONE1_RESPONSE"
echo ""

# ============================================================
# ZONE 2: Server Room Monitoring
# ============================================================
echo "Creating Zone 2: Server Room Monitoring..."
echo ""

ZONE2_RESPONSE=$(curl -s -X POST $API_URL/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zone 2: Server Room",
    "vectors": [
      {
        "id": "z2-optimal",
        "elements": [
          {"value": 18.0, "comparatorType": "threshold", "threshold": 1.5},
          {"value": 40.0, "comparatorType": "threshold", "threshold": 5.0},
          {"value": 0.6, "comparatorType": "threshold", "threshold": 0.15},
          {"value": 0.85, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.3, "comparatorType": "threshold", "threshold": 0.2},
          {"value": 0.5, "comparatorType": "threshold", "threshold": 0.2},
          {"value": 0.4, "comparatorType": "threshold", "threshold": 0.2},
          {"value": 0.9, "comparatorType": "threshold", "threshold": 0.05}
        ],
        "isInitial": true,
        "nextVectorIds": ["z2-warning", "z2-critical"],
        "outputVectors": []
      },
      {
        "id": "z2-warning",
        "elements": [
          {"value": 22.0, "comparatorType": "threshold", "threshold": 1.0},
          {"value": 50.0, "comparatorType": "threshold", "threshold": 5.0},
          {"value": 0.75, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.80, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.6, "comparatorType": "threshold", "threshold": 0.15},
          {"value": 0.65, "comparatorType": "threshold", "threshold": 0.15},
          {"value": 0.60, "comparatorType": "threshold", "threshold": 0.15},
          {"value": 0.85, "comparatorType": "threshold", "threshold": 0.1}
        ],
        "isInitial": false,
        "nextVectorIds": ["z2-optimal", "z2-critical"],
        "outputVectors": [
          {
            "id": "z2-warning-output",
            "vector": [0, 1, 0, 0, 0, 0, 0, 0],
            "timestamp": '$(date +%s000)',
            "metadata": {
              "zone": "Server Room",
              "status": "WARNING",
              "message": "Server metrics elevated",
              "priority": "medium"
            }
          }
        ]
      },
      {
        "id": "z2-critical",
        "elements": [
          {"value": 26.0, "comparatorType": "threshold", "threshold": 0.5},
          {"value": 60.0, "comparatorType": "threshold", "threshold": 3.0},
          {"value": 0.90, "comparatorType": "threshold", "threshold": 0.05},
          {"value": 0.70, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.85, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.80, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.85, "comparatorType": "threshold", "threshold": 0.1},
          {"value": 0.70, "comparatorType": "threshold", "threshold": 0.15}
        ],
        "isInitial": false,
        "nextVectorIds": ["z2-optimal"],
        "outputVectors": [
          {
            "id": "z2-critical-output",
            "vector": [0, 0, 1, 0, 0, 0, 0, 0],
            "timestamp": '$(date +%s000)',
            "metadata": {
              "zone": "Server Room",
              "status": "CRITICAL",
              "message": "Server overload - immediate action required",
              "priority": "critical"
            }
          }
        ]
      }
    ]
  }')

echo "Zone 2 Created:"
echo "$ZONE2_RESPONSE" | jq '.sequence | {id, name, vectors: (.vectors | length)}' 2>/dev/null || echo "$ZONE2_RESPONSE"
echo ""

# ============================================================
# ZONE 3: Security Area Monitoring
# ============================================================
echo "Creating Zone 3: Security Area Monitoring..."
echo ""

ZONE3_RESPONSE=$(curl -s -X POST $API_URL/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Zone 3: Security Area",
    "vectors": [
      {
        "id": "z3-secure",
        "elements": [
          {"value": 0.0, "comparatorType": "equals"},
          {"value": 0.0, "comparatorType": "equals"},
          {"value": 0.0, "comparatorType": "equals"},
          {"value": 1.0, "comparatorType": "equals"},
          {"value": 0.0, "comparatorType": "equals"},
          {"value": 0.0, "comparatorType": "equals"},
          {"value": 0.0, "comparatorType": "equals"},
          {"value": 0.0, "comparatorType": "equals"}
        ],
        "isInitial": true,
        "nextVectorIds": ["z3-breach"],
        "outputVectors": []
      },
      {
        "id": "z3-breach",
        "elements": [
          {"value": 1.0, "comparatorType": "threshold", "threshold": 0.3},
          {"value": 1.0, "comparatorType": "threshold", "threshold": 0.3},
          {"value": 1.0, "comparatorType": "threshold", "threshold": 0.3},
          {"value": 1.0, "comparatorType": "equals"},
          {"value": 1.0, "comparatorType": "equals"},
          {"value": 1.0, "comparatorType": "threshold", "threshold": 0.3},
          {"value": 1.0, "comparatorType": "threshold", "threshold": 0.3},
          {"value": 1.0, "comparatorType": "threshold", "threshold": 0.3}
        ],
        "isInitial": false,
        "nextVectorIds": ["z3-secure"],
        "outputVectors": [
          {
            "id": "z3-breach-output",
            "vector": [0, 0, 0, 1, 0, 0, 0, 0],
            "timestamp": '$(date +%s000)',
            "metadata": {
              "zone": "Security Area",
              "status": "BREACH",
              "message": "Security breach detected - multiple sensors triggered",
              "priority": "critical"
            }
          }
        ]
      }
    ]
  }')

echo "Zone 3 Created:"
echo "$ZONE3_RESPONSE" | jq '.sequence | {id, name, vectors: (.vectors | length)}' 2>/dev/null || echo "$ZONE3_RESPONSE"
echo ""

# ============================================================
# Display System Statistics
# ============================================================
echo "=================================================================="
echo "System Statistics"
echo "=================================================================="
echo ""

STATS=$(curl -s $API_URL/engine/stats)
echo "$STATS" | jq '.stats | {
  totalSequences,
  totalVectors,
  totalActiveVectors,
  sequences: .sequenceStats | map({name, stats})
}' 2>/dev/null || echo "$STATS"

echo ""
echo ""

# ============================================================
# Test Scenarios
# ============================================================
echo "=================================================================="
echo "Testing Scenarios"
echo "=================================================================="
echo ""

# Scenario 1: Normal Office Conditions
echo "Scenario 1: Normal Office Conditions"
echo "-------------------------------------"
echo "Input: [22, 45, 500, 0.3, 800, 40, 1013, 85]"
echo "(Temp: 22°C, Humidity: 45%, Light: 500lux, Motion: 0.3, CO2: 800ppm, Sound: 40dB, Pressure: 1013hPa, AQ: 85)"
echo ""

RESULT1=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [22, 45, 500, 0.3, 800, 40, 1013, 85]}')

echo "Result:"
echo "$RESULT1" | jq '.result | {
  matched: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | map(.key)),
  outputs: (.totalOutputs | length)
}' 2>/dev/null || echo "$RESULT1"
echo ""
echo ""

# Scenario 2: Office Alert Condition
echo "Scenario 2: Office Alert Condition"
echo "-----------------------------------"
echo "Input: [28, 65, 200, 0.8, 1200, 70, 1010, 60]"
echo "(High temp & humidity, low light, high motion/CO2/sound)"
echo ""

RESULT2=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [28, 65, 200, 0.8, 1200, 70, 1010, 60]}')

echo "Result:"
echo "$RESULT2" | jq '.result | {
  matched: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | map(.key)),
  outputs: .totalOutputs | map({id, metadata: .metadata.message}),
  activatedVectors: (.sequenceResults | to_entries | map(.value.activatedVectors) | flatten)
}' 2>/dev/null || echo "$RESULT2"
echo ""
echo ""

# Scenario 3: Optimal Server Room
echo "Scenario 3: Optimal Server Room"
echo "--------------------------------"
echo "Input: [18, 40, 0.6, 0.85, 0.3, 0.5, 0.4, 0.9]"
echo "(Temp: 18°C, Humidity: 40%, Power: 60%, Network: 85%, CPU: 30%, Mem: 50%, Disk: 40%, Cooling: 90%)"
echo ""

RESULT3=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [18, 40, 0.6, 0.85, 0.3, 0.5, 0.4, 0.9]}')

echo "Result:"
echo "$RESULT3" | jq '.result | {
  matched: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | map(.key)),
  outputs: (.totalOutputs | length)
}' 2>/dev/null || echo "$RESULT3"
echo ""
echo ""

# Scenario 4: Server Room Critical
echo "Scenario 4: Server Room Critical"
echo "---------------------------------"
echo "Input: [26, 60, 0.90, 0.70, 0.85, 0.80, 0.85, 0.70]"
echo "(High temp, high utilization across all metrics)"
echo ""

RESULT4=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [26, 60, 0.90, 0.70, 0.85, 0.80, 0.85, 0.70]}')

echo "Result:"
echo "$RESULT4" | jq '.result | {
  matched: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | map(.key)),
  outputs: .totalOutputs | map({zone: .metadata.zone, status: .metadata.status, priority: .metadata.priority}),
  message: (.totalOutputs[0].metadata.message // "No output")
}' 2>/dev/null || echo "$RESULT4"
echo ""
echo ""

# Scenario 5: Security Breach
echo "Scenario 5: Security Breach"
echo "----------------------------"
echo "Input: [1, 1, 1, 1, 1, 1, 1, 1]"
echo "(Motion: YES, Door: OPEN, Window: OPEN, Camera: ON, Alarm: ON, Access: UNAUTHORIZED, Vibration: YES, Heat: YES)"
echo ""

RESULT5=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [1, 1, 1, 1, 1, 1, 1, 1]}')

echo "Result:"
echo "$RESULT5" | jq '.result | {
  matched: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | map(.key)),
  outputs: .totalOutputs | map({zone: .metadata.zone, status: .metadata.status, priority: .metadata.priority}),
  message: (.totalOutputs[] | select(.metadata.zone == "Security Area") | .metadata.message) // "No breach detected"
}' 2>/dev/null || echo "$RESULT5"
echo ""
echo ""

# Scenario 6: Multi-Zone Alert
echo "Scenario 6: Combined Conditions"
echo "--------------------------------"
echo "Testing with values that might trigger multiple zones..."
echo "Input: [22, 50, 0.75, 0.80, 0.6, 0.65, 0.60, 0.85]"
echo ""

RESULT6=$(curl -s -X POST $API_URL/engine/process \
  -H "Content-Type: application/json" \
  -d '{"vector": [22, 50, 0.75, 0.80, 0.6, 0.65, 0.60, 0.85]}')

echo "Result:"
echo "$RESULT6" | jq '.result | {
  matched: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | map(.key)),
  outputs: .totalOutputs | map({zone: .metadata.zone, status: .metadata.status}),
  totalMatches: (.sequenceResults | to_entries | map(select(.value.matchedVectors | length > 0)) | length)
}' 2>/dev/null || echo "$RESULT6"
echo ""
echo ""

# ============================================================
# Final Statistics
# ============================================================
echo "=================================================================="
echo "Final System State"
echo "=================================================================="
echo ""

FINAL_STATS=$(curl -s $API_URL/engine/stats)
echo "$FINAL_STATS" | jq '.stats' 2>/dev/null || echo "$FINAL_STATS"

echo ""
echo ""
echo "=================================================================="
echo "Multi-Zone 8D Example Complete!"
echo "=================================================================="
echo ""
echo "Summary:"
echo "  - 3 CriticalEventSequences created (Office, Server Room, Security)"
echo "  - 8-dimensional vectors used throughout"
echo "  - 6 test scenarios executed"
echo "  - Multiple pattern matches demonstrated"
echo "  - State transitions verified"
echo ""
echo "Key Observations:"
echo "  - Each zone monitors different 8D sensor arrays"
echo "  - Thresholds vary by zone and purpose"
echo "  - Output vectors indicate zone-specific alerts"
echo "  - System can handle concurrent multi-zone processing"
echo ""
