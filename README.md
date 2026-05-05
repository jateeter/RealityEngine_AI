# Reality Engine

A vector-based state machine system that models reality through observable events and CriticalEventSequence (CES) machines. Inputs are assembled by the **Perception Engine** from configurable sources and pushed into the **Reality Engine**, where registered machines process them through a shared 256-byte perceptual space.

> Claude Code generated seed version of the Reality Engine (with incremental prompt specification)

---

## Service Access URLs

All services are exposed via a TLS-terminating nginx proxy. Start the stack, then open:

| Service | URL | Description |
|---|---|---|
| **Visualizer Frontend** | https://localhost:5173 | Primary web UI (Tobias canvas view, machine administration) |
| **Perception Engine UI** | https://localhost:3005 | Source management and live push controls |
| **Grafana Logs** | https://localhost:3002 | Centralized log dashboard (admin / admin) |
| **Reality Engine API** | https://localhost:3000 | Scala/Akka HTTP core engine |
| **Visualizer Backend** | https://localhost:3001 | WebSocket proxy and REST passthrough |
| **Perception Engine API** | https://localhost:3004 | Source assembly, auto-push, and perceive endpoint |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | Vector database UI |

---

## Quick Start

```bash
# Generate dev TLS certificates (first time only)
bash certs/generate-dev-certs.sh

# Start the full universe (localAIStack + Reality Engine + integration verify)
./startUniverse.sh

# Or start fresh (wipe perception sources, rebuild RE images with --no-cache)
./startUniverse.sh --fresh

# Stop all services
./scripts/stop.sh
```

`startUniverse.sh` is the recommended entry point — it brings up Ollama, localAIStack (Qdrant + Redis + API), and all Reality Engine services, then verifies machine/sensor/Qdrant integration.

If localAIStack is already running and you only need to (re)start Reality Engine services, use `./scripts/start.sh` instead.

Browsers will warn about the self-signed certificate — add an exception or use `--ignore-certificate-errors` when running Playwright.

---

## Architecture

The system runs as nine Docker services connected on a private `reality-network`:

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser / Playwright                         │
└───────────┬──────────────────────┬─────────────────────────────────┘
            │ HTTPS                │ HTTPS
            ▼                      ▼
┌───────────────────┐   ┌──────────────────────┐
│  TLS Proxy (nginx)│   │  TLS Proxy (nginx)   │
│  :5173 → viz-fe   │   │  :3005 → pe-fe       │
│  :3001 → viz-be   │   │  :3004 → pe-be       │
│  :3002 → grafana  │   │  :3000 → reality-eng │
└─────────┬─────────┘   └──────────┬───────────┘
          │ HTTP (internal)         │ HTTP (internal)
          ▼                         ▼
┌──────────────────┐    ┌───────────────────────┐
│ Visualizer       │    │ Perception Engine      │
│ Backend :3001    │◄───│ Backend :3004          │
│ (WebSocket + proxy)   │ (source assembly,      │
└────────┬─────────┘    │  auto-push timer)      │
         │ HTTP          └───────────────────────┘
         ▼
┌──────────────────┐    ┌──────────┐   ┌─────────┐
│ Reality Engine   │───►│  Qdrant  │   │  Loki   │
│ (Scala/Akka)     │    │  :6333   │   │  :3100  │
│ :3000            │    └──────────┘   └────────┬┘
└──────────────────┘                            │
                                     ┌──────────▼──────┐
                                     │  Grafana :3002  │
                                     └─────────────────┘
