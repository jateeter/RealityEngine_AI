# Reality Engine

A sophisticated reality engine system implementing vector-based state machines with dynamic transitions and pattern matching capabilities. The system models reality as a collection of vector states that transition based on observations, enabling complex event sequence processing and reality manipulation through output assertions.

Claude Code generated seed version of the Reality Engine (with incremental prompt specification)

## 🌐 Service Access URLs

After starting with `./docker-start.sh` or `docker-compose up -d`:

| Service | URL | Description |
|---------|-----|-------------|
| **Visualizer Frontend** | http://localhost:5173 | Main web interface |
| **Grafana Logs** | http://localhost:3002 | Centralized logging dashboard |
| **Reality Engine API** | http://localhost:3000 | Core API server |
| **Visualizer Backend** | http://localhost:3001 | WebSocket proxy |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | Vector database UI |
| **Loki API** | http://localhost:3100 | Log aggregation service |

## Table of Contents

- [Overview](#overview)
- [Visualizer User Guide](#visualizer-user-guide) ⭐ **NEW**
- [Core Concepts](#core-concepts)
- [Architecture](#architecture)
- [Installation](#installation)
- [Docker Deployment](#docker-deployment)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [E2E Testing](#e2e-testing)

## Overview

The Reality Engine is built on three primary components:

1. **PreceptionOfReality**: Processes raw observations into normalized InputRealityVectors
2. **Reality Sampling**: Captures observations from physical reality and feeds them to the engine
3. **RealityEngine**: Manages CriticalEventSequences and processes vector transitions

The system uses **Qdrant**, an open-source vector database, for storing and querying high-dimensional vectors with efficient similarity search capabilities.

## Visualizer User Guide

The Reality Engine Visualizer provides a production-ready web interface for managing and visualizing critical event sequence machines. The new UI/UX focuses on machine-centric workflows with two primary views:

### Machine Selection View
- **Library interface** for browsing all machines (examples + custom)
- **Search and filter** capabilities for quick machine discovery
- **Machine cards** with statistics and quick actions
- **CRUD operations** for creating, editing, and deleting machines

### Machine Administration View
- **Full-screen graph visualization** of critical event sequences
- **Slide-out legend panel** - Hover on right edge to reveal graph legend with event space indicators
- **Input stream controls**:
  - **Reality Sensing Mode**: Auto-activates random vector generation when no test inputs available
  - **Random Vector Generator**: Generate test input vectors with configurable dimension and count
  - **Binary Threshold**: Optional rounding to {0.00, 1.00} for discrete event testing
  - **Speed Control**: Adjust simulation playback from 200ms to 1000ms
  - **Manual Step**: Single-step through input vectors for detailed inspection
- **Real-time visualization**: Active events highlight during simulation playback
- **Clean interface**: Processing indicators and attributions removed for production-ready appearance

### Quick Access
- **Frontend**: http://localhost:5173
- **Comprehensive Guide**: [VISUALIZER_USER_GUIDE.md](./VISUALIZER_USER_GUIDE.md)
- **User Flows**: Three common workflows with click-by-click instructions
- **E2E Tests**: [e2e/visualizer-user-flows.spec.ts](./e2e/visualizer-user-flows.spec.ts)

The visualizer automatically loads your last viewed machine on startup for seamless workflow continuity.

### Universal Perceptual Space Visualization ⭐ **NEW**

The Reality Engine now includes a **Universal Input Vector Display** that visualizes the complete 256-byte perceptual space (En) where all machines perceive and interact with reality.

**Key Features:**
- **256-byte grid visualization** of the complete perceptual space
- **Machine interconnection graph** showing data flow between machines
- **Random stream generator** for testing perceptual scenarios
- **Real-time updates** showing machine outputs overwriting inputs
- **Color-coded regions** (blue for inputs, pink for outputs)
- **Interactive controls** for generating and simulating perceptual streams

**Quick Access:**
1. Start the system: `./scripts/start.sh`
2. Open: http://localhost:5173
3. Load a machine (e.g., "RS Flip Flop")
4. Switch to "🔗 Interconnections" view
5. Scroll down to see the Universal Input Vector Display
6. Click "🎲 Random Stream Generator" to generate test data

**Documentation:**
- Quick Start Guide: [QUICKSTART_VISUALIZATION.md](./QUICKSTART_VISUALIZATION.md)
- Complete Architecture: [PERCEPTUAL_SPACE_ARCHITECTURE.md](./PERCEPTUAL_SPACE_ARCHITECTURE.md)
- Visualization Details: [UNIVERSAL_INPUT_VECTOR_VISUALIZATION.md](./UNIVERSAL_INPUT_VECTOR_VISUALIZATION.md)
- Startup Verification: [STARTUP_VERIFICATION.md](./STARTUP_VERIFICATION.md)

This visualization makes the perceptual space architecture fully transparent, enabling you to understand exactly how machines perceive reality and how their outputs propagate through the shared universal space.

### Centralized Logging with Loki and Grafana ⭐ **NEW**

The Reality Engine now includes **Grafana Loki** for centralized log aggregation and **Grafana** for visualization. All Docker containers automatically forward logs using the Loki log driver.

**Key Features:**
- **Centralized log collection** from all services (Reality Engine, Qdrant, Visualizer)
- **Real-time log streaming** with powerful LogQL query language
- **Pre-configured dashboard** with service metrics and error tracking
- **30-day log retention** with automatic compaction
- **Low resource overhead** (~256MB RAM for Loki)

**Quick Access:**
1. Start the system: `./scripts/start.sh`
2. Open Grafana: http://localhost:3002
3. Login: `admin` / `admin` (change on first login)
4. View "Reality Engine Overview" dashboard

**Common Queries:**
```logql
# All logs
{app="reality-engine"}

# Specific service
{app="reality-engine", service="reality-engine"}

# Error logs only
{app="reality-engine"} |~ "error|Error|ERROR"

# Log rate by service
sum(count_over_time({app="reality-engine"}[5m])) by (service)
```

**Documentation:**
- Complete Setup Guide: [LOKI_GRAFANA_SETUP.md](./LOKI_GRAFANA_SETUP.md)
- Includes troubleshooting, advanced queries, and alerting configuration

## Core Concepts

### RealityVector

A 1×n dimensional vector that represents a state in reality. Each RealityVector has:

- **Elements**: Each element has a value and comparator (equals, threshold, pattern, custom)
- **State**: Active or Inactive
- **NextVectors**: Collection of vectors to activate on match
- **OutputVectors**: Vectors to assert when matched (affects reality)
- **InitialVector**: Flag indicating if this vector is always active

**Operations**:
- `setActive()`: Activate the vector
- `clearActive()`: Deactivate (unless it's an initial vector)
- `match(inputVector)`: Compare against an input vector
- `transition(inputVector)`: Perform state transition

### CriticalEventSequence

A collection of interconnected RealityVectors that impacts reality through OutputVector assertions.

**Requirements**:
- Must contain at least one InitialRealityVector (always active)
- Must contain at least one RealityVector with an OutputVector

**Key Methods**:
- `transition(inputVector)`: Process input through all active vectors
- `reset()`: Return to initial state
- `validate()`: Check if sequence meets requirements

### PreceptionOfReality

Transforms raw observations into normalized InputRealityVectors through:
- Dimension normalization
- Value transformations
- Preprocessing pipelines

### RealitySampler

Manages observation sampling with multiple strategies:
- **CONTINUOUS**: Process observations as fast as possible
- **PERIODIC**: Sample at regular intervals
- **EVENT_DRIVEN**: React to specific events
- **MANUAL**: Explicitly triggered sampling

### RealityEngine

The core processing engine that:
- Manages multiple CriticalEventSequences
- Routes InputRealityVectors through all sequences
- Collects and coordinates OutputVector assertions
- Maintains transition history
- Interfaces with vector storage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Physical Reality                        │
│                    (Observations/Samples)                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   PreceptionOfReality                        │
│              (Transform to InputRealityVector)               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     RealitySampler                           │
│           (Buffer, Strategy, Feed to Engine)                 │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     RealityEngine                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         CriticalEventSequence #1                     │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │ Vector (I) │→ │ Vector (A) │→ │ Vector (O) │    │   │
│  │  └────────────┘  └────────────┘  └────────────┘    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         CriticalEventSequence #2                     │   │
│  │  ┌────────────┐  ┌────────────┐                     │   │
│  │  │ Vector (I) │→ │ Vector (O) │                     │   │
│  │  └────────────┘  └────────────┘                     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  OutputRealityVectors                        │
│                 (Assert to Affect Reality)                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Qdrant Vector Store                       │
│              (Persistent Vector Storage & Search)            │
└─────────────────────────────────────────────────────────────┘

Legend:
(I) = Initial Vector (always active)
(A) = Active Vector
(O) = Vector with OutputVector
```

## Installation

### Prerequisites

- Node.js 22+ (Current LTS)
- Docker and Docker Compose
- npm or yarn

### Setup

1. Clone the repository:
```bash
cd realityEngine
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Edit `.env` to configure vector dimensions and thresholds:
```env
VECTOR_DIMENSION=128
MATCH_THRESHOLD=0.85
QDRANT_URL=http://localhost:6333
PORT=3000
```

5. Start the services with Docker Compose:
```bash
npm run docker:up
```

This will start:
- **Qdrant** on ports 6333 (HTTP) and 6334 (gRPC)
- **Reality Engine API** on port 3000

## Docker Deployment

**Recommended for production and easy setup**

Run the entire stack (Reality Engine API, Visualizer Backend, Visualizer Frontend, and Qdrant) with a single command:

```bash
# Start all services
./docker-start.sh

# Or manually
docker-compose up -d
```

This starts:
- **Qdrant** on ports 6333 (HTTP) and 6334 (gRPC)
- **Reality Engine API** on port 3000
- **Visualizer Backend** on port 3001
- **Visualizer Frontend** on port 5173

**Access the application:**
- Visualizer: http://localhost:5173
- API: http://localhost:3000
- Qdrant Dashboard: http://localhost:6333/dashboard

**Useful commands:**
```bash
./docker-status.sh   # Check service health
./docker-logs.sh     # View logs
./docker-stop.sh     # Stop all services
```

**Documentation:**
- Quick reference: [DOCKER_QUICKSTART.md](./DOCKER_QUICKSTART.md)
- Complete guide: [DOCKER.md](./DOCKER.md)

## Quick Start

### 1. Build and run locally (development):

```bash
npm run build
npm start
```

### 2. Create a simple RealityVector:

```bash
curl -X POST http://localhost:3000/api/vectors \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {"value": 0.5, "comparatorType": "threshold", "threshold": 0.1},
      {"value": 0.8, "comparatorType": "equals"}
    ],
    "isInitial": true
  }'
```

### 3. Create a CriticalEventSequence:

```bash
curl -X POST http://localhost:3000/api/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example Sequence",
    "vectors": [
      {
        "elements": [
          {"value": 0.5, "comparatorType": "threshold", "threshold": 0.1}
        ],
        "isInitial": true,
        "nextVectorIds": ["vector-2-id"],
        "outputVectors": []
      },
      {
        "id": "vector-2-id",
        "elements": [
          {"value": 0.8, "comparatorType": "threshold", "threshold": 0.1}
        ],
        "isInitial": false,
        "nextVectorIds": [],
        "outputVectors": [
          {
            "id": "output-1",
            "vector": [1.0, 0.5, 0.3],
            "timestamp": 1234567890
          }
        ]
      }
    ]
  }'
```

### 4. Process an input vector:

```bash
curl -X POST http://localhost:3000/api/engine/process \
  -H "Content-Type: application/json" \
  -d '{
    "vector": [0.52, 0.79]
  }'
```

### 5. Start the sampler:

```bash
curl -X POST http://localhost:3000/api/sampler/start \
  -H "Content-Type: application/json" \
  -d '{
    "strategy": "periodic",
    "intervalMs": 1000
  }'
```

## API Reference

### Configuration Endpoints

#### GET `/api/config`
Get current configuration.

#### PUT `/api/config/dimension`
Update vector dimension.
```json
{"dimension": 256}
```

#### PUT `/api/config/threshold`
Update match threshold.
```json
{"threshold": 0.90}
```

### Vector Endpoints

#### POST `/api/vectors`
Create a new RealityVector.

**Request Body:**
```json
{
  "elements": [
    {
      "value": 0.5,
      "comparatorType": "threshold",
      "threshold": 0.1
    }
  ],
  "isInitial": true
}
```

**Comparator Types:**
- `equals`: Exact equality match
- `threshold`: Match within threshold distance
- `pattern`: Pattern-based similarity
- `custom`: Custom comparison function

#### POST `/api/vectors/search`
Search for similar vectors.

**Request Body:**
```json
{
  "vector": [0.5, 0.8, 0.3],
  "limit": 10,
  "threshold": 0.85
}
```

### Sequence Endpoints

#### POST `/api/sequences`
Create a new CriticalEventSequence.

#### GET `/api/sequences`
Get all sequences.

#### GET `/api/sequences/:id`
Get a specific sequence.

#### DELETE `/api/sequences/:id`
Delete a sequence.

#### POST `/api/sequences/:id/reset`
Reset sequence to initial state.

#### POST `/api/sequences/:id/vectors`
Add a vector to a sequence.

#### POST `/api/sequences/persist`
Persist all sequences to vector store.

### Engine Endpoints

#### POST `/api/engine/process`
Process an InputRealityVector through all sequences.

**Request Body:**
```json
{
  "vector": [0.5, 0.8, 0.3, ...]
}
```

**Response:**
```json
{
  "result": {
    "inputVector": [0.5, 0.8, 0.3],
    "timestamp": 1234567890,
    "sequenceResults": {
      "sequence-id-1": {
        "matchedVectors": ["vector-1", "vector-2"],
        "activatedVectors": ["vector-3"],
        "assertedOutputs": [...]
      }
    },
    "totalOutputs": [...]
  }
}
```

#### POST `/api/engine/reset`
Reset all sequences to initial state.

#### GET `/api/engine/stats`
Get engine statistics.

#### GET `/api/engine/active`
Get all currently active vectors.

#### GET `/api/engine/history?limit=10`
Get transition history.

### Perception Endpoints

#### POST `/api/perception/observe`
Process a raw observation into an InputRealityVector.

**Request Body:**
```json
{
  "data": [0.1, 0.2, 0.3],
  "source": "sensor-1",
  "metadata": {"location": "lab"}
}
```

### Sampler Endpoints

#### POST `/api/sampler/start`
Start the reality sampler.

**Request Body:**
```json
{
  "strategy": "periodic",
  "intervalMs": 1000
}
```

**Strategies:**
- `continuous`: Process as fast as possible
- `periodic`: Sample at intervals
- `event-driven`: React to events
- `manual`: Explicit triggering

#### POST `/api/sampler/stop`
Stop the sampler.

#### POST `/api/sampler/sample`
Manually sample an observation.

**Request Body:**
```json
{
  "data": [0.5, 0.8],
  "source": "manual",
  "metadata": {}
}
```

#### GET `/api/sampler/stats`
Get sampler statistics.

## Examples

### Example 1: Simple State Machine

Create a two-state machine that toggles between states:

```typescript
import { RealityVector, CriticalEventSequence } from './src/models';
import { ComparatorType } from './src/models/types';

// State A
const stateA = new RealityVector(
  [{ value: 1.0, comparatorType: ComparatorType.EQUALS }],
  true // initial vector
);

// State B
const stateB = new RealityVector(
  [{ value: 0.0, comparatorType: ComparatorType.EQUALS }],
  false
);

// Connect states
stateA.addNextVector(stateB.id);
stateB.addNextVector(stateA.id);

// Create sequence
const sequence = new CriticalEventSequence('Toggle Machine');
sequence.addVector(stateA);
sequence.addVector(stateB);
```

### Example 2: Quantum Foam Sampling

Generate random observations (quantum foam):

```typescript
import { RealitySampler, PreceptionOfReality } from './src/engine';

const perception = new PreceptionOfReality(128);
const sampler = new RealitySampler(perception, engine, {
  strategy: SamplingStrategy.CONTINUOUS
});

// Generate quantum foam sample
const quantumSample = sampler.generateQuantumFoamSample(128);
sampler.sample(quantumSample);
```

### Example 3: Pattern Recognition Sequence

Create a sequence that recognizes specific patterns:

```typescript
const recognizer = new RealityVector(
  [
    { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
    { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold: 0.1 },
    { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold: 0.15 }
  ],
  true
);

recognizer.addOutputVector({
  id: 'pattern-detected',
  vector: [1.0, 1.0, 1.0],
  timestamp: Date.now(),
  metadata: { pattern: 'recognized' }
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VECTOR_DIMENSION` | Dimension of reality vectors | 128 |
| `MATCH_THRESHOLD` | Default matching threshold | 0.85 |
| `QDRANT_URL` | Qdrant database URL | http://localhost:6333 |
| `COLLECTION_NAME` | Vector collection name | reality_vectors |
| `PORT` | API server port | 3000 |
| `NODE_ENV` | Environment mode | development |

### Adjusting Vector Dimension

The vector dimension (n) can be configured via:

1. Environment variable: `VECTOR_DIMENSION=256`
2. Runtime API call: `PUT /api/config/dimension`
3. Configuration object in code

**Note**: Changing dimension after storing vectors requires migration.

## Development

### Project Structure

```
realityEngine/
├── src/
│   ├── models/              # Core domain models
│   │   ├── RealityVector.ts
│   │   ├── CriticalEventSequence.ts
│   │   └── types.ts
│   ├── engine/              # Engine components
│   │   ├── RealityEngine.ts
│   │   ├── PreceptionOfReality.ts
│   │   └── RealitySampler.ts
│   ├── services/            # External services
│   │   └── VectorStore.ts
│   ├── api/                 # API layer
│   │   └── routes.ts
│   ├── config/              # Configuration
│   │   └── config.ts
│   ├── __tests__/           # Tests
│   └── index.ts             # Entry point
├── docker-compose.yml       # Docker orchestration
├── Dockerfile              # Container definition
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

### Running Development Server

```bash
npm run dev
```

### Docker Commands

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart reality-engine
```

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm test -- --coverage
```

### Test Structure

- `RealityVector.test.ts`: Vector matching and transitions
- `CriticalEventSequence.test.ts`: Sequence operations and validation

## E2E Testing

End-to-end tests validate the full Docker deployment stack using **Playwright**.

### Quick Start

```bash
# Install Playwright
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI (recommended for development)
npm run test:e2e:ui

# Run with Docker automation
npm run test:e2e:docker
```

### What's Tested

- ✅ **API Endpoints** - All Reality Engine REST APIs
- ✅ **Visualizer UI** - React frontend interactions
- ✅ **Full Integration** - Complete workflows across all services
- ✅ **Multi-browser** - Chromium, Firefox, WebKit
- ✅ **Docker Stack** - All 4 services working together

### Test Reports

```bash
# View HTML report
npx playwright show-report e2e-report

# View test results
cat e2e-results.json
```

### CI/CD

E2E tests run automatically on:
- Push to `main` or `develop`
- Pull requests
- Manual workflow dispatch

See [E2E_TESTING.md](./E2E_TESTING.md) for complete documentation.

## Advanced Topics

### Custom Comparators

Define custom comparison logic:

```typescript
const customComparator = (
  inputValue: number,
  referenceValue: number,
  threshold?: number
): MatchResult => {
  // Custom logic
  const matched = Math.abs(inputValue - referenceValue) < (threshold || 0.1);
  return { matched, score: matched ? 1 : 0 };
};

const element: VectorElement = {
  value: 0.5,
  comparatorType: ComparatorType.CUSTOM,
  customComparator
};
```

### Quantum Foam Model

The system can model quantum-like behavior where:
- Random observations generate from "quantum foam"
- Observations collapse into defined states (InputRealityVectors)
- OutputVectors represent "measurement" effects on reality

### Interconnected Sequences

Sequences can affect each other through:
- Shared vector references
- OutputVectors that feed as InputVectors to other sequences
- Coordinated state transitions

## Troubleshooting

### Qdrant Connection Issues

```bash
# Check Qdrant status
docker-compose ps

# View Qdrant logs
docker-compose logs qdrant

# Restart Qdrant
docker-compose restart qdrant
```

### Vector Dimension Mismatch

Ensure all vectors match the configured dimension. Use PreceptionOfReality to normalize dimensions automatically.

### Memory Usage

For large vector collections, consider:
- Limiting history size in RealityEngine constructor
- Periodic cleanup of old transitions
- Configuring Qdrant memory limits in docker-compose.yml

## License

MIT

## Contributing

Contributions welcome! Please submit issues and pull requests.

## References

- **Qdrant Documentation**: https://qdrant.tech/documentation/
- **Vector Databases**: Understanding high-dimensional vector storage and similarity search
- **State Machines**: Finite state automata and transition systems
- **Pattern Matching**: Vector similarity and threshold-based matching

---

Built with TypeScript, Express, and Qdrant Vector Database.
