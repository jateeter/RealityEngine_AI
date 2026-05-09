#!/bin/bash
# =============================================================================
# startUniverse.sh — Unified startup: localAIStack + RealityEngine AI
#
# Startup order (dependency-safe):
#   1  Pre-flight     — docker compose v2, certs, orphaned container cleanup
#   2  Ollama         — native LLM runtime
#   3  Infrastructure — RE Loki + localAIStack Qdrant + Redis
#   4  RealityEngine  — Scala/Akka stack (consumes Qdrant at :4333)
#   5  localAIStack API — FastAPI lifespan hooks register sensors + machines in RE
#   6  Integration    — verify machines, sensors, and Qdrant collections (with retry)
#   7  Operability    — live smoke-tests: perceive, RAG health, sensor write path
#   8  Summary
#
# Usage:  ./startUniverse.sh [--fresh]
#   --fresh  Wipe perception sources and rebuild all images without cache
# =============================================================================
set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RE_DIR="$SCRIPT_DIR"
LAS_DIR="$SCRIPT_DIR/../localAIStack"

# ── flags ──────────────────────────────────────────────────────────────────
FRESH_START=false
for arg in "$@"; do [ "$arg" = "--fresh" ] && FRESH_START=true; done

# ── colours ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $*"; }
info() { echo -e "${YELLOW}ℹ${NC} $*"; }
warn() { echo -e "${RED}⚠${NC} $*"; }
hdr()  { echo -e "\n${CYAN}${BOLD}─── $* ───${NC}"; }
die()  { echo -e "\n${RED}✗  FATAL:${NC} $*\n"; exit 1; }

WARNS=()
add_warn() { WARNS+=("$*"); }

# ── poll_http <url> <label> <max_tries> <curl_flags> ───────────────────────
# Returns 0 on first success, 1 on timeout.  Dots shown while waiting.
poll_http() {
    local url="$1" label="$2" max="${3:-30}" flags="${4:--sf}"
    local n=0
    while [ "$n" -lt "$max" ]; do
        if curl $flags "$url" > /dev/null 2>&1; then
            ok "$label"
            return 0
        fi
        n=$((n+1)); echo -n "."; sleep 2
    done
    echo ""; return 1
}

# =============================================================================
hdr "1 · Pre-flight"
# =============================================================================

# docker compose v2 is required for --wait, BuildKit integration, and --force-recreate
docker compose version > /dev/null 2>&1 || \
    die "docker compose (v2) not found.  Install Docker Desktop >= 3.x or the compose plugin."
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "unknown")
ok "docker compose v$COMPOSE_VER"

[ -d "$LAS_DIR" ] || \
    die "localAIStack not found at $LAS_DIR\n  Clone it alongside RealityEngine_AI and retry."

docker info > /dev/null 2>&1 || die "Docker daemon is not running — start Docker Desktop first"
ok "Docker daemon reachable"

[ -f "$RE_DIR/.env" ] || die ".env not found — run scripts/setup.sh first"
# shellcheck source=/dev/null
source "$RE_DIR/.env"

# TLS certificates (required by all RE HTTPS services)
MISSING_CERTS=""
for f in certs/server.crt certs/server.key certs/ca.crt certs/keystore.p12; do
    [ ! -f "$RE_DIR/$f" ] && MISSING_CERTS="$MISSING_CERTS $f"
done
[ -n "$MISSING_CERTS" ] && \
    die "Missing TLS cert(s):$MISSING_CERTS\n  Run:  bash $RE_DIR/certs/generate-dev-certs.sh"
openssl x509 -in "$RE_DIR/certs/server.crt" -noout -text 2>/dev/null \
    | grep -q "DNS:reality-engine" || \
    die "certs/server.crt is missing SANs\n  Run:  bash $RE_DIR/certs/generate-dev-certs.sh"
ok "TLS certificates valid"

