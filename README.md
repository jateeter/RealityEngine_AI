# Reality Engine

A vector-based state machine system that models reality through observable events and CriticalEventSequence (CES) machines.  Inputs are assembled by the **Perception Engine** from configurable sources (test sequences, simulated waveforms, live sensors, **MQTT brokers**) and pushed into the **Reality Engine**, where registered machines process them through a shared perceptual space (768-element default; grows dynamically to accommodate all machine mappings).

This repo (`RealityEngine_AI`) hosts the **default** runtime — TypeScript on Node.js.  Two sibling implementations provide black-box equivalence on the same JSON corpus:

- [`RealityEngine_CPP`](../RealityEngine_CPP) — native C++ (Boost.Asio/Beast, zero external runtime deps)
- [`RealityEngine_LSP`](../RealityEngine_LSP) — Common Lisp on SBCL (actor model via bordeaux-threads)

All three runtimes share the same `/api/*` surface, machine JSON corpus, governance contracts, MQTT mapping registry, and Prometheus metrics shape.  `startUniverse.sh --re-engine=ai|cpp|lsp` selects which runtime backs the stack.

> Claude Code generated seed version of the Reality Engine (with incremental prompt specification)

---

## Service Access URLs

The AI runtime exposes its services through a TLS-terminating nginx proxy:

| Service | URL | Description |
|---|---|---|
| **Visualizer Frontend** | https://localhost:5173 | Primary web UI — Tobias canvas, machine administration, **Universe Monitor** |
| **Perception Engine UI** | https://localhost:3005 | Source management + live push controls |
| **Grafana Logs** | https://localhost:3002 | Centralized log dashboard (admin / admin) |
| **Reality Engine API** | https://localhost:3000 | TypeScript / Node.js HTTP core engine |
| **Visualizer Backend** | https://localhost:3001 | WebSocket proxy + REST passthrough + MQTT-ingest forwarder |
| **Perception Engine API** | https://localhost:3004 | Source assembly, auto-push, `/api/signals`, **`/api/mqtt/*`** |
| **Qdrant Dashboard** | http://localhost:6333/dashboard | Vector database UI |

CPP and LSP runtimes listen on `3299` (RE) + `3300` (PE) without the TLS proxy.

---

## Quick Start

```bash
# Generate dev TLS certificates (first time only — AI engine path uses HTTPS)
bash certs/generate-dev-certs.sh

# Default: full AI stack (Docker + localAIStack + integration verification)
./startUniverse.sh

# Native C++ runtime (no Docker, no localAIStack — delegates to ../RealityEngine_CPP/start.sh)
./startUniverse.sh --re-engine=cpp --pe-engine=cpp

# Common Lisp runtime
./startUniverse.sh --re-engine=lsp --pe-engine=lsp

# Fresh AI start (wipe perception sources, rebuild images --no-cache)
./startUniverse.sh --fresh

# MQTT-enabled boot (any engine — see "MQTT Integration" below)
./startUniverse.sh --re-engine=cpp \
    --mqtt-broker-url=mqtt://broker:1883 \
    --mqtt-mappings=$PWD/../RealityEngine_CPP/config/mqtt-mappings.yuma-agriculture.json

# Tear down — reads .universe-engine-selection so it knows what to stop
./stopUniverse.sh

# Or explicitly:
./stopUniverse.sh --all                          # tear down every engine
./stopUniverse.sh --re-engine=cpp --pe-engine=ai # stop a mixed-engine deployment
```

| Flag | Values | Default | Behaviour |
|---|---|---|---|
| `--re-engine` | `ai`, `cpp`, `lsp` | `ai` | RE implementation |
| `--pe-engine` | `ai`, `cpp`, `lsp` | `ai` | PE implementation |
| `--fresh` | | — | Wipe AI perception sources + rebuild images without cache |
| `--mqtt-broker-url=URL` | `mqtt://host:port` | — | Enable MQTT ingest on the chosen PE |
| `--mqtt-mappings=PATH` | path to JSON | — | Topic→region mapping registry |

