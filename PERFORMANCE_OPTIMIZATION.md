# Reality Engine Core Data Propagation - Performance Optimization Guide

## Overview

This document provides concrete suggestions to improve the performance of the Reality Engine's core data propagation cycle, which processes input vectors through critical event sequences to generate outputs.

---

## Current Architecture Analysis

### Data Flow Cycle

```
Input Queue → Compare with Active Events → Match Detection → Next Event Activation → Output Generation
     ↓              ↓                           ↓                    ↓                      ↓
  O(1) pop     O(n) comparison            O(1) check          O(m) activation        O(k) generation
```

**Where:**
- `n` = number of active events
- `m` = average number of next events per matched event
- `k` = average number of outputs per matched event

**Current Bottlenecks:**
1. Linear search through active events for each input vector
2. Sequential processing of input queue (no parallelization)
3. Full sequence refresh on every WebSocket update
4. No caching of comparison results
5. No indexing of events by value ranges

---

## Optimization Strategies

### 1. **Spatial Indexing for Event Comparison** 🚀 HIGH IMPACT

**Problem:**
Current implementation compares input vector against ALL active events linearly (O(n)).

**Solution:**
Implement a spatial index (R-tree or KD-tree) to index events by their value ranges.

```typescript
// Before: O(n) linear search
activeEvents.forEach(event => {
  if (compareVector(input, event)) { /* activate */ }
});

// After: O(log n) tree search
const candidateEvents = spatialIndex.query(inputVector);
candidateEvents.forEach(event => {
  if (compareVector(input, event)) { /* activate */ }
});
```

**Implementation:**
- Use `rbush` library for 2D R-tree indexing
- Index events by `[minValue - threshold, maxValue + threshold]` bounding boxes
- Rebuild index only when events are activated/deactivated

**Expected Improvement:** 60-80% reduction in comparison time for large event sets (>100 events)

**Code Location:**
- `/src/engine/RealityEngine.ts` - `processInput()` method

---

### 2. **Event Comparison Result Caching** 🚀 MEDIUM-HIGH IMPACT

**Problem:**
Same input vector may be compared against same event multiple times if retrying or testing.

**Solution:**
Implement LRU cache for comparison results.

```typescript
interface ComparisonCache {
  key: string; // hash of (vectorId, eventId)
  result: boolean;
  timestamp: number;
}

const comparisonCache = new LRUCache<string, boolean>(1000);

function compareWithCache(vector: number[], event: Event): boolean {
  const key = `${hashVector(vector)}-${event.id}`;

  if (comparisonCache.has(key)) {
    return comparisonCache.get(key)!;
  }

  const result = performComparison(vector, event);
  comparisonCache.set(key, result);
  return result;
}
```

**Expected Improvement:** 30-50% reduction in comparison time for repeated patterns

**Library:** `lru-cache` npm package

---

### 3. **Batch Event Activation** 🚀 MEDIUM IMPACT

**Problem:**
Events are activated one at a time, triggering multiple state updates and notifications.

**Solution:**
Batch all event activations from a single match into one atomic operation.

```typescript
// Before: Multiple individual activations
matchedEvent.nextVectorIds.forEach(nextId => {
  activateEvent(nextId); // Triggers state update each time
});

// After: Batched activation
const eventsToActivate = matchedEvent.nextVectorIds;
batchActivateEvents(eventsToActivate); // Single state update
```

**Implementation:**
```typescript
class EventActivationBatcher {
  private pendingActivations: Set<string> = new Set();
  private batchTimeout: NodeJS.Timeout | null = null;

  schedule(eventIds: string[]) {
    eventIds.forEach(id => this.pendingActivations.add(id));

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flush(), 0);
    }
  }

  flush() {
    const events = Array.from(this.pendingActivations);
    this.activateMultiple(events);
    this.pendingActivations.clear();
    this.batchTimeout = null;
  }
}
```

**Expected Improvement:** 20-40% reduction in activation overhead

---

### 4. **Incremental Sequence Updates via WebSocket** 🚀 HIGH IMPACT

**Problem:**
Frontend fetches entire sequence graph on every step (expensive for large graphs).

**Solution:**
Send only delta updates via WebSocket.

```typescript
// Before: Full sequence refresh
ws.send({ type: 'simulation-stepped', state: fullState });
frontend: api.getSequences(); // Fetches everything

// After: Delta updates
ws.send({
  type: 'simulation-stepped',
  state: compactState,
  delta: {
    activated: ['event-123', 'event-456'],
    deactivated: ['event-789'],
    outputs: [{ id: 'out-1', vector: [1.0] }]
  }
});
frontend: applyDelta(delta); // Updates only changed nodes
```

