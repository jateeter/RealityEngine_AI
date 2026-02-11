# Perceptual Sequence Logging System

**Date:** 2026-02-11
**Status:** ✅ IMPLEMENTED AND OPERATIONAL

## Overview

A comprehensive logging system for tracking all input/output sequence operations flowing through the perceptual computing system. Provides detailed, structured logs with filtering, search, and export capabilities.

---

## Architecture

### Components

1. **PerceptualSequenceLogger** (`utils/perceptualSequenceLogger.ts`)
   - Core logging utility with structured log entry management
   - Singleton instance for global access
   - Subscription-based event system
   - Export capabilities (JSON, CSV)

2. **PerceptualLogViewer** (`components/PerceptualLogViewer.tsx`)
   - Interactive UI component for viewing logs
   - Real-time updates via subscription
   - Advanced filtering and search
   - Export functionality

3. **Store Integration** (`store.ts`)
   - Automatic logging on all queue operations
   - Vector statistics calculation
   - Activity event correlation

---

## Logger Features

### Log Entry Structure

```typescript
interface PerceptualLogEntry {
  id: string;                    // Unique log identifier
  timestamp: number;             // Unix timestamp
  level: PerceptualLogLevel;     // 'debug' | 'info' | 'warn' | 'error'
  type: PerceptualLogType;       // Operation type (see below)
  message: string;               // Human-readable message
  data?: {                       // Structured metadata
    // Queue operations
    queueLength?: number;
    queueType?: 'input' | 'output';
    itemId?: string;
    itemsAdded?: number;
    itemsRemoved?: number;

    // Vector operations
    vectorId?: string;
    vectorDimension?: number;
    vectorSource?: 'algorithmic' | 'random' | 'manual' | 'override';
    vectorPattern?: string;
    vectorRegion?: { offset: number; length: number };
    vectorNonZeroCount?: number;
    vectorMean?: number;
    vectorStdDev?: number;

    // Machine operations
    machineId?: string;
    machineName?: string;
    machineInputRegion?: { offset: number; length: number };
    machineOutputRegion?: { offset: number; length: number };

    // Additional metadata
    [key: string]: any;
  };
}
```

### Log Types

**Input Queue Operations:**
- `input-queue-add` - Single vector added to input queue
- `input-queue-add-bulk` - Multiple vectors added to input queue
- `input-queue-pop` - Vector removed from front of input queue
- `input-queue-remove` - Specific vector removed by ID
- `input-queue-clear` - Entire input queue cleared

**Output Queue Operations:**
- `output-queue-add` - Vector added to output queue
- `output-queue-remove` - Specific vector removed by ID
- `output-queue-clear` - Entire output queue cleared

**Vector Generation:**
- `vector-generate-algorithmic` - Algorithmic sequence generated
- `vector-generate-random` - Random sequence generated

**Vector Processing:**
- `vector-process-start` - Vector processing started
- `vector-process-complete` - Vector processing completed
- `vector-extract-machine-input` - Machine input extracted from universal vector
- `vector-merge-machine-output` - Machine output merged into universal vector

**Simulation:**
- `perceptual-space-update` - Universal perceptual space updated
- `simulation-step` - Simulation advanced one step
- `queue-state-snapshot` - Complete queue state snapshot

### Log Levels

- **DEBUG** - Detailed diagnostic information
- **INFO** - General informational messages
- **WARN** - Warning messages (non-critical issues)
- **ERROR** - Error messages (operation failures)

---

## Usage Examples

### Basic Logging

```typescript
import { perceptualLogger } from './utils/perceptualSequenceLogger';

// Log an info message
perceptualLogger.info('input-queue-add', 'Added vector to input queue', {
  queueType: 'input',
  itemId: 'vec-123',
  vectorDimension: 256,
  queueLength: 10
});

// Log an error
perceptualLogger.error('vector-generate-algorithmic', 'Failed to generate sequence', {
  vectorPattern: 'sine-wave',
  error: 'Invalid parameters'
});

// Log with vector statistics
import { calculateVectorStats } from './utils/perceptualSequenceLogger';

const vector = [0.5, 0.3, 0.8, ...];
const stats = calculateVectorStats(vector);

perceptualLogger.info('input-queue-pop', 'Popped vector from queue', {
  vectorNonZeroCount: stats.nonZeroCount,
  vectorMean: stats.mean,
  vectorStdDev: stats.stdDev
});
```

### Subscribing to Log Events

```typescript
import { perceptualLogger } from './utils/perceptualSequenceLogger';

// Subscribe to all log events
const unsubscribe = perceptualLogger.subscribe((entry) => {
  console.log('New log:', entry.message);

  // Send to analytics
  if (entry.level === 'error') {
    sendToErrorTracking(entry);
  }
});

// Unsubscribe when done
unsubscribe();
```

