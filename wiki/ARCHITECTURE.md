# Reality Engine Architecture

## System Overview

The Reality Engine is a sophisticated vector-based state machine system that models reality through observable events and vector transitions. The system implements three primary focal points as specified:

1. **PreceptionOfReality** - Input processing and normalization
2. **Reality Sampling** - Observation capture from physical reality
3. **RealityEngine(s)** - Core processing with CriticalEventSequences

## Core Components

### 1. RealityVector

A 1×n dimensional vector representing a quantum of reality state.

**Key Properties:**
- `elements: VectorElement[]` - Vector data with comparators
- `state: Active | Inactive` - Current activation state
- `nextVectorIds: string[]` - Vectors to activate on match
- `outputVectors: OutputVector[]` - Reality assertions
- `isInitial: boolean` - Always-active flag

**Operations:**
```typescript
setActive()         // Activate vector
clearActive()       // Deactivate (unless initial)
match(input)        // Compare against input
transition(input)   // Process state transition
```

**Comparator Types:**
- `EQUALS` - Exact match
- `THRESHOLD` - Within distance threshold
- `PATTERN` - Similarity-based
- `CUSTOM` - User-defined function

### 2. CriticalEventSequence

A collection of interconnected RealityVectors that affects reality through OutputVector assertions.

**Requirements:**
- ≥1 InitialRealityVector (always active)
- ≥1 RealityVector with OutputVector

**Key Operations:**
```typescript
addVector(vector)      // Add vector to sequence
transition(input)      // Process all active vectors
reset()               // Return to initial state
validate()            // Check validity
```

**Transition Process:**
1. Match input against all active vectors
2. Deactivate non-matching non-initial vectors
3. Activate NextVectors of matched vectors
4. Collect OutputVectors for assertion

### 3. RealityEngine

Central orchestrator managing multiple CriticalEventSequences.

**Responsibilities:**
- Manage sequence lifecycle
- Route InputRealityVectors
- Coordinate transitions
- Collect OutputVectors
- Maintain history
- Interface with VectorStore

**Key Methods:**
```typescript
addSequence(seq)           // Register sequence
processInput(vector)       // Process through all sequences
resetAllSequences()        // Reset to initial states
persistAllSequences()      // Save to vector store
getStats()                // Engine statistics
```

### 4. PreceptionOfReality

Transforms raw observations into normalized InputRealityVectors.

**Pipeline:**
```
Raw Observation
    ↓
[Transformation Functions]
    ↓
[Dimension Normalization]
    ↓
InputRealityVector
```

**Features:**
- Configurable transformation pipeline
- Automatic dimension handling
- Normalization (0-1 range)
- Metadata preservation

### 5. RealitySampler

Manages observation sampling with multiple strategies.

**Sampling Strategies:**

| Strategy | Description | Use Case |
|----------|-------------|----------|
| CONTINUOUS | Process as fast as possible | High-throughput systems |
| PERIODIC | Fixed interval sampling | Regular monitoring |
| EVENT_DRIVEN | React to specific events | Async event handling |
| MANUAL | Explicit triggering | Controlled testing |

**Buffer Management:**
- Configurable buffer size
- FIFO overflow handling
- Batch processing support

### 6. VectorStore

Persistence layer using Qdrant vector database.

**Operations:**
```typescript
storeVector(vector)              // Persist single vector
storeVectors(vectors)            // Bulk persist
getVector(id)                    // Retrieve by ID
searchSimilar(vector, limit)     // Similarity search
storeSequence(sequence)          // Persist sequence
```

**Qdrant Features:**
- High-dimensional vector storage
- Cosine similarity search
- Efficient indexing
- Horizontal scalability

## Data Flow