```

### Data flow

1. **Perception Engine** assembles a 256-element vector from its configured sources (test sequences, simulated signals, or live sensors).
2. It posts the vector to **Visualizer Backend** `/api/perceive`, which forwards it to **Reality Engine** `/api/perceive`.
3. The Reality Engine runs a 3-phase snapshot → process → merge loop over all registered machines, writing machine outputs back into the shared perceptual space.
4. The Visualizer Backend broadcasts `perceptual-simulation-stepped` to all WebSocket clients.
5. The **Visualizer Frontend** receives the broadcast and updates the Tobias canvas and output history.

The perceptual space is **persistent**: machine output regions carry forward unchanged into the next push unless a source explicitly overwrites them. This enables multi-machine feedback loops (e.g. an RS flip-flop whose Q output is observed by downstream machines).

---

## Core Concepts

### RealityVector

A 1×n element vector representing a state in reality. Each element has a value and a comparator (`gte`, `equals`, `threshold`). Vectors are chained via `nextVectorIds` to form directed state graphs.

### CriticalEventSequence (CES)

A directed graph of RealityVectors. Requires at least one `isInitial` vector (always active) and at least one vector with an `outputVector`. When the terminal vector matches, the machine asserts its output into the perceptual space.

### Machine

A named collection of CriticalEventSequences with a **perceptual mapping** — `inputRegion` and `outputRegion` — that defines which bytes of the 256-element shared perceptual space the machine reads from and writes to.

### Perceptual Space

A 256-byte shared vector. All machines snapshot their input region, process concurrently, then merge their outputs in a single atomic phase. Sources outside a machine's assigned regions are unaffected.

### Perception Engine

Manages **sources** (test sequences, simulated waveforms, live sensors) and assembles them into the next push vector. Supports:
- **Single step** — push one assembled vector manually
- **Auto-push** — push on a configurable timer (default 600 ms)
- **Persistent base** — starts each push from the previous step's full PS so machine outputs survive between pushes

---

## Visualizer Views

### Tobias (Canvas 2D)
Primary simulation view. Shows all registered machines as force-directed cards with internal CES graphs. Controls:
- **▶ Play / ⏸ Pause** — starts/stops Perception Engine auto-push
- **⏭ Single Step** — pushes one vector immediately
- **↺ Reset** — clears PE step counter and RE simulation state
- **📑 Sequences** — open the input sequence builder panel

### Machine Administration
Full-screen CES graph for a single machine. Connected to the visualizer backend WebSocket; highlights active nodes in real time as steps arrive.

### Machine Interconnection
Graph showing all machines and their perceptual space region overlaps (edges indicate one machine's output region overlaps another's input region).

---

## Machine JSON Files

Machines are defined as JSON files in `examples/machines/`. Every `*.json` in
that directory is **auto-loaded at engine startup** (see
`scala/.../Routes.scala::loadDefaultMachines`), so adding a new file and
restarting the stack is all that's needed — no allowlist to edit.

The generated example corpus currently contains `906` startup-loadable machines
across `10` active domains. The searchable index is generated at
[`docs/EXAMPLE_DOMAIN_COMPENDIUM.md`](docs/EXAMPLE_DOMAIN_COMPENDIUM.md), and
the current packed domain/bridge layout is documented in
[`docs/DOMAIN_PERCEPTUAL_SPACE_REMAP.md`](docs/DOMAIN_PERCEPTUAL_SPACE_REMAP.md).
The community-services domain now includes `102` machines, including `90`
generated examples for health and human services, law enforcement/public safety,
homelessness response, city operations, and bridge interconnects to
health-services and transportation.

```bash
# Via API
curl -sk https://localhost:3000/api/machines/json/RS2

# Via Tobias → Sequences → (load a machine)
```

Machine JSON format: see `data/rs-flipflop.json` for a complete example.

### Upstream triggers (machine → local AI)

Any machine can carry a `metadata.triggerConfig` block mapping sequence
outputs to RAG status codes.  When the machine asserts that output, a
GraphQL mutation is pushed into the local AI stack's `/graphql` endpoint
(see `examples/triggers/` for the template and `localAIStack/services/api/
routers/graphql_endpoint.py` for the receiver).

The following in-home wellness machines ship pre-wired with triggers:

- `MedicationAdherenceMonitor.json`
- `FallDetection.json`
- `SleepQualityMonitor.json`
- `HydrationMonitor.json`
- `DailyActivityMonitor.json`

Plus the minimal example `RSFlipFlopTrigger.json` for smoke-testing.

---

## Configuration

### Environment (`.env` / docker-compose)

| Variable | Service | Default | Description |
|---|---|---|---|
| `PORT` | Reality Engine | 3000 | HTTP listen port |
| `VIZ_PORT` | Visualizer Backend | 3001 | HTTP listen port |
| `REALITY_ENGINE_URL` | Visualizer Backend, PE | http://reality-engine:3000 | Internal RE address |
| `PERCEPTION_TARGET_URL` | Perception Engine | http://visualizer-backend:3001 | Where PE pushes vectors |
| `DATA_PATH` | Perception Engine | /app/data | Source persistence directory |

### TLS Proxy

`nginx/tls-proxy.conf` — terminates HTTPS/WSS for all external ports. Dev certificates live in `certs/`. Regenerate with `bash certs/generate-dev-certs.sh`.

---

## E2E Testing

```bash
# Install Playwright browsers (first time)
npx playwright install chromium

# Run all tests against the running stack
npx playwright test --project=chromium

# Run with headed browser
npx playwright test --headed
```

Tests live in `e2e/tests/`. See `E2E_TESTING.md` for full configuration.

---

## Logging

All containers forward logs to **Loki** via the Docker Loki log driver. View in Grafana at https://localhost:3002.

```logql
# All services
{app="reality-engine"}

# Specific service
{app="reality-engine", service="perception-engine-backend"}

# Errors only
{app="reality-engine"} |~ "(?i)error"
```

See `LOKI_GRAFANA_SETUP.md` for dashboard and alerting configuration.

---

## Key Reference Docs

| Doc | Description |
|---|---|
| `ARCHITECTURE.md` | Detailed Scala engine and perceptual space internals |
| `API_ENDPOINTS_GUIDE.md` | Complete REST and WebSocket API reference |
| `PERCEPTUAL_SPACE_ARCHITECTURE.md` | 256-byte space layout and machine interconnection model |
| `docs/EXAMPLE_DOMAIN_COMPENDIUM.md` | Generated searchable compendium of all active domains, machines, triggers, mappings, and interconnections |
| `RS_FLIP_FLOP.md` | RS flip-flop machine example walkthrough |
| `NAND-GATE-PROOF.md` | NAND gate logical proof using CES machines |
| `ARBITER_ARCHITECTURE.md` | Output arbiter and shouldOutput semantics |
| `E2E_TESTING.md` | E2E test configuration and CI setup |
| `LOKI_GRAFANA_SETUP.md` | Centralized logging with Loki and Grafana |
| `DOCKER_QUICKSTART.md` | Docker commands and service health checks |

---

MIT License