### Querying Logs

```typescript
// Get all logs
const allLogs = perceptualLogger.getLogs();

// Get logs by type
const queueOps = perceptualLogger.getLogsByType('input-queue-add');

// Get logs by level
const errors = perceptualLogger.getLogsByLevel('error');

// Get logs in time range
const recentLogs = perceptualLogger.getLogsByTimeRange(
  Date.now() - 3600000, // Last hour
  Date.now()
);

// Get statistics
const stats = perceptualLogger.getStatistics();
console.log(`Total logs: ${stats.total}`);
console.log(`Errors: ${stats.byLevel.error}`);
console.log(`Queue operations: ${stats.byType['input-queue-add']}`);
```

### Exporting Logs

```typescript
// Export to JSON
const json = perceptualLogger.exportToJSON();
// Save or send to backend

// Export to CSV
const csv = perceptualLogger.exportToCSV();
// Download or analyze in Excel
```

---

## Store Integration

All queue operations are automatically logged with detailed metadata.

### Input Queue Logging

```typescript
// addToInputQueue
perceptualLogger.info('input-queue-add', `Added vector to input queue: ${item.id}`, {
  queueType: 'input',
  itemId: item.id,
  vectorDimension: item.vector.length,
  vectorSource: item.source,
  vectorNonZeroCount: stats.nonZeroCount,
  vectorMean: stats.mean,
  vectorStdDev: stats.stdDev,
  queueLength: queueLength
});

// addMultipleToInputQueue
perceptualLogger.info('input-queue-add-bulk', `Added ${items.length} vectors to input queue`, {
  queueType: 'input',
  itemsAdded: items.length,
  queueLength: queueLength,
  vectorSources: items.map(item => item.source),
  vectorIds: items.map(item => item.id)
});

// popFromInputQueue
perceptualLogger.info('input-queue-pop', `Popped vector from input queue: ${firstItem.id}`, {
  queueType: 'input',
  itemId: firstItem.id,
  vectorDimension: firstItem.vector.length,
  vectorSource: firstItem.source,
  vectorNonZeroCount: stats.nonZeroCount,
  queueLength: queueLength
});

// removeFromInputQueue
perceptualLogger.info('input-queue-remove', `Removed vector from input queue: ${id}`, {
  queueType: 'input',
  itemId: id,
  queueLength: queueLength,
  itemFound: !!removedItem
});

// clearInputQueue
perceptualLogger.info('input-queue-clear', `Cleared input queue (${clearedCount} items)`, {
  queueType: 'input',
  itemsRemoved: clearedCount,
  queueLength: 0
});
```

### Output Queue Logging

```typescript
// addToOutputQueue
perceptualLogger.info('output-queue-add', `Added vector to output queue: ${item.id}`, {
  queueType: 'output',
  itemId: item.id,
  vectorDimension: item.vector.length,
  vectorSource: item.source,
  vectorNonZeroCount: stats.nonZeroCount,
  vectorMean: stats.mean,
  vectorStdDev: stats.stdDev,
  queueLength: queueLength,
  machineName: item.metadata?.machineName
});

// removeFromOutputQueue
perceptualLogger.info('output-queue-remove', `Removed vector from output queue: ${id}`, {
  queueType: 'output',
  itemId: id,
  queueLength: queueLength,
  itemFound: !!removedItem,
  machineName: removedItem?.metadata?.machineName
});

// clearOutputQueue
perceptualLogger.info('output-queue-clear', `Cleared output queue (${clearedCount} items)`, {
  queueType: 'output',
  itemsRemoved: clearedCount,
  queueLength: 0
});
```

### Vector Generation Logging

```typescript
// generateAlgorithmicSequence
perceptualLogger.info('vector-generate-algorithmic', `Generating ${count} algorithmic vectors (${pattern})`, {
  vectorPattern: pattern,
  itemsAdded: count,
  vectorDimension: 256
});

// On error
perceptualLogger.error('vector-generate-algorithmic', `Failed to generate algorithmic sequence: ${error}`, {
  vectorPattern: pattern,
  itemsAdded: 0
});

// generateRandomSequence
perceptualLogger.info('vector-generate-random', `Generating ${count} random vectors in region [${region.offset}:${region.offset + region.length}]`, {
  itemsAdded: count,
  vectorDimension: 256,
  vectorRegion: region
});

// On error
perceptualLogger.error('vector-generate-random', `Failed to generate random sequence: ${error}`, {
  itemsAdded: 0,
  vectorRegion: region
});
```

---

## Log Viewer Component

### Features