# Loki Docker logging driver (required by all RE compose services)
# docker plugin ls grep only checks presence, not ENABLED state — use inspect instead.
LOKI_ENABLED=$(docker plugin inspect loki --format '{{.Enabled}}' 2>/dev/null || echo "missing")
if [ "$LOKI_ENABLED" = "missing" ]; then
    info "Installing Loki Docker logging driver..."
    docker plugin install grafana/loki-docker-driver:latest \
        --alias loki --grant-all-permissions 2>/dev/null || \
        die "Loki Docker driver installation failed\n  Run manually:  bash $RE_DIR/scripts/setup-loki-driver.sh"
elif [ "$LOKI_ENABLED" = "false" ]; then
    info "Enabling Loki Docker logging driver (was installed but disabled)..."
    docker plugin enable loki 2>/dev/null || \
        die "Loki Docker driver could not be enabled\n  Run manually:  docker plugin enable loki"
fi
ok "Loki Docker logging driver installed and enabled"

# Block if local node processes hold RE ports (Docker would conflict)
CONFLICTS=""
for port in 3000 3001 3004 3005 5173; do
    proc=$(lsof -i ":$port" 2>/dev/null | awk '/LISTEN/{print $1}' | head -1 || true)
    [ "$proc" = "node" ] && CONFLICTS="$CONFLICTS ${port}(node)"
done
[ -n "$CONFLICTS" ] && \
    die "Local node processes on RE ports:$CONFLICTS\n  Stop them with:  ./scripts/stop-local.sh"
ok "No port conflicts"

# ── Orphaned container cleanup ─────────────────────────────────────────────
# docker compose down only removes containers tracked by the compose project.
# Containers from `docker compose run`, previous builds, or renamed projects
# (e.g. lucid_gould from an earlier manual run) must be removed explicitly.
info "Checking for orphaned containers..."

# Remove containers managed by the compose project first
(cd "$RE_DIR" && docker compose down 2>/dev/null) || true

# Remove any remaining containers using RE images by image name pattern
ORPHANS=$(docker ps -a --format "{{.ID}} {{.Image}}" 2>/dev/null \
    | awk '/realityengine_ai-|realityengine-/{print $1}' || true)
if [ -n "$ORPHANS" ]; then
    # shellcheck disable=SC2086
    docker rm -f $ORPHANS > /dev/null 2>&1 || true
fi

# Also sweep named RE containers that may have survived
docker rm -f \
    reality-engine-app \
    reality-engine-visualizer-backend \
    reality-engine-visualizer-frontend \
    reality-engine-perception-backend \
    reality-engine-perception-frontend \
    reality-engine-tls-proxy \
    reality-engine-loki \
    reality-engine-grafana > /dev/null 2>&1 || true

REMAINING=$(docker ps -a --format "{{.Names}}" 2>/dev/null \
    | grep -c "reality-engine-" || true)
if [ "$REMAINING" -gt 0 ]; then
    warn "Some RE containers could not be removed — they may cause startup conflicts"
    add_warn "$REMAINING RE container(s) still present before startup"
else
    ok "RE container state clean"
fi

# Settle time for Docker Desktop VirtioFS file-lock release after container removal
sleep 2

if [ "$FRESH_START" = true ]; then
    echo ""
    warn "Fresh start — perception source data will be wiped; all images rebuilt without cache"
fi

# =============================================================================
hdr "2 · Ollama"
# =============================================================================

if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
    ok "Ollama already running"
else
    info "Starting Ollama..."
    ollama serve > /tmp/ollama_universe.log 2>&1 &
    echo $! > /tmp/ollama_universe.pid
    info "Waiting for Ollama..."
    poll_http "http://localhost:11434/api/tags" "Ollama ready" 30 "-sf" || \
        die "Ollama failed to start\n  Log:  /tmp/ollama_universe.log"
fi

