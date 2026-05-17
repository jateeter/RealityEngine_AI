import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import { Agent as HttpsAgent, createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { PerceptionEngine } from './PerceptionEngine.js';
import { SourceStore } from './SourceStore.js';
import { mountMcp } from './mcp.js';
import { MqttBridge, fromEnvironment as mqttFromEnvironment } from './MqttBridge.js';
import type { IngestPayload } from './MqttBridge.js';
import type { SourceConfig, SensorSourceConfig, PushResult, MatchAlgorithm } from './types.js';

// Bundled example mapping registry — served by GET /api/mqtt/example so
// the PE visualizer's MqttConfigModal can offer a "Load example" button
// without reaching out to the host filesystem (the file lives in
// RealityEngine_CPP, which the Docker PE container can't see).  Mirrors
// config/mqtt-mappings.yuma-agriculture.json from the CPP repo — the
// 16-rule yuma-agriculture demo registry.
const EXAMPLE_MAPPINGS_JSON = {
  defaults: { ttlMs: 60000, qos: 0, acceptRetained: true, pushMode: 'debounced', debounceMs: 500 },
  mappings: [
    { id: 'agx001-ph-ok',         topicFilter: 'LATERAL/WaterSuite/DEV0000001/SensorReadings/v1', sensorIdTemplate: 'agx001.water.ph.ok',         region: { offset: 40,  length: 1 }, extract: { type: 'json', pointer: '/data/wpH'         }, normalize: { mode: 'band', min: 6.5,  max: 8.5  } },
    { id: 'agx001-ec-ok',         topicFilter: 'LATERAL/WaterSuite/DEV0000001/SensorReadings/v1', sensorIdTemplate: 'agx001.water.ec.ok',         region: { offset: 41,  length: 1 }, extract: { type: 'json', pointer: '/data/wEC'         }, normalize: { mode: 'band', min: 0.5,  max: 3.0  } },
    { id: 'agx001-orp-ok',        topicFilter: 'LATERAL/WaterSuite/DEV0000001/SensorReadings/v1', sensorIdTemplate: 'agx001.water.orp.ok',        region: { offset: 42,  length: 1 }, extract: { type: 'json', pointer: '/data/wORP'        }, normalize: { mode: 'band', min: 200,  max: 600  } },
    { id: 'agx001-turbidity-ok',  topicFilter: 'LATERAL/WaterSuite/DEV0000001/SensorReadings/v1', sensorIdTemplate: 'agx001.water.turbidity.ok',  region: { offset: 43,  length: 1 }, extract: { type: 'json', pointer: '/data/wTurbidity'  }, normalize: { mode: 'band', min: 0,    max: 100  } },
    { id: 'agx005-do-ok',         topicFilter: 'LATERAL/DOSuite/DEV0000017/SensorReadings/v1',    sensorIdTemplate: 'agx005.do.level.ok',         region: { offset: 84,  length: 1 }, extract: { type: 'json', pointer: '/data/wDO'         }, normalize: { mode: 'band', min: 5,    max: 25   } },
    { id: 'agx005-do-temp-ok',    topicFilter: 'LATERAL/DOSuite/DEV0000017/SensorReadings/v1',    sensorIdTemplate: 'agx005.do.temp.ok',          region: { offset: 85,  length: 1 }, extract: { type: 'json', pointer: '/data/wDOTemp'     }, normalize: { mode: 'band', min: 60,   max: 85   } },
    { id: 'agx005-do-watch',      topicFilter: 'LATERAL/DOSuite/DEV0000017/SensorReadings/v1',    sensorIdTemplate: 'agx005.do.watch',            region: { offset: 86,  length: 1 }, extract: { type: 'json', pointer: '/data/wDO'         }, normalize: { mode: 'band', min: 3,    max: 5    } },
    { id: 'agx005-temp-watch',    topicFilter: 'LATERAL/DOSuite/DEV0000017/SensorReadings/v1',    sensorIdTemplate: 'agx005.do.temp.watch',       region: { offset: 87,  length: 1 }, extract: { type: 'json', pointer: '/data/wDOTemp'     }, normalize: { mode: 'band', min: 85,   max: 95   } },
    { id: 'agx026-temp-ok',       topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx026.temp.ok',           region: { offset: 184, length: 1 }, extract: { type: 'json', pointer: '/data/aTemp'       }, normalize: { mode: 'band', min: 65,   max: 85   } },
    { id: 'agx026-humidity-ok',   topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx026.humidity.ok',       region: { offset: 185, length: 1 }, extract: { type: 'json', pointer: '/data/aHum'        }, normalize: { mode: 'band', min: 40,   max: 70   } },
    { id: 'agx026-temp-watch',    topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx026.temp.watch',        region: { offset: 186, length: 1 }, extract: { type: 'json', pointer: '/data/aTemp'       }, normalize: { mode: 'band', min: 85,   max: 95   } },
    { id: 'agx026-humidity-watch',topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx026.humidity.watch',    region: { offset: 187, length: 1 }, extract: { type: 'json', pointer: '/data/aHum'        }, normalize: { mode: 'band', min: 20,   max: 40   } },
    { id: 'agx032-co2-ok',        topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx032.co2.ok',            region: { offset: 228, length: 1 }, extract: { type: 'json', pointer: '/data/aCO2'        }, normalize: { mode: 'band', min: 600,  max: 1500 } },
    { id: 'agx032-co2-watch',     topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx032.co2.watch',         region: { offset: 229, length: 1 }, extract: { type: 'json', pointer: '/data/aCO2'        }, normalize: { mode: 'band', min: 1500, max: 3000 } },
    { id: 'agx032-co2-danger',    topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx032.co2.danger',        region: { offset: 230, length: 1 }, extract: { type: 'json', pointer: '/data/aCO2'        }, normalize: { mode: 'band', min: 3000, max: 5000 } },
    { id: 'agx032-temp-ok',       topicFilter: 'LATERAL/AmbientSuite/DEV0000009/SensorReadings/v1', sensorIdTemplate: 'agx032.temp.ok',           region: { offset: 231, length: 1 }, extract: { type: 'json', pointer: '/data/aTemp'       }, normalize: { mode: 'band', min: 65,   max: 85   } },
  ],
};

const PORT = parseInt(process.env['PORT'] ?? '3004', 10);
const REALITY_ENGINE_URL = process.env['REALITY_ENGINE_URL'] ?? 'http://localhost:3000';
const DATA_PATH = process.env['DATA_PATH'] ?? './data';
const VECTOR_SIZE = parseInt(process.env['VECTOR_SIZE'] ?? '256', 10);
const certPath = process.env['TLS_CERT_PATH'];
const keyPath  = process.env['TLS_KEY_PATH'];
const tlsEnabled = !!(certPath && keyPath && existsSync(certPath) && existsSync(keyPath));

// HTTPS agent for outbound calls to the Reality Engine.  When CA_CERT_PATH
// points at a real file (Docker dev: the bundled self-signed CA at
// /etc/certs/ca.crt), trust it explicitly — every PE→RE push then
// validates against that CA instead of erroring with "self-signed
// certificate in certificate chain" on every step.  When CA_CERT_PATH
// is unset (deployed against a real CA-signed RE), this stays null and
// axios uses Node's default trust store — strict TLS validation intact,
// which is exactly the restriction we want to preserve in production.
const caCertPath = process.env['CA_CERT_PATH'];
const reHttpsAgent: HttpsAgent | null =
  caCertPath && existsSync(caCertPath)
    ? new HttpsAgent({ ca: readFileSync(caCertPath) })
    : null;
if (reHttpsAgent) {
  console.log(`[TLS] Trusting RE cert chain via CA at ${caCertPath}`);
}

// Wrap axios calls to the RE so each one carries the CA-aware agent.
// Use these helpers in place of bare axios.get/post when the URL is on
// REALITY_ENGINE_URL — they no-op (use default agent) in deployed mode.
const reAxios = axios.create(reHttpsAgent ? { httpsAgent: reHttpsAgent } : {});

const app = express();
// Use HTTPS when TLS_CERT_PATH and TLS_KEY_PATH are set (dev outside Docker);
// otherwise plain HTTP (Docker: TLS is terminated by the nginx tls-proxy).
const server = tlsEnabled
  ? createHttpsServer({ cert: readFileSync(certPath!), key: readFileSync(keyPath!) }, app)
  : createHttpServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json());

// ── Engine instance ───────────────────────────────────────────────────────

const store = new SourceStore(DATA_PATH);
const engine = new PerceptionEngine(VECTOR_SIZE);

// Restore persisted sources (preserves original IDs)
for (const src of store.load()) {
  engine.restoreSource(src);
}
console.log(`[SourceStore] Loaded ${engine.getSources().length} source(s) from ${DATA_PATH}`);

let autoTimer: ReturnType<typeof setInterval> | null = null;
let autoIntervalMs = 1000;
let lastPush: number | null = null;

// ── MQTT bridge (optional) ────────────────────────────────────────────────
// Built only when MQTT_BROKER_URL is set in the environment.  Per the
// roadmap design rule, the bridge does NOT special-case MQTT downstream —
// each accepted message resolves to {sensorId, region, values, ttlMs} and
// flows through the same engine path that POST /api/sensors/:id uses.

function ingestMqttSignal(payload: IngestPayload): void {
  // Try update path first: matches the sensorId of an existing source.
  let acted = false;
  if (engine.updateSensorValue(payload.sensorId, payload.values)) {
    acted = true;
  } else {
    // No matching sensor source yet — auto-create one using the mapping's
    // declared region + TTL.  This keeps MQTT-driven workflows running
    // without requiring operators to pre-declare every sensor via POST
    // /api/sources first.
    const newSource: Omit<SensorSourceConfig, 'id'> = {
      type: 'sensor',
      name: `mqtt:${payload.topic}`,
      region: { offset: payload.offset, length: payload.length },
      active: true,
      sensorId: payload.sensorId,
      lastValue: payload.values.slice(),
      lastUpdated: Date.now(),
      ttlMs: payload.ttlMs > 0 ? payload.ttlMs : 30000,
    };
    engine.addSource(newSource);
    acted = true;
  }
  if (acted) {
    // Per-message MQTT ingest event — broadcast directly (not via the 50ms
    // sensor-coalesce timer) so the universe-monitor's recent-ingests
    // stream renders one row per accepted PUBLISH.  scheduleSensorBroadcast
    // is still called for the consolidated state update.
    broadcast({
      type: 'mqtt-ingest',
      payload: { ...payload, timestamp: Date.now() },
    });
    scheduleSensorBroadcast();
  }
}

let mqttBridge: MqttBridge | null = null;
// Last broker config we bootstrapped with — preserved across reloads so a
// PUT /api/mqtt/mappings can swap the registry without re-reading env vars.
let mqttBrokerConfig: import('./MqttBridge.js').BridgeConfig | null = null;

import { MappingRegistry } from './MqttMapping.js';

/**
 * Start (or restart) the MQTT bridge with the given config + registry.
 * Idempotent — stops any existing bridge before starting the new one.
 * Returns the resulting bridge or null when broker config is missing.
 */
async function bootMqttBridge(
  config: import('./MqttBridge.js').BridgeConfig | null,
  registry: MappingRegistry,
): Promise<MqttBridge | null> {
  // Tear down the old bridge — drops in-flight reconnect timers and joins
  // the I/O thread.  Brief gap (≤ a few hundred ms) is acceptable for the
  // admin-driven reload path.
  if (mqttBridge) {
    try { await mqttBridge.stop(); } catch { /* ignore */ }
    mqttBridge = null;
  }
  if (!config) return null;
  const bridge = new MqttBridge(config, registry, ingestMqttSignal, () => { void doPush(); });
  try {
    await bridge.start();
  } catch (e: any) {
    console.error(`MQTT bridge failed to start: ${e?.message ?? e}`);
    return null;
  }
  mqttBridge = bridge;
  mqttBrokerConfig = config;
  // Notify visualizer clients that the registry has changed so they can
  // refresh their mapping table without polling.
  broadcast({
    type: 'mqtt-mappings-reloaded',
    mappingsCount: registry.size,
    brokerUrl: config.brokerUrl,
    timestamp: Date.now(),
  });
  console.log(`[MQTT] bridge enabled — broker=${config.brokerUrl} mappings=${registry.size}`);
  return bridge;
}

{
  const envBridge = mqttFromEnvironment();
  if (envBridge) {
    // First boot from env; mqttBrokerConfig is captured for later reloads.
    void bootMqttBridge(envBridge.config, envBridge.registry);
  }
}

// ── WebSocket broadcast ───────────────────────────────────────────────────

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));

  // Send current state on connect
  const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
  ws.send(JSON.stringify({ type: 'state-update', state }));
});

function broadcast(payload: object): void {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

// Debounced state broadcast for high-frequency sensor pushes.
// Rapid sensor POSTs coalesce into a single broadcast within the 50 ms window
// instead of fanning out a full state payload to every WS client per event.
let sensorBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
const SENSOR_DEBOUNCE_MS = 50;

function scheduleSensorBroadcast(): void {
  if (sensorBroadcastTimer !== null) return; // already pending — coalesce
  sensorBroadcastTimer = setTimeout(() => {
    sensorBroadcastTimer = null;
    const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
    broadcast({ type: 'state-update', state });
  }, SENSOR_DEBOUNCE_MS);
}

// ── Push helper ───────────────────────────────────────────────────────────
//
// Critical-path design:
//   1. Call the Reality Engine DIRECTLY — no visualizer proxy hop.
//   2. Advance engine state and return the result to the caller immediately.
//   3. THEN asynchronously notify the visualizer so it can fan out to its
//      WebSocket clients.  This step is fire-and-forget: it never blocks
//      the perception loop or the HTTP caller, and its failure is non-fatal.

async function doPush(): Promise<PushResult> {
  const vector = engine.assembleVector();

  try {
    // Direct call to the Reality Engine — bypasses the visualizer entirely.
    // RE returns the step object directly (not wrapped in {success, step}).
    const response = await reAxios.post(`${REALITY_ENGINE_URL}/api/perceive`, {
      vector,
      matchAlgorithm: engine.matchAlgorithm,
    });
    engine.advance();
    lastPush = Date.now();

    // RE returns the step directly as response.data.
    const step = response.data;

    // Update the engine's persistent perceptual space with the full post-merge
    // state so that machine outputs written this step carry forward into the next push.
    const returnedPs: number[] | undefined = step?.perceptualSpace;
    if (Array.isArray(returnedPs) && returnedPs.length >= VECTOR_SIZE) {
      engine.updateFromPerceptualSpace(returnedPs);
    }

    const result: PushResult = {
      success: true,
      step,
      timestamp: lastPush,
      globalStep: engine.globalStep,
    };

    const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
    broadcast({ type: 'state-update', state });
    broadcast({ type: 'push-result', ...result });

    return result;
  } catch (err: any) {
    console.error(`[doPush] Push failed (step ${engine.globalStep}):`, err.message);
    const result: PushResult = {
      success: false,
      timestamp: Date.now(),
      globalStep: engine.globalStep,
      error: err.message,
    };
    broadcast({ type: 'push-result', ...result });
    return result;
  }
}

// ── Auto-push ──────────────────────────────────────────────────────────────

function startAuto(intervalMs: number): void {
  stopAuto();
  autoIntervalMs = intervalMs;
  autoTimer = setInterval(async () => {
    await doPush();
  }, intervalMs);
}

function stopAuto(): void {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

// ── Shared helpers (used by both REST routes and MCP tools) ───────────────

/** Save current sources to disk and push a state-update to all WS clients. */
async function saveAndBroadcast(): Promise<void> {
  await store.save(engine.getSources());
  const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
  broadcast({ type: 'state-update', state });
}

/** Reset the engine, clear lastPush, and push a state-update to WS clients. */
function resetAndBroadcast(): void {
  engine.reset();
  lastPush = null;
  const state = engine.getState(null, { running: autoTimer !== null, intervalMs: autoIntervalMs });
  broadcast({ type: 'state-update', state });
}

// ── MCP server ────────────────────────────────────────────────────────────

mountMcp(app, {
  engine,
  store,
  push: doPush,
  startAuto,
  stopAuto,
  getAutoState: () => ({ running: autoTimer !== null, intervalMs: autoIntervalMs }),
  getLastPush: () => lastPush,
  saveAndBroadcast,
  resetAndBroadcast,
  realityEngineUrl: REALITY_ENGINE_URL,
  httpClient: reAxios,
});

// ── HTTP API ──────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    service: 'Perception Engine',
    status: 'running',
    port: PORT,
    endpoints: {
      health:   'GET    /api/health',
      state:    'GET    /api/state',
      push:     'POST   /api/push',
      autoStart:'POST   /api/auto/start  { intervalMs }',
      autoStop: 'POST   /api/auto/stop',
      reset:    'POST   /api/reset',
      sources:  'GET    /api/sources',
      addSource:'POST   /api/sources',
      sensor:   'POST   /api/sensors/:id  { values }',
      machines: 'GET    /api/machines',
    },
    mcp: {
      transport: 'Streamable HTTP (MCP 1.0)',
      post:   'POST   /mcp  — initialize session / dispatch JSON-RPC',
      get:    'GET    /mcp  — SSE notification stream (mcp-session-id required)',
      delete: 'DELETE /mcp  — close session',
      tools: [
        'perception_get_state', 'perception_push',
        'perception_start_auto', 'perception_stop_auto',
        'perception_reset', 'perception_set_match_algorithm',
        'sources_list', 'sources_add_simulated', 'sources_add_sensor',
        'sources_add_test', 'sources_update', 'sources_delete',
        'sensor_push_value',
        'reality_engine_health', 'machines_list', 'machines_load_json',
        'perceptual_sim_state', 'perceptual_sim_step', 'perceptual_sim_start',
        'perceptual_sim_stop', 'perceptual_sim_reset', 'perceptual_sim_history',
        'demo_load',
      ],
      resources: ['perception://state', 'perception://sources', 'perception://vector'],
    },
    websocket: `${tlsEnabled ? 'wss' : 'ws'}://localhost:${PORT}/ws`,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

// Full engine state
app.get('/api/state', (_req: Request, res: Response) => {
  const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
  res.json(state);
});

// Manual push
app.post('/api/push', async (_req: Request, res: Response) => {
  const result = await doPush();
  res.json(result);
});

// Auto push control
app.post('/api/auto/start', (req: Request, res: Response) => {
  const { intervalMs } = req.body;
  const ms = typeof intervalMs === 'number' && intervalMs > 0 ? intervalMs : 1000;
  startAuto(ms);
  res.json({ success: true, intervalMs: ms });
});

app.post('/api/auto/stop', (_req: Request, res: Response) => {
  stopAuto();
  res.json({ success: true });
});

// Update engine configuration (matchAlgorithm etc.)
app.patch('/api/config', async (req: Request, res: Response) => {
  const { matchAlgorithm } = req.body;
  if (matchAlgorithm !== undefined) {
    if (matchAlgorithm !== 'gte' && matchAlgorithm !== 'equals') {
      res.status(400).json({ error: 'matchAlgorithm must be "gte" or "equals"' });
      return;
    }
    engine.setMatchAlgorithm(matchAlgorithm as MatchAlgorithm);
    await saveAndBroadcast();
  }
  res.json({ success: true, matchAlgorithm: engine.matchAlgorithm });
});

// Reset engine step counter and test source indices
app.post('/api/reset', (_req: Request, res: Response) => {
  resetAndBroadcast();
  res.json({ success: true });
});

// Decorate sensor sources with derived freshness fields (ageMs, stale).
// Matches the LSP source-json shape so a single visualizer panel can show
// "stale sensor" badges across all three runtimes.
function decorateSources(sources: SourceConfig[]): Array<SourceConfig & { ageMs?: number; stale?: boolean }> {
  const now = Date.now();
  return sources.map(s => {
    if (s.type !== 'sensor') return s;
    const sensor = s as SensorSourceConfig;
    const age   = sensor.lastUpdated ? now - sensor.lastUpdated : 0;
    const stale = !!sensor.lastUpdated && sensor.ttlMs > 0 && age > sensor.ttlMs;
    return { ...sensor, ageMs: age, stale };
  });
}

// Source list
app.get('/api/sources', (_req: Request, res: Response) => {
  res.json({ sources: decorateSources(engine.getSources()) });
});

// Add source
app.post('/api/sources', async (req: Request, res: Response) => {
  try {
    const config = req.body as Omit<SourceConfig, 'id'>;
    if (!config.type || !config.name || !config.region) {
      res.status(400).json({ error: 'type, name, and region are required' });
      return;
    }
    const { offset, length } = config.region;
    if (typeof offset !== 'number' || typeof length !== 'number' || offset < 0 || length < 1 || offset >= VECTOR_SIZE) {
      res.status(400).json({ error: `region.offset must be 0–${VECTOR_SIZE - 1} and region.length must be ≥ 1` });
      return;
    }
    const source = engine.addSource(config);
    await saveAndBroadcast();
    res.json({ source });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update source
app.patch('/api/sources/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (req.body.region) {
    const { offset, length } = req.body.region;
    if (typeof offset === 'number' && (offset < 0 || offset >= VECTOR_SIZE)) {
      res.status(400).json({ error: `region.offset must be 0–${VECTOR_SIZE - 1}` });
      return;
    }
    if (typeof length === 'number' && length < 1) {
      res.status(400).json({ error: 'region.length must be ≥ 1' });
      return;
    }
  }
  const source = engine.updateSource(id, req.body);
  if (!source) {
    res.status(404).json({ error: 'Source not found' });
    return;
  }
  await saveAndBroadcast();
  res.json({ source });
});

// Delete source
app.delete('/api/sources/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const removed = engine.removeSource(id);
  if (!removed) {
    res.status(404).json({ error: 'Source not found' });
    return;
  }
  await saveAndBroadcast();
  res.json({ success: true });
});

// Sensor push endpoint
app.post('/api/sensors/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { values } = req.body;
  if (!Array.isArray(values)) {
    res.status(400).json({ error: 'values must be an array' });
    return;
  }
  const updated = engine.updateSensorValue(id, values);
  if (!updated) {
    res.status(404).json({ error: `No sensor source with sensorId "${id}"` });
    return;
  }
  const timestamp = Date.now();
  // Debounced: rapid sensor pushes coalesce into one broadcast per 50 ms window.
  scheduleSensorBroadcast();
  res.json({ success: true, sensorId: id, timestamp });
});

// MQTT bridge status — connection state, bridge counters, broker config.
// Returns enabled:false when MQTT_BROKER_URL was not set at PE startup.
app.get('/api/mqtt/status', (_req: Request, res: Response) => {
  if (!mqttBridge) { res.json({ enabled: false }); return; }
  res.json({
    enabled: true,
    connected: mqttBridge.isConnected(),
    bridge: mqttBridge.getStats(),
    mappings: mqttBridge.getRegistry().size,
  });
});

// MQTT mapping registry — the authoritative topic→region rules + per-
// mapping counters.  Per the design rule, topics carry no offset info;
// this endpoint shows the authority that decides projection into the
// perceptual vector.
app.get('/api/mqtt/mappings', (_req: Request, res: Response) => {
  if (!mqttBridge) { res.json({ enabled: false, mappings: [] }); return; }
  const body = mqttBridge.getRegistry().toJson() as { mappings: object[] };
  res.json({ enabled: true, ...body });
});

// PUT /api/mqtt/mappings — replace the in-memory mapping registry and
// restart the bridge with the new rules.  Body shape:
//   { defaults?: {...}, mappings: [ {...rules...} ] }
// Returns 200 + the new registry on success; 400 + error on schema /
// validation failure; 409 if no broker config exists (set MQTT_BROKER_URL
// at process startup before reloading).  Overlap warnings are non-fatal
// and returned in the response body — same gate as the env loader.
app.put('/api/mqtt/mappings', async (req: Request, res: Response) => {
  if (!mqttBrokerConfig) {
    res.status(409).json({
      error: 'no broker config — set MQTT_BROKER_URL at PE startup before reloading mappings',
    });
    return;
  }
  let registry: MappingRegistry;
  try {
    registry = MappingRegistry.fromJson(req.body);
  } catch (e: any) {
    res.status(400).json({ error: `schema: ${e?.message ?? e}` });
    return;
  }
  if (registry.size === 0) {
    res.status(400).json({ error: 'mappings array is empty — at least one rule is required' });
    return;
  }
  const allowOverlap = (process.env.MQTT_ALLOW_REGION_OVERLAP === '1' ||
                        process.env.MQTT_ALLOW_REGION_OVERLAP === 'true');
  const warnings = registry.validateOverlaps(allowOverlap);
  try {
    await bootMqttBridge(mqttBrokerConfig, registry);
  } catch (e: any) {
    res.status(500).json({ error: `bridge restart failed: ${e?.message ?? e}` });
    return;
  }
  res.json({
    success: true,
    enabled: !!mqttBridge,
    mappings: registry.size,
    warnings,
  });
});

// POST /api/mqtt/enable — runtime configurable bridge start.  Accepts a
// fresh BridgeConfig + mappings registry in one call.  Used by the
// MqttConfigModal in the PE visualizer when an operator wants to enable
// MQTT without restarting the PE process (i.e. without setting env vars).
//
// Body: {
//   brokerUrl:  "mqtt://host:port"  (required)
//   clientId?:  string
//   username?:  string
//   password?:  string
//   keepaliveSec?: number
//   mappings:   {...registry JSON...}  (required, same shape as PUT /api/mqtt/mappings)
// }
//
// Returns 200 + enabled/connected/mappings count on success; 400 on
// validation failure; 500 on bridge boot failure.
app.post('/api/mqtt/enable', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const brokerUrl: string | undefined = body.brokerUrl;
  if (!brokerUrl || typeof brokerUrl !== 'string') {
    res.status(400).json({ error: 'brokerUrl is required (e.g. "mqtt://yuma.lateraledge.cloud:1883")' });
    return;
  }
  if (!body.mappings) {
    res.status(400).json({ error: 'mappings is required (a registry object with a "mappings" array)' });
    return;
  }
  let registry: MappingRegistry;
  try {
    registry = MappingRegistry.fromJson(body.mappings);
  } catch (e: any) {
    res.status(400).json({ error: `mappings schema: ${e?.message ?? e}` });
    return;
  }
  if (registry.size === 0) {
    res.status(400).json({ error: 'mappings array is empty — at least one rule is required' });
    return;
  }
  const config: import('./MqttBridge.js').BridgeConfig = {
    brokerUrl,
    clientId:     typeof body.clientId === 'string' ? body.clientId : 'reality-engine-pe',
    username:     typeof body.username === 'string' ? body.username : undefined,
    password:     typeof body.password === 'string' ? body.password : undefined,
    keepaliveSec: typeof body.keepaliveSec === 'number' ? body.keepaliveSec : 60,
  };
  const allowOverlap = (process.env.MQTT_ALLOW_REGION_OVERLAP === '1' ||
                        process.env.MQTT_ALLOW_REGION_OVERLAP === 'true');
  const warnings = registry.validateOverlaps(allowOverlap);
  try {
    await bootMqttBridge(config, registry);
  } catch (e: any) {
    res.status(500).json({ error: `bridge boot failed: ${e?.message ?? e}` });
    return;
  }
  res.json({
    success:   true,
    enabled:   !!mqttBridge,
    connected: mqttBridge?.isConnected() ?? false,
    brokerUrl: config.brokerUrl,
    mappings:  registry.size,
    warnings,
  });
});

// POST /api/mqtt/disable — cleanly stops the bridge.  Idempotent.
app.post('/api/mqtt/disable', async (_req: Request, res: Response) => {
  if (mqttBridge) {
    try { await mqttBridge.stop(); }
    catch (e: any) { /* swallow — disable is best-effort */ }
    mqttBridge = null;
  }
  res.json({ success: true, enabled: false });
});

// GET /api/mqtt/example — bundled sample mapping registry.  Lets the
// PE visualizer's MqttConfigModal offer a "Load example" button without
// reaching out to the filesystem.  Returns the yuma-agriculture
// registry the demo binaries use.
app.get('/api/mqtt/example', (_req: Request, res: Response) => {
  res.json(EXAMPLE_MAPPINGS_JSON);
});

// Machine listing — proxy from Reality Engine for use in the add-source form
app.get('/api/machines', async (_req: Request, res: Response) => {
  try {
    const response = await reAxios.get(`${REALITY_ENGINE_URL}/api/machines`);
    res.json(response.data);
  } catch (err: any) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── Start server ─────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const protocol = tlsEnabled ? 'HTTPS' : 'HTTP';
  console.log(`Perception Engine backend listening on port ${PORT} (${protocol})`);
  console.log(`  Reality Engine : ${REALITY_ENGINE_URL}`);
});