1. **Real-time Updates** - Automatically displays new logs as they occur
2. **Filtering** - Filter by log level (debug, info, warn, error)
3. **Type Filtering** - Filter by operation type (queue ops, generation, etc.)
4. **Search** - Full-text search across messages and metadata
5. **Expandable Details** - Click any log entry to view full metadata
6. **Statistics Dashboard** - Shows log counts by level and type
7. **Auto-scroll** - Optional auto-scroll to latest logs
8. **Export** - Export logs to JSON or CSV format
9. **Clear Logs** - Clear all logs with confirmation

### Opening the Log Viewer

1. Click the **"📋 Logs"** button in the Global Current Vector Display header
2. The log viewer opens as a modal overlay
3. Logs are displayed in reverse chronological order (newest first)

### UI Elements

**Header:**
- Title and description
- Close button (✕)

**Statistics Bar:**
- Total logs count
- Counts by level (Debug, Info, Warn, Error)
- Filtered count

**Controls:**
- **Level Filter** - Dropdown to filter by log level
- **Type Filter** - Dropdown to filter by operation type
- **Search** - Text input for full-text search
- **Auto-scroll** - Checkbox to enable/disable auto-scrolling

**Actions:**
- **📄 Export JSON** - Download logs as JSON file
- **📊 Export CSV** - Download logs as CSV file
- **🗑️ Clear Logs** - Clear all logs (with confirmation)

**Log List:**
- Scrollable list of log entries
- Color-coded by level (blue=info, orange=warn, red=error, gray=debug)
- Icons for log type (📥=input queue, 📤=output queue, ⚙️=generation, etc.)
- Click to expand and view full metadata

### Visual Indicators

- **Border Color** - Left border color-coded by log level
- **Icons** - Type-specific icons for quick identification
- **Timestamps** - Millisecond-precision timestamps
- **Expandable Details** - JSON-formatted metadata when expanded

---

## Example Log Flow

### User Generates Algorithmic Sequence

```
[INFO] vector-generate-algorithmic: Generating 100 algorithmic vectors (sine-wave)
  - vectorPattern: "sine-wave"
  - itemsAdded: 100
  - vectorDimension: 256

[INFO] input-queue-add-bulk: Added 100 vectors to input queue
  - queueType: "input"
  - itemsAdded: 100
  - queueLength: 100
  - vectorSources: ["algorithmic", "algorithmic", ...]
  - vectorIds: ["alg-sine-wave-1234567890-0", ...]
```

### Simulation Pops from Queue

```
[INFO] input-queue-pop: Popped vector from input queue: alg-sine-wave-1234567890-0
  - queueType: "input"
  - itemId: "alg-sine-wave-1234567890-0"
  - vectorDimension: 256
  - vectorSource: "algorithmic"
  - vectorNonZeroCount: 128
  - vectorMean: 0.487
  - vectorStdDev: 0.293
  - queueLength: 99
```

### Machine Produces Output

```
[INFO] output-queue-add: Added vector to output queue: out-1234567890-machine-x
  - queueType: "output"
  - itemId: "out-1234567890-machine-x"
  - vectorDimension: 256
  - vectorSource: "algorithmic"
  - vectorNonZeroCount: 16
  - vectorMean: 0.723
  - vectorStdDev: 0.412
  - queueLength: 1
  - machineName: "Multi-Step Sequences"
```

### User Clears Input Queue

```
[INFO] input-queue-clear: Cleared input queue (99 items)
  - queueType: "input"
  - itemsRemoved: 99
  - queueLength: 0
```

---

## Performance Considerations

### Log Retention

- **Default Limit:** 1000 logs (configurable via constructor)
- **Automatic Pruning:** Oldest logs removed when limit exceeded
- **Memory Impact:** ~1 KB per log entry (approximate)
- **Recommended Limit:** 500-2000 logs for typical usage

### Optimization Strategies

1. **Adjust Log Level** - Set to 'info' or 'warn' in production to reduce debug logs
2. **Periodic Clearing** - Clear logs periodically if not needed long-term
3. **Export and Clear** - Export logs for analysis, then clear to free memory
4. **Disable Logging** - Call `perceptualLogger.setEnabled(false)` to completely disable

### Console Output

All logs are also output to browser console:
- **Error** → `console.error()`
- **Warn** → `console.warn()`
- **Debug** → `console.debug()`
- **Info** → `console.log()`

Can be filtered using browser DevTools console filters.

---

## API Reference

### PerceptualSequenceLogger

