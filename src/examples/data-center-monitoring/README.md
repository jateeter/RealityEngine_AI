# Data Center Monitoring - 5 Critical Event Sequences Example

## Overview
This example demonstrates 5 critical event sequences for comprehensive data center monitoring, each with a minimum depth of 5 state transitions before reaching critical outputs.

## Sequences

### 1. Server Temperature Monitoring
**Path**: Normal → Warm → Hot → Critical → Emergency
- **Initial Event**: Temperature reading within normal range (68-72°F)
- **Progression**: Temperature rises through defined thresholds
- **Output**: EMERGENCY + COOLING_SYSTEM_ACTIVATE

### 2. Network Traffic Monitoring
**Path**: Baseline → Elevated → Congested → Overloaded → Failure Imminent
- **Initial Event**: Normal traffic baseline (< 40% capacity)
- **Progression**: Traffic increases through capacity thresholds
- **Output**: CRITICAL_ALERT + LOAD_BALANCER_ACTIVATE

### 3. Power Consumption Monitoring
**Path**: Optimal → Increased → High → Critical → Shutdown Required
- **Initial Event**: Power consumption at optimal levels
- **Progression**: Power draw increases through warning levels
- **Output**: EMERGENCY + BACKUP_POWER_SWITCH

### 4. Storage Capacity Monitoring
**Path**: Healthy → Filling → Near Full → Critical → Emergency Cleanup
- **Initial Event**: Storage at healthy capacity (< 60%)
- **Progression**: Storage fills through warning thresholds
- **Output**: CRITICAL_ALERT + CLEANUP_INITIATED

### 5. Security Threat Detection
**Path**: Secure → Suspicious → Threat Detected → Active Attack → Breach
- **Initial Event**: Normal security baseline
- **Progression**: Threat level escalates through detection stages
- **Output**: EMERGENCY + SECURITY_LOCKDOWN

## Input Vector Format
12-dimensional vectors representing:
- [0]: Temperature (0-1 normalized)
- [1]: Network traffic (0-1 normalized)
- [2]: Power consumption (0-1 normalized)
- [3]: Storage capacity (0-1 normalized)
- [4]: Security threat level (0-1 normalized)
- [5-11]: Additional metrics (latency, CPU, memory, etc.)

## Usage
```bash
# Load and run the example
npm run build
node dist/examples/data-center-monitoring/run-example.js
```

## Expected Behavior
The composite machine will process input vectors and trigger outputs when all 5 sequences reach their respective critical states, demonstrating the coordinated response to data center failures.