For low-level AI-only operations (without the localAIStack orchestration), `./scripts/start.sh` and `./scripts/start-local.sh` are still available; `./scripts/stop-local.sh` stops the matching local processes.

Browsers will warn about the self-signed certificate — add an exception or use `--ignore-certificate-errors` when running Playwright.

---

## MQTT Integration

Every PE (all three runtimes) can subscribe to an external MQTT broker and project incoming sensor messages into perceptual-space regions via a **mapping registry**.  Per the design rule, topics describe the outside world; the registry decides how that world projects into perceptual space — topic strings never embed offsets.

```bash
# Schema:
#   mqtt-mappings.json
#   ├── defaults: { ttlMs, qos, acceptRetained, pushMode, debounceMs }
#   └── mappings: [
#         { id, topicFilter (+ and # wildcards),
#           sensorIdTemplate ({1}, {2} captures),
#           region: { offset, length },
#           extract: { type: csv-float | json | raw | single-float, pointer?, index? },
#           normalize: { mode: passthrough | minmax | linear | band, min, max, scale, offset, clamp },
#           ttlMs, qos, acceptRetained,
#           pushMode: debounced | manual | immediate, debounceMs } ]

# Boot with the bridge enabled
MQTT_BROKER_URL=mqtt://broker:1883 \
MQTT_MAPPINGS_FILE=$PWD/../RealityEngine_CPP/config/mqtt-mappings.yuma-agriculture.json \
./startUniverse.sh
```

Endpoints exposed by the PE (proxied through the visualizer backend at `/api/perception/*`):

| Endpoint | Returns |
|---|---|
| `GET /api/mqtt/status` | Connection state, bridge counters (received / mapped / rejected / unmatched / pushes triggered), broker config |
| `GET /api/mqtt/mappings` | Loaded registry + per-mapping counters (received, mapped, rejected, lastError) |
| `PUT /api/mqtt/mappings` | Replace the registry + reload the bridge (AI and LSP today; CPP via file restart) |
| `GET /api/sources` | All sensor sources with `ageMs` + `stale` fields per source |

A full live demonstration against the `yuma.lateraledge.cloud:1883` Lateral Edge sensor mesh is documented in [`RealityEngine_CPP/docs/MQTT_YUMA_DEMONSTRATION.md`](../RealityEngine_CPP/docs/MQTT_YUMA_DEMONSTRATION.md) — covers topic discovery, the agriculture-domain mapping file, and the full audit trail from broker payload to Prometheus `ces_paging_decisions_total` counter.

The same Yuma mappings drive the five **AGX051-AGX055 Yuma maintenance machines** in the agriculture domain — these consume the live MQTT-populated sensor regions and produce a maintenance-lens output (URGENT / FORECAST / CALIBRATE / NORMAL) distinct from the operational-stability machines (AGX001/005/026/032) that read the same regions.  AGX055 then projects all four maintenance outputs onto `AgYieldOptimizationAI`'s input window at `[3959:3971]`, completing the path **live broker → CES machines → cross-domain yield AI**.  See [`docs/AGRICULTURE_INTERCONNECTIONS.md`](docs/AGRICULTURE_INTERCONNECTIONS.md) for the full chain diagram and regenerate with `python3 scripts/generate_yuma_mqtt_maintenance_machines.py`.

---

## Universe Monitor

A dedicated visualizer view (`Universe` button on the selection screen, or `currentView === 'universe'`) provides the operator window onto the full PE→RE→CES→governance pipeline:

