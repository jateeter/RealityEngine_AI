# Reality Engine — Architecture

## System Overview

The Reality Engine processes reality as a stream of 256-element vectors flowing through registered state machines. Each machine has a perceptual mapping (input and output regions within the shared 256-byte perceptual space) and a set of CriticalEventSequences that define its recognition and output behaviour.

---

## Services

| Service | Technology | Role |
|---|---|---|
| **Reality Engine** | Scala 2.13 / Akka HTTP | Core engine: machine registry, perceptual space simulator, CES processing |
| **Visualizer Backend** | Node.js / Express / ws | WebSocket gateway: relays step results to UI clients |
| **Visualizer Frontend** | React / TypeScript / D3 | Primary UI: Tobias canvas, machine administration, interconnection graph |
| **Perception Engine Backend** | Node.js / Express / ws | Source assembly: composes 256-byte push vectors from sources |
| **Perception Engine Frontend** | React / TypeScript | Source management UI |
| **TLS Proxy** | nginx | Terminates HTTPS/WSS for all external ports |
| **Qdrant** | Qdrant | Vector database for machine/sequence persistence |
| **Loki** | Grafana Loki | Log aggregation |
| **Grafana** | Grafana | Log visualization and dashboards |

---

## Reality Engine (Scala)

### Perceptual Space

`PerceptualSpace` is a mutable `Array[Double]` of length 256. It is the single shared medium through which all machines communicate.

Operations:
- `setPerceptualVector(v)` — replaces the entire space (used by `processImmediate`)
- `updateRegion(offset, v)` — writes `v` starting at `offset` (used by the configured step loop)
- `extractMachineInput(mapping)` — reads a machine's input region
- `mergeMachineOutput(v, mapping)` — writes a machine's output region

### PerceptualSpaceSimulator

Manages the 3-phase simulation loop over all registered machines:

**Phase 1 — Snapshot**: For each machine, extract its input region from the current perceptual space into an immutable snapshot. All machines read the *same* pre-step state; no machine's output can influence another machine's input within the same step.

**Phase 2 — Process**: Each machine runs `processInput(snapshot)` against its snapshot. Outputs are collected into a pending list but not yet written.

**Phase 3 — Merge**: All pending outputs are written to their respective output regions in the perceptual space. The post-merge state is the input for the next step.

Two entry points:
- `step()` — uses a pre-configured input sequence, writing only the input region via `updateRegion`
- `processImmediate(vector)` — replaces the full PS with `setPerceptualVector`, then runs the 3-phase loop. Used by the Perception Engine push path.

### Machine

Each machine holds:
- A `Map[String, CriticalEventSequence]` of its CES graphs
- A `PerceptualMapping` with `input: Region` and `output: Region`
- An `OutputArbiter` that decides whether the machine should assert output this step

### CriticalEventSequence (CES)

A directed graph of `RealityVector` nodes. Processing:
1. All currently-active vectors snapshot the input.
2. Each active vector tests its elements against the input using its `ComparatorType`.
3. Matching vectors activate their `nextVectorIds` (deferred to avoid same-cycle cascade).
4. Non-matching, non-initial vectors are cleared.
5. Matching vectors with `outputVectors` contribute to the machine's asserted output.

`isInitial` vectors are never cleared — they are the permanent entry points of the graph.

### Comparator Types

| Type | Semantics |
|---|---|
| `gte` | `inputValue >= elementValue` |
| `equals` | exact equality |
| `threshold` | `|input - value| <= threshold` |

### Output Arbiter

Controls whether a machine's matched output is written to the perceptual space. The arbiter evaluates `shouldOutput` based on the machine's current transition results and metadata.

---

## Perception Engine (Node.js)

### Source Types

| Type | Description |
|---|---|
| `test` | Stepped array of hand-crafted input vectors; advances one step per push; optionally loops |
| `simulated` | Algorithmic waveform (sine, square, sawtooth, random-walk, gaussian-noise, binary, constant) |
| `sensor` | External sensor push target; values expire after `ttlMs` |

### Vector Assembly

`assembleVector()`:
1. Starts from `persistentVector` — the full 256-element PS returned by the Reality Engine after the previous push.
2. For each active source, overwrites only its assigned region with the source's current values.
3. Returns the assembled vector without mutating `persistentVector`.

After a successful push, `updateFromPerceptualSpace(step.perceptualSpace)` advances `persistentVector` to the RE's post-merge state. This ensures machine output regions persist unchanged into the next push unless a source explicitly overwrites them.

### Push Flow