### Complete Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│  PHYSICAL REALITY                                             │
│  (Sensors, Events, Observations)                              │
└────────────────────┬─────────────────────────────────────────┘
                     │ Raw data
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  PRECEPTION OF REALITY                                        │
│  • Transform to vector format                                 │
│  • Apply preprocessing                                        │
│  • Normalize dimensions                                       │
└────────────────────┬─────────────────────────────────────────┘
                     │ ProcessedPerception
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  REALITY SAMPLER                                              │
│  • Buffer observations                                        │
│  • Apply sampling strategy                                    │
│  • Feed to engine                                             │
└────────────────────┬─────────────────────────────────────────┘
                     │ InputRealityVector
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  REALITY ENGINE                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CriticalEventSequence #1                              │  │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐          │  │
│  │  │ Vector 1 │→→→│ Vector 2 │→→→│ Vector 3 │          │  │
│  │  │ (Initial)│   │ (Active) │   │ (Output) │          │  │
│  │  └──────────┘   └──────────┘   └──────────┘          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  CriticalEventSequence #2                              │  │
│  │  ┌──────────┐   ┌──────────┐                          │  │
│  │  │ Vector A │→→→│ Vector B │                          │  │
│  │  │ (Initial)│   │ (Output) │                          │  │
│  │  └──────────┘   └──────────┘                          │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────────────┘
                     │ TransitionResult
                     │ (with OutputVectors)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  OUTPUT REALITY VECTORS                                       │
│  • Assert effects on reality                                  │
│  • Trigger external systems                                   │
│  • Record state changes                                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  QDRANT VECTOR STORE                                          │
│  • Persistent storage                                         │
│  • Similarity search                                          │
│  • Vector indexing                                            │
└──────────────────────────────────────────────────────────────┘
```

### Transition Flow Detail

```
InputRealityVector arrives
        │
        ├─→ For each CriticalEventSequence:
        │       │
        │       ├─→ For each Active RealityVector:
        │       │       │
        │       │       ├─→ Match against input
        │       │       │   │
        │       │       │   ├─→ Match? NO  → Deactivate (if not initial)
        │       │       │   │
        │       │       │   └─→ Match? YES → 1. Collect OutputVectors
        │       │       │                    2. Activate NextVectors
        │       │       │                    3. Record in results
        │       │       │
        │       │       └─→ Next vector
        │       │
        │       └─→ Return sequence results
        │
        └─→ Aggregate all OutputVectors
            │
            └─→ Return TransitionResult
```

## API Architecture

### REST API Layer

```
┌─────────────────────────────────────────────────────────┐
│  Express.js HTTP Server (Port 3000)                     │
└─────────────────┬───────────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ Config │  │  Vector  │  │ Sequence │
│  API   │  │   API    │  │   API    │
└────────┘  └──────────┘  └──────────┘
    │             │             │
    ▼             ▼             ▼
┌─────────────────────────────────────────┐
│         RealityEngine                   │
│  ┌───────────────────────────────────┐  │
│  │  CriticalEventSequences           │  │
│  └───────────────────────────────────┘  │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Sampler  │  │ Engine   │  │Perception│
│   API    │  │   API    │  │   API    │
└──────────┘  └──────────┘  └──────────┘
```

### Endpoint Categories

**Configuration** (`/api/config`)
- GET `/api/config` - Get configuration
- PUT `/api/config/dimension` - Update dimension
- PUT `/api/config/threshold` - Update threshold

**Vectors** (`/api/vectors`)
- POST `/api/vectors` - Create vector
- GET `/api/vectors/:id` - Get vector
- DELETE `/api/vectors/:id` - Delete vector
- POST `/api/vectors/search` - Search similar

**Sequences** (`/api/sequences`)
- POST `/api/sequences` - Create sequence
- GET `/api/sequences` - List all
- GET `/api/sequences/:id` - Get specific
- DELETE `/api/sequences/:id` - Delete
- POST `/api/sequences/:id/reset` - Reset
- POST `/api/sequences/:id/vectors` - Add vector
- POST `/api/sequences/persist` - Persist all

**Engine** (`/api/engine`)
- POST `/api/engine/process` - Process input
- POST `/api/engine/reset` - Reset all
- GET `/api/engine/stats` - Get statistics
- GET `/api/engine/active` - Active vectors
- GET `/api/engine/history` - Transition history

**Perception** (`/api/perception`)
- POST `/api/perception/observe` - Process observation

**Sampler** (`/api/sampler`)
- POST `/api/sampler/start` - Start sampler
- POST `/api/sampler/stop` - Stop sampler
- POST `/api/sampler/sample` - Manual sample
- GET `/api/sampler/stats` - Sampler statistics

## Configuration System

### Configuration Hierarchy

```
Environment Variables (.env)
    ↓
Config Singleton
    ↓