# Inventory models; warn on missing required ones.
# Embedding model comes from localAIStack/.env (EMBED_MODEL); fall back to ternary-bonsai:4.
set +e
TAGS_JSON=$(curl -sf http://localhost:11434/api/tags 2>/dev/null || echo '{"models":[]}')
EMBED_MODEL_REQUIRED="${EMBED_MODEL:-}"
if [ -z "$EMBED_MODEL_REQUIRED" ] && [ -f "$LAS_DIR/.env" ]; then
    EMBED_MODEL_REQUIRED=$(grep -E '^EMBED_MODEL=' "$LAS_DIR/.env" | tail -1 | cut -d= -f2-)
fi
EMBED_MODEL_REQUIRED="${EMBED_MODEL_REQUIRED:-ternary-bonsai:4}"
set -e
for model in "llama3" "$EMBED_MODEL_REQUIRED"; do
    MATCH=$(echo "$TAGS_JSON" | python3 -c \
        "import json,sys
ms=[m['name'] for m in json.load(sys.stdin).get('models',[]) if '$model' in m['name']]
print(ms[0] if ms else '')" 2>/dev/null || echo "")
    if [ -n "$MATCH" ]; then
        ok "Model: $MATCH"
    else
        add_warn "Ollama model '$model' not found — pull with:  ollama pull $model"
        warn "Model not found: $model (RAG/embeddings may fail)"
    fi
done

# =============================================================================
hdr "3 · Infrastructure  (RE Loki + Qdrant + Redis)"
# =============================================================================

# --fresh: clear RE perception volume before containers start
if [ "$FRESH_START" = true ]; then
    PERCEPTION_VOL=$(docker volume ls --format "{{.Name}}" \
        | grep "_perception_sources_data$" | head -1 || true)
    if [ -n "$PERCEPTION_VOL" ]; then
        info "Removing perception sources volume: $PERCEPTION_VOL"
        docker volume rm "$PERCEPTION_VOL" > /dev/null 2>&1 || true
        ok "Perception source data cleared"
    else
        info "No perception sources volume found (already clean)"
    fi
fi

info "Starting Loki (RE) + Qdrant + Redis..."
# Loki lives in RE's compose and must start before RE containers because their
# Docker logging driver pushes to https://localhost:3100/loki/api/v1/push.
# Grafana depends on Loki and will start with the rest of RE in Phase 4.
# stderr captured so die() can surface the first failure lines.
(cd "$RE_DIR"  && docker compose up -d loki \
    2>/tmp/infra_start_err.log) > /dev/null || \
    die "docker compose up failed for Loki\n$(tail -5 /tmp/infra_start_err.log 2>/dev/null)\n  Run manually:  cd $RE_DIR && docker compose up loki"
(cd "$LAS_DIR" && docker compose up -d qdrant redis \
    2>>/tmp/infra_start_err.log) > /dev/null || \
    die "docker compose up failed for Qdrant/Redis\n$(tail -5 /tmp/infra_start_err.log 2>/dev/null)\n  Run manually:  cd $LAS_DIR && docker compose up qdrant redis"

# Loki: wait for /ready  (HTTPS on port 3100; -k skips self-signed cert check)
info "Waiting for Loki..."
poll_http "https://localhost:3100/ready" "Loki ready" 30 "-skf" || \
    die "Loki failed to start\n  Check:  docker logs reality-engine-loki"

# Grafana (reality-engine-grafana) has no direct host port — it is only reachable
# through the TLS proxy at https://localhost:3002 after Phase 4 completes.
# Startup is verified by the compose healthcheck in Phase 4 --wait.
info "Grafana will be verified via TLS proxy in Phase 4 (no direct host port)"

# Qdrant: wait for REST API to accept connections
info "Waiting for Qdrant..."
poll_http "http://localhost:4333/collections" "Qdrant ready" 30 "-sf" || \
    die "Qdrant failed to start\n  Check:  docker logs localai_qdrant"

# Redis: wait for PONG
info "Waiting for Redis..."
n=0
while [ "$n" -lt 20 ]; do
    if docker exec localai_redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        ok "Redis ready"; break
    fi
    n=$((n+1)); echo -n "."; sleep 2
done
echo ""
[ "$n" -ge 20 ] && die "Redis failed to start\n  Check:  docker logs localai_redis"

# =============================================================================
hdr "4 · RealityEngine"
# =============================================================================

cd "$RE_DIR"

# Isolated BuildKit builder — prevents VirtioFS deadlocks on macOS Docker Desktop
# that manifest as hangs at "load .dockerignore" / "load build definition"
BUILDER="reality-engine-builder"
if ! docker buildx inspect "$BUILDER" > /dev/null 2>&1; then
    info "Creating isolated BuildKit builder (one-time setup)..."
    docker buildx create --name "$BUILDER" --driver docker-container \
        --bootstrap > /dev/null 2>&1 || \
        die "BuildKit builder creation failed — check Docker Desktop is healthy"
    ok "BuildKit builder created"
else
    ok "BuildKit builder ready ($BUILDER)"
fi
docker buildx use "$BUILDER" > /dev/null 2>&1

if [ "$FRESH_START" = true ]; then
    info "Building RE images (no cache — sbt deps served from BuildKit cache mounts)..."
    docker compose build --no-cache || \
        die "RE image build failed (no-cache)\n  Run:  docker compose build --no-cache"
else
    info "Building RE images (cached)..."
    docker compose build || \
        die "RE image build failed\n  Run:  docker compose build  (or --no-cache to force rebuild)"
fi

docker buildx use default > /dev/null 2>&1 || true

# Start all RE services and block until every healthcheck passes.
# --wait-timeout 360: Scala JVM cold-start + sbt is slow; 6 min is conservative.
# Startup order enforced by depends_on conditions in docker-compose.yml:
#   Loki → RE/Visualizer/Perception → tls-proxy
info "Starting RE services (waiting for all healthchecks)..."
docker compose up -d --wait --wait-timeout 360 || \
    die "RE services failed to reach healthy state within 6 minutes\n  Check:  docker compose logs"
ok "All RE services healthy"

# tls-proxy healthcheck is nginx -t (config validation only).
# Do a short host-level poll to confirm external port bindings are live.
info "Confirming RE external endpoints..."
echo -n "  API "
poll_http "https://localhost:3000/api/health" "RE API reachable" 15 "-skf" || {
    add_warn "RE API not reachable on https://localhost:3000 after startup"
    warn "RE API endpoint not responding — TLS proxy may still be binding"
}
echo -n "  PE  "
poll_http "https://localhost:3004/api/health" "PE Backend reachable" 15 "-skf" || {
    add_warn "Perception Engine not reachable on https://localhost:3004 after startup"
    warn "PE endpoint not responding"
}

# Baseline source count (pre-integration)
set +e
PE_SRC_COUNT=$(curl -sk https://localhost:3004/api/sources 2>/dev/null \
    | python3 -c \
        "import json,sys; print(len(json.load(sys.stdin).get('sources',[])))" \
        2>/dev/null || echo "?")
RE_MACHINE_COUNT=$(curl -sk https://localhost:3000/api/machines 2>/dev/null \
    | python3 -c \
        "import json,sys; print(len(json.load(sys.stdin).get('machines',[])))" \
        2>/dev/null || echo "?")
set -e
ok "RE baseline: $RE_MACHINE_COUNT machines, $PE_SRC_COUNT PE sources"

# =============================================================================
hdr "5 · localAIStack API"
# =============================================================================

# --force-recreate ensures the FastAPI lifespan hooks always re-fire against
# the now-live RealityEngine.  Hooks registered:
#   register_sensors()        → PE sensor sources at [64:72]
#   import_machine_if_missing → rag_corrective_cycle machine in RE
#   import_session_machines() → session_rag_context / session_agent_context in RE
#   bind_graph_topology()     → per-node topology sensors + machines

info "Building localAIStack API image..."
# --build ensures image rebuilds when services/api/requirements.txt or the
# Dockerfile change (e.g. when strawberry-graphql is added); cache hits keep
# this near-instant when nothing moved.
(cd "$LAS_DIR" && docker compose build api 2>&1) | tail -5
info "Starting localAIStack API (lifespan hooks will register integration)..."
# --wait on 'api' only: open-webui has no healthcheck and --wait would block.
(cd "$LAS_DIR" && docker compose up -d --force-recreate --wait \
    --wait-timeout 120 api 2>&1) || \
    die "localAIStack API failed to reach healthy state\n  Check:  docker logs localai_api"

# Start open-webui detached without waiting (no healthcheck defined)
(cd "$LAS_DIR" && docker compose up -d open-webui) > /dev/null 2>&1 || true

ok "localAIStack API ready"

# Report per-service health from /health endpoint
set +e
HEALTH_JSON=$(curl -sf http://localhost:4000/health 2>/dev/null || echo '{}')
echo "$HEALTH_JSON" | python3 -c "
import json, sys
h = json.load(sys.stdin).get('services', {})
for k, v in h.items():
    if k == 'ollama_models':
        models = ', '.join(v) if v else 'none'
        print(f'  ℹ  models    : {models}')
    else:
        icon = '✓' if v == 'ok' else '⚠'
        print(f'  {icon}  {k:<10}: {v}')
" 2>/dev/null || true
set -e

# =============================================================================
hdr "6 · Integration Verification"
# =============================================================================
# The lifespan hooks are async and may still be completing.  Retry up to 3 times
# with a 15s pause so transient startup races don't produce false failures.

set +e

VERIFY_PASS=false
for attempt in 1 2 3; do
    [ "$attempt" -gt 1 ] && { info "Retry $attempt/3 — waiting 15s for hooks to complete..."; sleep 15; }

    RE_MACHINES=$(curl -sk https://localhost:3000/api/machines 2>/dev/null \
        || echo '{"machines":[]}')
    MACHINE_LABELS=$(echo "$RE_MACHINES" | python3 -c "
import json, sys
ms = json.load(sys.stdin).get('machines', [])
for m in ms: print(m.get('id','') + ' ' + m.get('name',''))
" 2>/dev/null || echo "")

    PE_SOURCES=$(curl -sk https://localhost:3004/api/sources 2>/dev/null \
        || echo '{"sources":[]}')
    SENSOR_COUNT=$(echo "$PE_SOURCES" | python3 -c "
import json, sys
print(len([s for s in json.load(sys.stdin).get('sources',[]) if s.get('type')=='sensor']))
" 2>/dev/null || echo "0")

    HAS_RAG=$(echo "$MACHINE_LABELS" | grep -qi "rag.*corrective\|corrective.*rag" && echo true || echo false)
    HAS_SESS_RAG=$(echo "$MACHINE_LABELS" | grep -qi "session.*rag\|rag.*session" && echo true || echo false)
    HAS_SESS_AGT=$(echo "$MACHINE_LABELS" | grep -qi "session.*agent\|agent.*session" && echo true || echo false)
    HAS_SENSORS=$([ "$SENSOR_COUNT" -gt 0 ] && echo true || echo false)

    if [ "$HAS_RAG" = "true" ] && [ "$HAS_SESS_RAG" = "true" ] && \
       [ "$HAS_SESS_AGT" = "true" ] && [ "$HAS_SENSORS" = "true" ]; then
        VERIFY_PASS=true
        break
    fi
done

# ── RE machines ────────────────────────────────────────────────────────────
info "RE machine registrations..."
TOTAL_MACHINES=$(echo "$RE_MACHINES" | python3 -c \
    "import json,sys; print(len(json.load(sys.stdin).get('machines',[])))" \
    2>/dev/null || echo "0")

if [ "$HAS_RAG" = "true" ]; then
    ok "Machine registered: rag_corrective_cycle"
else
    add_warn "rag_corrective_cycle machine not in RE — RAG routing decisions will not flow into perceptual space"
    warn "Machine NOT registered: rag_corrective_cycle"
fi
if [ "$HAS_SESS_RAG" = "true" ]; then
    ok "Machine registered: session_rag_context"
else
    add_warn "session_rag_context machine not in RE — session state carry will not work"
    warn "Machine NOT registered: session_rag_context"
fi
if [ "$HAS_SESS_AGT" = "true" ]; then
    ok "Machine registered: session_agent_context"
else
    add_warn "session_agent_context machine not in RE — agent session carry will not work"
    warn "Machine NOT registered: session_agent_context"
fi
ok "Total machines in RE: $TOTAL_MACHINES"

# ── PE sensor sources ──────────────────────────────────────────────────────
info "PE sensor registrations..."
if [ "$HAS_SENSORS" = "true" ]; then
    ok "Sensor sources registered: $SENSOR_COUNT"
    echo "$PE_SOURCES" | python3 -c "
import json, sys
for s in json.load(sys.stdin).get('sources', []):
    if s.get('type') == 'sensor':
        r = s.get('region', {})
        print(f\"  sensor  [{r.get('offset','?')}:{r.get('length','?')}]  {s['name']}\")
" 2>/dev/null || true
else
    add_warn "No sensor sources in PE — localAIStack lifespan hooks may have failed (docker logs localai_api)"
    warn "No sensor sources registered in PE"
fi

# Verify the RAG signal regions [64:72] are covered
RAG_COVERED=$(echo "$PE_SOURCES" | python3 -c "
import json, sys
offsets=[s.get('region',{}).get('offset') for s in json.load(sys.stdin).get('sources',[]) if s.get('type')=='sensor']
print('true' if 64 in offsets or 68 in offsets else 'false')
" 2>/dev/null || echo "false")
if [ "$RAG_COVERED" = "true" ]; then
    ok "RAG signal regions [64:72] mapped"
else
    add_warn "RAG signal regions [64:72] not mapped — RAG routing will not update perceptual state"
    warn "RAG signal regions [64:72] not found in sensor sources"
fi

# ── Qdrant collections ─────────────────────────────────────────────────────
info "Qdrant collections..."
QDRANT_COLLS=$(curl -sf http://localhost:4333/collections 2>/dev/null || echo '{}')
COLL_LIST=$(echo "$QDRANT_COLLS" | python3 -c \
    "import json,sys; print([c['name'] for c in json.load(sys.stdin).get('result',{}).get('collections',[])])" \
    2>/dev/null || echo "[]")

for coll in "localai_docs" "reality-vectors"; do
    if echo "$COLL_LIST" | grep -q "$coll"; then
        ok "Qdrant collection: $coll"
    else
        add_warn "Qdrant collection '$coll' not yet created (auto-created on first use)"
        info "Qdrant '$coll': will be created on first document ingest / perceive call"
    fi
done

if [ "$VERIFY_PASS" = "false" ]; then
    add_warn "Integration hooks did not complete within 3 attempts — run:  (cd $LAS_DIR && docker compose restart api)"
fi

set -e

# =============================================================================
hdr "7 · Operability"
# =============================================================================

set +e

# ── RE perceive smoke-test ─────────────────────────────────────────────────
info "RE perceive smoke-test (768-element zero vector)..."
ZERO_VEC=$(python3 -c "import json; print(json.dumps([0.0]*768))" 2>/dev/null || echo "")
if [ -n "$ZERO_VEC" ]; then
    PERCEIVE_RESP=$(curl -sk -X POST https://localhost:3000/api/perceive \
        -H "Content-Type: application/json" \
        -d "{\"vector\": $ZERO_VEC}" \
        --max-time 15 2>/dev/null || echo "")
    if [ -n "$PERCEIVE_RESP" ]; then
        PERCEIVE_INFO=$(echo "$PERCEIVE_RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
# SimulationStep is returned directly (not nested under 'step')
step = d.get('step', d)
results = step.get('machineResults', {})
n = len(results) if isinstance(results, dict) else '?'
ps = step.get('perceptualSpace', [])
nz = sum(1 for v in ps if v != 0.0) if ps else 0
print(f'machines_evaluated={n}, non-zero_perceptual_elements={nz}')
" 2>/dev/null || echo "response received")
        ok "RE perceive: $PERCEIVE_INFO"
    else
        add_warn "RE perceive returned no response — check:  docker logs reality-engine-app"
        warn "RE perceive: no response"
    fi
else
    warn "python3 unavailable — skipping RE perceive smoke-test"
fi

# ── localAIStack RAG readiness ─────────────────────────────────────────────
info "localAIStack RAG readiness..."
LAS_HEALTH=$(curl -sf http://localhost:4000/health --max-time 5 2>/dev/null || echo "")
if [ -n "$LAS_HEALTH" ]; then
    LAS_STATUS=$(echo "$LAS_HEALTH" | python3 -c \
        "import json,sys; print(json.load(sys.stdin).get('status','unknown'))" \
        2>/dev/null || echo "unknown")
    if [ "$LAS_STATUS" = "ok" ]; then
        ok "localAIStack API: all services healthy"
    else
        add_warn "localAIStack API status: $LAS_STATUS (some sub-services may be unavailable)"
        warn "localAIStack API status: $LAS_STATUS"
    fi
else
    add_warn "localAIStack API health endpoint not responding"
    warn "localAIStack API: no response from /health"
fi

# ── Integration path smoke-test ────────────────────────────────────────────
# Write a test signal to the localai_rag_retrieval sensor in PE.
# A successful write confirms the full signal path is live:
#   localAIStack graph node → PE sensor write → perceptual space update
info "Integration path smoke-test (sensor write → PE)..."
SENSOR_WRITE=$(curl -sk -X POST https://localhost:3004/api/sensors/localai_rag_retrieval \
    -H "Content-Type: application/json" \
    -d '{"values": [2.0, 0.85, 0.0, 0.0]}' \
    --max-time 5 2>/dev/null || echo "")
if echo "$SENSOR_WRITE" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); exit(0 if d.get('ok') or d.get('id') or d.get('success') or d.get('updated') else 1)" \
    2>/dev/null; then
    ok "Integration path: sensor write accepted by PE"
elif [ -n "$SENSOR_WRITE" ]; then
    add_warn "Sensor write returned unexpected response — sensor may not be registered yet"
    warn "Sensor write: $(echo "$SENSOR_WRITE" | head -c 120)"
else
    add_warn "Sensor write returned no response — run a RAG query first to trigger sensor registration"
    info "Sensor 'localai_rag_retrieval' registers on first localAIStack RAG query"
fi

set -e

# =============================================================================
hdr "8 · Summary"
# =============================================================================

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Universe Running"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "  localAIStack"
printf "    %-30s %s\n" "API + RAG Orchestration"   "http://localhost:4000"
printf "    %-30s %s\n" "API Docs (Swagger UI)"     "http://localhost:4000/docs"
printf "    %-30s %s\n" "Open WebUI (Chat)"         "http://localhost:4080"
printf "    %-30s %s\n" "Qdrant Dashboard"          "http://localhost:4333/dashboard"
printf "    %-30s %s\n" "Ollama"                    "http://localhost:11434"
echo ""
echo "  RealityEngine"
printf "    %-30s %s\n" "API"                       "https://localhost:3000"
printf "    %-30s %s\n" "Visualizer"                "https://localhost:5173"
printf "    %-30s %s\n" "Perception Engine API"     "https://localhost:3004"
printf "    %-30s %s\n" "Perception Engine UI"      "https://localhost:3005"
printf "    %-30s %s\n" "Grafana (RE Logs)"         "https://localhost:3002"
echo ""
echo "  Note: RE endpoints use a self-signed TLS cert (browser will warn)"
echo "        Silence it:  bash $RE_DIR/certs/generate-dev-certs.sh"
echo ""

if [ "${#WARNS[@]}" -gt 0 ]; then
    echo "════════════════════════════════════════════════════════════════════"
    printf "  ${YELLOW}Integration Warnings${NC}  (%d)\n" "${#WARNS[@]}"
    echo "════════════════════════════════════════════════════════════════════"
    for w in "${WARNS[@]}"; do warn "  $w"; done
    echo ""
    echo "  To re-trigger localAIStack integration hooks:"
    echo "    (cd $LAS_DIR && docker compose restart api)"
    echo ""
    echo "  Then verify:"
    echo "    # Machines (should include rag_corrective_cycle, session_*)"
    echo "    curl -sk https://localhost:3000/api/machines | python3 -c \\"
    echo "      \"import json,sys; [print(m['id']) for m in json.load(sys.stdin)['machines'] if any(k in m['id'] for k in ['rag','session'])]\""
    echo ""
    echo "    # Sensor sources (should show type=sensor entries)"
    echo "    curl -sk https://localhost:3004/api/sources | python3 -c \\"
    echo "      \"import json,sys; [print(s['name'],s['region']) for s in json.load(sys.stdin)['sources'] if s['type']=='sensor']\""
    echo ""
else
    echo "════════════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}Integration verified — all systems nominal${NC}"
    echo "════════════════════════════════════════════════════════════════════"
    echo ""
fi