**Expected Improvement:** 70-90% reduction in network traffic and rendering time

**Code Locations:**
- `/visualizer/backend/src/server.ts` - WebSocket event emission
- `/visualizer/frontend/src/store.ts` - State update logic

---

### 5. **Worker Thread Pool for Parallel Processing** 🚀 HIGH IMPACT (Advanced)

**Problem:**
Input vectors are processed sequentially, not utilizing multi-core CPUs.

**Solution:**
Use worker threads to process multiple vectors in parallel.

```typescript
import { Worker } from 'worker_threads';

class VectorProcessingPool {
  private workers: Worker[] = [];
  private queue: Array<{ vector: number[], resolve: Function }> = [];

  constructor(poolSize: number = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(new Worker('./vector-processor-worker.js'));
    }
  }

  async process(vector: number[]): Promise<ProcessingResult> {
    const availableWorker = this.getAvailableWorker();
    return new Promise((resolve) => {
      availableWorker.postMessage({ vector });
      availableWorker.once('message', resolve);
    });
  }
}
```

**Considerations:**
- Requires thread-safe event state management
- Best for CPU-intensive comparison operations
- May add complexity for state synchronization

**Expected Improvement:** 2-4x throughput on multi-core systems

---

### 6. **Lazy Output Vector Materialization** 🚀 MEDIUM IMPACT

**Problem:**
Output vectors are fully materialized even if not immediately consumed.

**Solution:**
Generate output vectors lazily only when accessed.

```typescript
class LazyOutputVector {
  private _materialized: number[] | null = null;

  constructor(
    private generator: () => number[],
    private metadata: any
  ) {}

  get vector(): number[] {
    if (!this._materialized) {
      this._materialized = this.generator();
    }
    return this._materialized;
  }
}
```

**Expected Improvement:** 15-25% reduction in memory allocation during high-throughput scenarios

---

### 7. **Qdrant Vector Batch Operations** 🚀 MEDIUM IMPACT

**Problem:**
Vectors are stored/retrieved one at a time from Qdrant.

**Solution:**
Use Qdrant's batch upsert and search operations.

```typescript
// Before: Individual operations
for (const vector of vectors) {
  await qdrantClient.upsert(collection, { points: [vector] });
}

// After: Batch operation
await qdrantClient.upsert(collection, {
  points: vectors,
  wait: true
});
```

**Expected Improvement:** 60-80% reduction in Qdrant operation time

**Code Location:**
- `/src/services/QdrantService.ts`

---

### 8. **Event State Bitmap Indexing** 🚀 MEDIUM IMPACT (Advanced)

**Problem:**
Active event state stored as array/set requiring linear search.

**Solution:**
Use bitmap to track active events for O(1) lookups.

```typescript
class EventStateBitmap {
  private bitmap: Uint32Array;

  constructor(maxEvents: number) {
    this.bitmap = new Uint32Array(Math.ceil(maxEvents / 32));
  }

  setActive(eventIndex: number) {
    const arrayIndex = Math.floor(eventIndex / 32);
    const bitIndex = eventIndex % 32;
    this.bitmap[arrayIndex] |= (1 << bitIndex);
  }

  isActive(eventIndex: number): boolean {
    const arrayIndex = Math.floor(eventIndex / 32);
    const bitIndex = eventIndex % 32;
    return (this.bitmap[arrayIndex] & (1 << bitIndex)) !== 0;
  }
}
```

**Expected Improvement:** 40-60% faster active state checks for large event sets

---

### 9. **Smart WebSocket Throttling** 🚀 LOW-MEDIUM IMPACT

**Problem:**
WebSocket sends update on every single step, overwhelming frontend during fast playback.

**Solution:**
Throttle updates to maximum frame rate (60 FPS).

```typescript
class ThrottledWebSocketEmitter {
  private pendingUpdate: any = null;
  private lastEmit: number = 0;
  private readonly minInterval: number = 16; // ~60 FPS

  emit(event: string, data: any) {
    const now = Date.now();

    if (now - this.lastEmit >= this.minInterval) {
      this.ws.emit(event, data);
      this.lastEmit = now;
      this.pendingUpdate = null;
    } else {
      this.pendingUpdate = { event, data };
      this.scheduleFlush();
    }
  }

  private scheduleFlush() {
    setTimeout(() => {
      if (this.pendingUpdate) {
        this.ws.emit(this.pendingUpdate.event, this.pendingUpdate.data);
        this.pendingUpdate = null;
      }
    }, this.minInterval - (Date.now() - this.lastEmit));
  }
}
```