```
assembleVector()
    → POST /api/perceive  (Visualizer Backend)
        → POST /api/perceive  (Reality Engine)
            → processImmediate(vector)
                → 3-phase loop
                → return SimulationStep
        ← { success: true, step: SimulationStep }
    ← broadcast('perceptual-simulation-stepped', step)  [WebSocket → Visualizer Frontend]
← updateFromPerceptualSpace(step.perceptualSpace)
advance()  (test source step indices, walk state, global step counter)
```

### Auto-Push

`POST /api/auto/start { intervalMs }` starts a server-side `setInterval` that calls `doPush()` on the configured cadence. The Tobias Play button uses 600 ms. `POST /api/auto/stop` clears the timer.

---

## Visualizer Backend (Node.js)

Sits between browser clients and the Reality Engine:
- Relays machine management and simulation API calls to the Scala backend
- Maintains a WebSocket server (`/ws`) and broadcasts step results to all connected clients
- `/api/perceive` is the inbound push target for the Perception Engine; forwards to RE and immediately broadcasts the step result

WebSocket message types:
- `perceptual-simulation-stepped` — step result with full PS and machine results
- `perceptual-simulation-reset` — simulation was reset; clear output history

---

## Visualizer Frontend (React)

### Views

| View | Condition | Description |
|---|---|---|
| **Tobias** | `currentView === 'tobias'` | Canvas 2D force-directed machine graph; primary simulation control |
| **Administration** | `currentView === 'administration'` | Full-screen CES graph for a single machine |
| **Interconnection** | `currentView === 'interconnection'` | Graph of machine region overlaps |
| **Selection** | default | Machine library with CRUD operations |

### Tobias Simulation Controls

`useMachineSimulation` hook wires the sidebar buttons to the Perception Engine API via `/api/perception/*` (proxied through the visualizer frontend nginx):

| Button | PE call | Effect |
|---|---|---|
| ▶ Play | `POST /api/perception/auto/start { intervalMs: 600 }` | PE pushes every 600 ms |
| ⏸ Pause | `POST /api/perception/auto/stop` | PE timer stopped |
| ⏭ Single Step | `POST /api/perception/push` | One push immediately |
| ↺ Reset | `POST /api/perception/auto/stop` + `POST /api/perception/reset` + `POST /api/perceptual-simulation/reset` | Clears PE and RE state |

Step results arrive via two paths (deduplicated by `stepNumber`):
1. Immediate REST response from `/api/perception/push` (single step only)
2. WebSocket `perceptual-simulation-stepped` broadcast (all pushes, including auto)

### State Store (`useVisualizerStore`)

Zustand store shared between the Administration and Interconnection views. Manages:
- Machine list and current machine
- CES sequence graphs (refreshed after each step via WebSocket handler)
- Output vectors and highlight state (used by `MachineContainerView` / `CriticalEventGraphView`)
- WebSocket connection lifecycle (`connectWebSocket` / `disconnectWebSocket`)

The Tobias view uses the separate `useMachineSimulation` hook for its simulation state.

---

## TLS Proxy (nginx)

`nginx/tls-proxy.conf` terminates HTTPS/WSS for all external ports and forwards to internal Docker services over plain HTTP. WebSocket locations explicitly set `Upgrade` and `Connection` headers.

| External Port | Internal target | Notes |
|---|---|---|
| 3000 | reality-engine:3000 | REST only |
| 3001 | visualizer-backend:3001 | REST + `/ws` WebSocket |
| 3002 | grafana:3000 | REST only |
| 3004 | perception-engine-backend:3004 | REST + `/ws` WebSocket |
| 3005 | pe-frontend:80 + pe-backend:3004 | `/api` and `/ws` bypass to backend; `/` → frontend |
| 5173 | visualizer-frontend:80 | Static files + `/api/perception/*` → pe-backend + `/api/*` → viz-be + `/ws` → viz-be |

---

## Perceptual Space Layout (example)

The 256 bytes are partitioned by machine perceptual mappings. Example with three machines:

```
Byte  0   3   5   6   8  10           256
      ├───┼───┼───┼───┼──┤  ...  ...  ┤
      │ Multi-Step input  │            │
      │ [0:3]             │            │
      │       RS2 & RSFlip│RS2 out     │
      │       Flop input  │[8:10]      │
      │       [3:5]       │            │
      │           RSFlipFlop out [6:8] │
```

Machine output regions carry forward between steps. A machine that writes `[3:5]` will have its output visible to machines that read `[3:5]` on the next step, because the Perception Engine's persistent base vector preserves all positions not overwritten by a source.