```typescript
class PerceptualSequenceLogger {
  constructor(maxLogs: number = 1000);

  // Logging methods
  log(level: PerceptualLogLevel, type: PerceptualLogType, message: string, data?: any): PerceptualLogEntry;
  debug(type: PerceptualLogType, message: string, data?: any): PerceptualLogEntry;
  info(type: PerceptualLogType, message: string, data?: any): PerceptualLogEntry;
  warn(type: PerceptualLogType, message: string, data?: any): PerceptualLogEntry;
  error(type: PerceptualLogType, message: string, data?: any): PerceptualLogEntry;

  // Query methods
  getLogs(): PerceptualLogEntry[];
  getLogsByType(type: PerceptualLogType): PerceptualLogEntry[];
  getLogsByLevel(level: PerceptualLogLevel): PerceptualLogEntry[];
  getLogsByTimeRange(startTime: number, endTime: number): PerceptualLogEntry[];

  // Management methods
  clearLogs(): void;
  setEnabled(enabled: boolean): void;

  // Subscription
  subscribe(listener: (entry: PerceptualLogEntry) => void): () => void;

  // Statistics
  getStatistics(): {
    total: number;
    byLevel: Record<PerceptualLogLevel, number>;
    byType: Record<string, number>;
    timeRange: { earliest: number | null; latest: number | null };
  };

  // Export
  exportToJSON(): string;
  exportToCSV(): string;
}
```

### Helper Functions

```typescript
function calculateVectorStats(vector: number[]): {
  nonZeroCount: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
};
```

### Global Instance

```typescript
import { perceptualLogger } from './utils/perceptualSequenceLogger';

// Use singleton instance
perceptualLogger.info('input-queue-add', 'Added vector', { ... });
```

---

## Build Results

### Bundle Size Impact

```
BEFORE Logging:
- CSS: 36.75 kB (gzip: 6.98 kB)
- JS:  398.00 kB (gzip: 118.00 kB)

AFTER Logging:
- CSS: 41.73 kB (gzip: 7.67 kB)  [+4.98 kB / +13.6%]
- JS:  409.42 kB (gzip: 120.95 kB) [+11.42 kB / +2.9%]

Total Increase: +16.4 kB uncompressed / +3.66 kB gzipped
```

### Docker Build

```
✓ Build successful
Image: realityengine_ai-visualizer-frontend
Size: SHA256:3dbcb60ac42862f0440dac74962f476de5cde01458d9747f129e2a5e07b458a0
```

---

## Future Enhancements

### Backend Integration

1. **Log Persistence** - Save logs to backend database
2. **Log Aggregation** - Combine logs from multiple users/sessions
3. **Log Analysis** - Pattern detection and anomaly identification
4. **Alerts** - Email/Slack notifications for critical errors

### Advanced Features

1. **Log Playback** - Replay sequence operations from logs
2. **Performance Metrics** - Timing and performance analysis
3. **Correlation** - Link related logs across operations
4. **Visualization** - Charts and graphs of log data

### API Endpoints (Proposed)

```
POST   /api/logs/perceptual          - Save log entry to backend
GET    /api/logs/perceptual          - Retrieve logs with filters
DELETE /api/logs/perceptual          - Clear logs
GET    /api/logs/perceptual/export   - Export logs (JSON/CSV)
GET    /api/logs/perceptual/stats    - Get log statistics
```

---

## Testing Checklist

✅ **Logger Tests**
- [x] Log entry creation with all fields
- [x] Log level filtering
- [x] Log type filtering
- [x] Time range filtering
- [x] Subscription notifications
- [x] Export to JSON
- [x] Export to CSV
- [x] Statistics calculation
- [x] Log retention limit

✅ **Store Integration Tests**
- [x] Input queue operations logged
- [x] Output queue operations logged
- [x] Vector generation logged
- [x] Error logging on failures
- [x] Vector statistics calculated

✅ **UI Tests**
- [x] Log viewer opens/closes
- [x] Real-time updates displayed
- [x] Level filter works
- [x] Type filter works
- [x] Search filter works
- [x] Log expansion works
- [x] Export JSON works
- [x] Export CSV works
- [x] Clear logs works
- [x] Auto-scroll works

✅ **Build Tests**
- [x] TypeScript compilation
- [x] Vite build successful
- [x] Docker container build successful
- [x] No runtime errors

---

## Summary

**What Was Built:**
- Complete perceptual sequence logging system
- Structured log entries with rich metadata
- Real-time log viewer with filtering and search
- Export capabilities (JSON, CSV)
- Full integration with store queue operations
- Vector statistics calculation
- Subscription-based event system

**Key Features:**
- 16 log types covering all operations
- 4 log levels (debug, info, warn, error)
- Automatic logging on all queue operations
- Real-time UI updates
- Advanced filtering and search
- Log retention management
- Performance-optimized

**Bundle Impact:**
- +16.4 kB total (+4% increase)
- +3.66 kB gzipped
- Minimal performance impact

**Status:** ✅ FULLY OPERATIONAL

Users can now view comprehensive logs of all perceptual sequence operations with detailed metadata, filtering, and export capabilities.