**Expected Improvement:** 50-70% reduction in WebSocket traffic during fast playback

---

### 10. **Memory Pool for Vector Objects** 🚀 LOW-MEDIUM IMPACT

**Problem:**
Frequent allocation/deallocation of vector objects causes GC pressure.

**Solution:**
Implement object pool for vector instances.

```typescript
class VectorPool {
  private pool: RealityVector[] = [];
  private allocated: Set<RealityVector> = new Set();

  acquire(size: number): RealityVector {
    let vector = this.pool.pop();

    if (!vector) {
      vector = new RealityVector(size);
    }

    this.allocated.add(vector);
    return vector;
  }

  release(vector: RealityVector) {
    if (this.allocated.has(vector)) {
      vector.reset();
      this.pool.push(vector);
      this.allocated.delete(vector);
    }
  }
}
```

**Expected Improvement:** 20-30% reduction in GC pauses during sustained load

---

## Implementation Priority Matrix

| Optimization | Impact | Complexity | Priority | Estimated Dev Time |
|-------------|--------|-----------|----------|-------------------|
| Spatial Indexing | High | Medium | **P0** | 2-3 days |
| Incremental WebSocket Updates | High | Medium | **P0** | 2-3 days |
| Worker Thread Pool | High | High | P1 | 4-5 days |
| Event Activation Batching | Medium | Low | **P0** | 1 day |
| Comparison Caching | Medium-High | Low | **P0** | 1 day |
| Qdrant Batch Operations | Medium | Low | P1 | 1 day |
| WebSocket Throttling | Low-Medium | Low | P2 | 0.5 days |
| Event State Bitmap | Medium | Medium | P1 | 2 days |
| Lazy Output Materialization | Medium | Low | P2 | 1 day |
| Memory Pool | Low-Medium | Medium | P3 | 1-2 days |

---

## Quick Wins (< 1 Day Implementation)

1. **Event Activation Batching** - Immediate 20-40% activation speedup
2. **Comparison Result Caching** - 30-50% reduction for repeated patterns
3. **WebSocket Throttling** - 50-70% reduction in network overhead
4. **Qdrant Batch Operations** - 60-80% faster vector storage

---

## Benchmark Targets

### Current Performance (Baseline)
- Single vector processing: ~10-50ms
- 100 vector batch: ~1-5 seconds
- Event activation: ~1-5ms per event
- WebSocket roundtrip: ~50-100ms

### Optimized Performance (Target)
- Single vector processing: **~2-10ms** (5x improvement)
- 100 vector batch: **~200-500ms** (10x improvement)
- Event activation: **~0.2-1ms** per event (5x improvement)
- WebSocket roundtrip: **~10-20ms** (5x improvement)

---

## Monitoring & Profiling

### Key Metrics to Track

```typescript
interface PerformanceMetrics {
  vectorProcessingTime: number;      // Time to process single vector
  comparisonTime: number;             // Time spent in event comparison
  activationTime: number;             // Time spent activating next events
  outputGenerationTime: number;       // Time spent generating outputs
  webSocketLatency: number;           // Time to send/receive WS message
  sequenceRefreshTime: number;        // Time to refresh frontend graph
  cacheHitRate: number;               // % of cache hits
  throughput: number;                 // Vectors processed per second
}
```

### Profiling Tools
- **Node.js Profiler:** `node --prof app.js`
- **Chrome DevTools:** Performance tab for frontend
- **Clinic.js:** `clinic doctor -- node app.js`
- **0x:** Flamegraph profiler for Node.js

---

## Testing Strategy

1. **Unit Tests:** Verify each optimization maintains correctness
2. **Benchmark Suite:** Measure performance improvements
3. **Load Tests:** Validate under sustained high load
4. **Regression Tests:** Ensure no performance degradation

See: `/e2e/tests/core-data-propagation.spec.ts` for comprehensive validation tests

---

## References

- **Spatial Indexing:** https://github.com/mourner/rbush
- **LRU Cache:** https://github.com/isaacs/node-lru-cache
- **Worker Threads:** https://nodejs.org/api/worker_threads.html
- **Qdrant Batch Ops:** https://qdrant.tech/documentation/concepts/points/#batch-update

---

**Last Updated:** January 3, 2026
**Version:** 1.0
**Maintainer:** Reality Engine Team