Runtime Updates (API)
```

### Configurable Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| VECTOR_DIMENSION | number | 128 | Dimension of vectors (n) |
| MATCH_THRESHOLD | number | 0.85 | Default match threshold |
| QDRANT_URL | string | localhost:6333 | Vector DB URL |
| COLLECTION_NAME | string | reality_vectors | Collection name |
| PORT | number | 3000 | API server port |

## Storage Architecture

### Qdrant Collections

**reality_vectors**
- Primary vector storage
- Contains all RealityVectors
- Indexed for similarity search

**reality_vectors_sequences**
- Sequence metadata storage
- Contains CriticalEventSequences
- References vectors by ID

### Data Persistence

```typescript
// Vector storage format
{
  id: string,
  vector: number[],  // Normalized to VECTOR_DIMENSION
  payload: {
    elements: VectorElement[],
    state: 'active' | 'inactive',
    nextVectorIds: string[],
    outputVectors: OutputVector[],
    isInitial: boolean,
    metadata: Record<string, any>,
    timestamp: number
  }
}
```

## Scalability Considerations

### Horizontal Scaling

- **API Layer**: Stateless, can run multiple instances
- **Qdrant**: Supports clustering and replication
- **Engine State**: Can be partitioned by sequence

### Performance Optimization

1. **Vector Search**: O(log n) with HNSW indexing
2. **Transition Processing**: O(active_vectors × sequences)
3. **Buffer Management**: Configurable size limits
4. **History Pruning**: Automatic size management

### Resource Management

- Configurable history size
- Buffer size limits
- Connection pooling
- Graceful shutdown

## Security Considerations

### API Security

- Input validation on all endpoints
- Vector dimension limits (1-4096)
- Threshold range validation (0-1)
- Payload size limits

### Data Security

- No authentication by default (add middleware)
- Qdrant access control (configure in production)
- Environment variable protection

## Deployment

### Docker Composition

```yaml
services:
  qdrant:           # Vector database
  reality-engine:   # API server
```

### Production Recommendations

1. Add authentication middleware
2. Configure Qdrant persistence
3. Set up monitoring/logging
4. Implement rate limiting
5. Configure CORS policies
6. Enable HTTPS/TLS
7. Set resource limits

## Monitoring & Observability

### Key Metrics

- Active vector count
- Transition rate
- Match success rate
- Output vector frequency
- Sampler buffer size
- API response times

### Health Checks

- `/api/health` - API server health
- Qdrant `/health` - Database health
- Engine statistics - System state

## Extension Points

### Custom Comparators

```typescript
const customComparator: ComparatorFunction = (
  input, reference, threshold
) => {
  // Custom logic
  return { matched: boolean, score: number };
};
```

### Custom Transformers

```typescript
perception.addTransformer((data: number[]) => {
  // Transform logic
  return transformedData;
});
```

### Event Hooks

Future extension points:
- Pre/post transition hooks
- Vector activation callbacks
- Output vector handlers
- Custom sampling strategies

## Testing Strategy

### Unit Tests

- RealityVector operations (src/__tests__/RealityVector.test.ts:1)
- CriticalEventSequence logic (src/__tests__/CriticalEventSequence.test.ts:1)
- Comparator functions
- State transitions

### Integration Tests

- API endpoint testing
- Vector store operations
- End-to-end pipelines
- Multi-sequence interactions

### Performance Tests

- Large vector sets
- High-frequency sampling
- Concurrent transitions
- Memory usage

## Quantum Foam Analogy

The specification mentions a "RealityEngine_QuantumFoam" concept:

```
Quantum Foam (Stochastic Source)
        ↓
Observation (Collapse to InputVector)
        ↓
RealityEngine Processing
        ↓
OutputVector Assertion (Measurement Effect)
```

This is implemented via:
```typescript
sampler.generateQuantumFoamSample(dimension);
```

## Future Enhancements

1. **Multi-Engine Coordination**: Engines affecting each other
2. **Probabilistic Matching**: Fuzzy logic integration
3. **Machine Learning**: Adaptive comparators
4. **Distributed Processing**: Multi-node deployment
5. **Time-Series Analysis**: Temporal pattern recognition
6. **Visual Dashboard**: Real-time monitoring UI
7. **GraphQL API**: Alternative query interface
8. **Stream Processing**: Kafka/Redis integration

---

**Version**: 1.0.0
**Last Updated**: 2025-11-19
**Maintained by**: Reality Engine Team