- **MQTT Bridge** panel — connection state badge, bridge counters, per-mapping table with `Edit Mappings` button (opens an inline JSON editor that PUTs back to the PE and reloads the bridge in <100 ms).
- **Live MQTT Ingest** stream — WebSocket-driven (`mqtt-ingest` events forwarded by the visualizer backend from the PE's WS); shows every accepted PUBLISH with timestamp, sensor id, topic, region, and decoded values.  Rows fade older toward the bottom.
- **Sensor Sources** panel — every PE sensor source with a freshness badge (FRESH / AGING / STALE / IDLE), derived from `lastUpdated` + `ttlMs` server-side.
- **Paging Decisions** ticker — RAG-coloured table of resolved governance contracts, parsed from the RE's Prometheus `ces_paging_decisions_total` counter by the visualizer backend.
- **Trigger Push** button — manual `POST /api/perception/push` for ad-hoc verification.

---

## Architecture

The system runs as eight Docker services connected on a private `reality-network` (Qdrant and Redis run externally via localAIStack):

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
│ (Node.js / TS)   │    │  :6333   │   │  :3100  │
│ :3000            │    └──────────┘   └────────┬┘
└──────────────────┘                            │
                                     ┌──────────▼──────┐
                                     │  Grafana :3002  │
                                     └─────────────────┘
```

### Data flow

1. **Perception Engine** assembles a vector from its configured sources (test sequences, simulated signals, or live sensors) and writes each source into its assigned region of the shared perceptual space.
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

A named collection of CriticalEventSequences with a **perceptual mapping** — `inputRegion` and `outputRegion` — that defines which elements of the shared perceptual space the machine reads from and writes to.

### Perceptual Space

A shared vector (768 elements by default; grows to the highest machine mapping offset + length). All machines snapshot their input region, process concurrently, then merge their outputs in a single atomic phase. Sources outside a machine's assigned regions are unaffected.

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

Machines are defined as JSON files in `examples/machines/`.  Every `*.json` in
that directory is **auto-loaded at engine startup** by all three runtimes
(TS `src/services/MachineLoader.ts`, C++ `load_machines_from_directory`, LSP
`load-machines-from-directory`), so adding a new file and restarting the
stack is all that's needed — no allowlist to edit.

The generated example corpus currently contains `1009` startup-loadable machines
across `11` active domains. The searchable index is generated at
[`docs/EXAMPLE_DOMAIN_COMPENDIUM.md`](docs/EXAMPLE_DOMAIN_COMPENDIUM.md), and
the current packed domain/bridge layout is documented in
[`docs/DOMAIN_PERCEPTUAL_SPACE_REMAP.md`](docs/DOMAIN_PERCEPTUAL_SPACE_REMAP.md).
The community-services domain now includes `102` machines, including `90`
generated examples for health and human services, law enforcement/public safety,
homelessness response, city operations, and bridge interconnects to
health-services and transportation.
The life-balance domain adds `100` machines for lifestyle-psychiatry workflow
tracking, projection, and automation across intake, nutrition, sleep, movement,
stress resilience, psychiatric care, adolescent/family support, monitoring, and
care-team escalation.

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
| `docs/README.md` | Maintained documentation index |
| `ARCHITECTURE.md` | Visual service architecture and data flow |
| `API_ENDPOINTS_GUIDE.md` | Complete REST and WebSocket API reference |
| `PERCEPTUAL_SPACE_ARCHITECTURE.md` | Dynamic perceptual-space model |
| `docs/EXAMPLE_DOMAIN_COMPENDIUM.md` | Generated searchable compendium of all active domains, machines, triggers, mappings, and interconnections |
| `docs/ACRONYMS.md` | Acronym definitions |
| `docs/BIBLIOGRAPHY.md` | External and project references |
| `RS_FLIP_FLOP.md` | RS flip-flop machine example walkthrough |
| `NAND-GATE-PROOF.md` | NAND gate logical proof using CES machines |
| `ARBITER_ARCHITECTURE.md` | Output arbiter and shouldOutput semantics |
| `E2E_TESTING.md` | E2E test configuration and CI setup |
| `LOKI_GRAFANA_SETUP.md` | Centralized logging with Loki and Grafana |
| `DOCKER_QUICKSTART.md` | Docker commands and service health checks |

---

MIT License
