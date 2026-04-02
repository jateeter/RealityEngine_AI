import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { PerceptionEngine } from './PerceptionEngine.js';
import { SourceStore } from './SourceStore.js';
import { mountMcp } from './mcp.js';
import type { SourceConfig, PushResult, MatchAlgorithm } from './types.js';

const PORT = parseInt(process.env['PORT'] ?? '3004', 10);
const PERCEPTION_TARGET_URL = process.env['PERCEPTION_TARGET_URL'] ?? 'http://localhost:3001';
const REALITY_ENGINE_URL = process.env['REALITY_ENGINE_URL'] ?? 'http://localhost:3000';
const DATA_PATH = process.env['DATA_PATH'] ?? './data';
const certPath = process.env['TLS_CERT_PATH'];
const keyPath  = process.env['TLS_KEY_PATH'];
const tlsEnabled = !!(certPath && keyPath && existsSync(certPath) && existsSync(keyPath));

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
const engine = new PerceptionEngine();

// Restore persisted sources (preserves original IDs)
for (const src of store.load()) {
  engine.restoreSource(src);
}
console.log(`[SourceStore] Loaded ${engine.getSources().length} source(s) from ${DATA_PATH}`);

let autoTimer: ReturnType<typeof setInterval> | null = null;
let autoIntervalMs = 1000;
let lastPush: number | null = null;

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

// ── Push helper ───────────────────────────────────────────────────────────

async function doPush(): Promise<PushResult> {
  const vector = engine.assembleVector();

  try {
    const response = await axios.post(`${PERCEPTION_TARGET_URL}/api/perceive`, {
      vector,
      matchAlgorithm: engine.matchAlgorithm,
    });
    engine.advance();
    lastPush = Date.now();

    // Update the engine's persistent perceptual space with the full post-merge
    // state returned by the Reality Engine so that machine outputs written
    // during this step's merge phase are carried forward into the next push.
    const returnedPs: number[] | undefined = response.data.step?.perceptualSpace;
    if (Array.isArray(returnedPs) && returnedPs.length === 256) {
      engine.updateFromPerceptualSpace(returnedPs);
    }

    const result: PushResult = {
      success: response.data.success ?? true,
      step: response.data.step,
      timestamp: lastPush,
      globalStep: engine.globalStep,
    };

    const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
    broadcast({ type: 'state-update', state });
    broadcast({ type: 'push-result', ...result });

    return result;
  } catch (err: any) {
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

// Source list
app.get('/api/sources', (_req: Request, res: Response) => {
  res.json({ sources: engine.getSources() });
});

// Add source
app.post('/api/sources', async (req: Request, res: Response) => {
  try {
    const config = req.body as Omit<SourceConfig, 'id'>;
    if (!config.type || !config.name || !config.region) {
      res.status(400).json({ error: 'type, name, and region are required' });
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
  const state = engine.getState(lastPush, { running: autoTimer !== null, intervalMs: autoIntervalMs });
  broadcast({ type: 'state-update', state });
  res.json({ success: true, sensorId: id, timestamp });
});

// Machine listing — proxy from Reality Engine for use in the add-source form
app.get('/api/machines', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machines`);
    res.json(response.data);
  } catch (err: any) {
    res.status(err.response?.status || 502).json({ error: err.message });
  }
});

// ── Start server ─────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const protocol = tlsEnabled ? 'HTTPS' : 'HTTP';
  console.log(`Perception Engine backend listening on port ${PORT} (${protocol})`);
  console.log(`  Push target    : ${PERCEPTION_TARGET_URL}/api/perceive`);
  console.log(`  Reality Engine : ${REALITY_ENGINE_URL}`);
});
