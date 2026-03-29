import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import * as https from 'https';
import { readFileSync, existsSync } from 'fs';

/**
 * Visualization Backend Server
 *
 * This server acts as a proxy between the React frontend and the Reality Engine,
 * providing WebSocket support for real-time updates without modifying the core engine.
 */

const app = express();
const PORT = parseInt(process.env.VIZ_PORT || '3001', 10);
const REALITY_ENGINE_URL = process.env.REALITY_ENGINE_URL || 'http://localhost:3000';
const certPath = process.env.TLS_CERT_PATH;
const keyPath  = process.env.TLS_KEY_PATH;
const tlsEnabled = !!(certPath && keyPath && existsSync(certPath) && existsSync(keyPath));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Use HTTPS when TLS_CERT_PATH and TLS_KEY_PATH are set (dev outside Docker);
// otherwise plain HTTP (Docker: TLS is terminated by the nginx tls-proxy).
const server = tlsEnabled
  ? https.createServer({ cert: readFileSync(certPath!), key: readFileSync(keyPath!) }, app)
  : http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Store connected clients with heartbeat tracking
const clients = new Set<any>();

// Heartbeat interval to detect stale connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 35000; // 35 seconds

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);

  // Mark connection as alive
  (ws as any).isAlive = true;

  // Setup pong handler to detect alive connections
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Heartbeat check - ping all clients periodically
const heartbeatInterval = setInterval(() => {
  clients.forEach((ws) => {
    if ((ws as any).isAlive === false) {
      console.log('Terminating stale WebSocket connection');
      clients.delete(ws);
      return ws.terminate();
    }

    (ws as any).isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

// Broadcast function to all connected clients
function broadcast(data: any) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'reality-engine-visualizer',
    timestamp: Date.now()
  });
});

// Log ingestion endpoint - receives frontend logs and forwards to Loki
app.post('/api/logs/ingest', async (req: Request, res: Response) => {
  try {
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Invalid logs format. Expected { logs: [...] }' });
    }

    // Convert logs to Loki format
    const streams = logs.map((log: any) => ({
      stream: {
        app: 'reality-engine',
        service: 'visualizer-frontend',
        environment: 'production',
        log_type: log.type || 'perceptual-sequence',
        log_level: log.level || 'info',
        queue_type: log.data?.queueType || 'unknown'
      },
      values: [
        [
          `${log.timestamp * 1000000}`, // Convert to nanoseconds
          JSON.stringify({
            message: log.message,
            level: log.level,
            type: log.type,
            ...log.data
          })
        ]
      ]
    }));

    // Send to Loki
    const lokiUrl = process.env.LOKI_URL || 'http://loki:3100';
    await axios.post(`${lokiUrl}/loki/api/v1/push`, { streams });

    res.json({ success: true, logsIngested: logs.length });
  } catch (error: any) {
    console.error('Error ingesting logs to Loki:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Get all sequences with graph data
app.get('/api/viz/sequences', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/sequences`);
    const sequences = response.data.sequences;

    // Transform sequences into graph-ready format
    const graphData = sequences.map((sequence: any) => {
      const nodes: any[] = [];
      const edges: any[] = [];

      // Create nodes from vectors
      sequence.vectors.forEach((vector: any) => {
        nodes.push({
          id: vector.id,
          label: `V-${vector.id.substring(0, 8)}`,
          isInitial: vector.isInitial,
          isActive: vector.isActive || vector.state === 'ACTIVE',
          hasOutput: vector.outputVectors && vector.outputVectors.length > 0,
          wasJustMatched: vector.wasJustMatched || false,
          lastOutputVector: vector.lastOutputVector || null,
          elements: vector.elements,
          metadata: vector.metadata,
          outputVectors: vector.outputVectors || []
        });

        // Create edges from next vector connections
        if (vector.nextVectorIds && vector.nextVectorIds.length > 0) {
          vector.nextVectorIds.forEach((targetId: string) => {
            edges.push({
              id: `${vector.id}-${targetId}`,
              source: vector.id,
              target: targetId
            });
          });
        }
      });

      return {
        sequenceId: sequence.id,
        sequenceName: sequence.name,
        metadata: sequence.metadata,
        nodes,
        edges,
        stats: {
          totalVectors: nodes.length,
          activeVectors: nodes.filter((n: any) => n.isActive).length,
          initialVectors: nodes.filter((n: any) => n.isInitial).length,
          outputVectors: nodes.filter((n: any) => n.hasOutput).length
        }
      };
    });

    res.json({ sequences: graphData });
  } catch (error: any) {
    console.error('Error fetching sequences:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Get specific sequence graph
app.get('/api/viz/sequences/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/sequences/${id}`);
    const sequence = response.data.sequence;

    const nodes: any[] = [];
    const edges: any[] = [];

    // Create nodes from vectors
    sequence.vectors.forEach((vector: any) => {
      nodes.push({
        id: vector.id,
        label: `V-${vector.id.substring(0, 8)}`,
        isInitial: vector.isInitial,
        isActive: vector.isActive || vector.state === 'ACTIVE',
        hasOutput: vector.outputVectors && vector.outputVectors.length > 0,
        wasJustMatched: vector.wasJustMatched || false,
        lastOutputVector: vector.lastOutputVector || null,
        elements: vector.elements,
        metadata: vector.metadata,
        outputVectors: vector.outputVectors || []
      });

      // Create edges from next vector connections
      if (vector.nextVectorIds && vector.nextVectorIds.length > 0) {
        vector.nextVectorIds.forEach((targetId: string) => {
          edges.push({
            id: `${vector.id}-${targetId}`,
            source: vector.id,
            target: targetId
          });
        });
      }
    });

    const graphData = {
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      metadata: sequence.metadata,
      nodes,
      edges,
      stats: {
        totalVectors: nodes.length,
        activeVectors: nodes.filter((n: any) => n.isActive).length,
        initialVectors: nodes.filter((n: any) => n.isInitial).length,
        outputVectors: nodes.filter((n: any) => n.hasOutput).length
      }
    };

    res.json(graphData);
  } catch (error: any) {
    console.error('Error fetching sequence:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Load data center example
app.get('/api/demo/data-center', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/demo/data-center`);

    // Broadcast update to connected clients
    broadcast({
      type: 'demo-loaded',
      metadata: response.data.metadata,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading data center example:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Load multi-step sequences example
app.get('/api/demo/multi-step', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/demo/multi-step`);

    // Broadcast update to connected clients
    broadcast({
      type: 'demo-loaded',
      metadata: response.data.metadata,
      machine: response.data.machine,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading multi-step sequences example:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Load Kleene star example
app.get('/api/demo/kleene-star', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/demo/kleene-star`);

    // Broadcast update to connected clients
    broadcast({
      type: 'demo-loaded',
      metadata: response.data.metadata,
      machine: response.data.machine,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading Kleene star example:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== Machine Management Endpoints =====

// Get all machines - proxy to Reality Engine
app.get('/api/machines', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machines`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching machines:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get specific machine - proxy to Reality Engine
app.get('/api/machines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machines/${id}`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching machine:', error.message);
    if (error.response?.status === 404) {
      res.status(404).json({ error: 'Machine not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Create new machine - proxy to Reality Engine
app.post('/api/machines', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/machines`, req.body);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error creating machine:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Update machine - proxy to Reality Engine
app.put('/api/machines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.put(`${REALITY_ENGINE_URL}/api/machines/${id}`, req.body);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error updating machine:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Delete machine - proxy to Reality Engine
app.delete('/api/machines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.delete(`${REALITY_ENGINE_URL}/api/machines/${id}`);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting machine:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Machine JSON endpoints - proxy to Reality Engine

// List available machine JSON files
app.get('/api/machines/json/list', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machines/json/list`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error listing machine JSON files:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Load machine from JSON file
app.get('/api/machines/json/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machines/json/${name}`);

    // Broadcast update to connected clients
    broadcast({
      type: 'machine-loaded',
      machine: response.data.machine,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading machine from JSON:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Import machine from JSON
app.post('/api/machines/json/import', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/machines/json/import`, req.body);

    // Broadcast update to connected clients
    broadcast({
      type: 'machine-imported',
      machine: response.data.machine,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error importing machine JSON:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Export machine to JSON
app.get('/api/machines/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pretty = req.query.pretty || 'true';
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machines/${id}/export?pretty=${pretty}`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', response.headers['content-disposition'] || 'attachment; filename="machine.json"');
    res.send(response.data);
  } catch (error: any) {
    console.error('Error exporting machine to JSON:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Machine Graph & Perceptual Space Simulation endpoints

// Get machine graph visualization data
app.get('/api/machine-graph', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/machine-graph`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error getting machine graph:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Append a chunk to the server-side staging buffer
app.post('/api/perceptual-simulation/configure/chunk', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(
      `${REALITY_ENGINE_URL}/api/perceptual-simulation/configure/chunk`,
      req.body,
      { maxContentLength: Infinity, maxBodyLength: Infinity }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Error appending sequence chunk:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Commit the staged buffer into the PerceptualSpaceSimulator
app.post('/api/perceptual-simulation/configure/commit', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/perceptual-simulation/configure/commit`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error committing sequence config:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Start perceptual simulation
app.post('/api/perceptual-simulation/start', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/perceptual-simulation/start`);

    // Start polling for updates
    startPerceptualSimulationPolling();

    res.json(response.data);
  } catch (error: any) {
    console.error('Error starting perceptual simulation:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Stop perceptual simulation
app.post('/api/perceptual-simulation/stop', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/perceptual-simulation/stop`);

    // Stop polling
    stopPerceptualSimulationPolling();

    res.json(response.data);
  } catch (error: any) {
    console.error('Error stopping perceptual simulation:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Step perceptual simulation
app.post('/api/perceptual-simulation/step', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/perceptual-simulation/step`);

    // Broadcast the step result
    if (response.data.success && response.data.step) {
      const step = response.data.step;
      broadcast({
        type: 'perceptual-simulation-stepped',
        step,
        data: { activeMachineIds: Object.keys(step.machineResults ?? {}) },
        timestamp: Date.now()
      });
    }

    res.json(response.data);
  } catch (error: any) {
    console.error('Error stepping perceptual simulation:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Perception Engine push — accepts a pre-assembled 256-byte reality vector,
// forwards to the Reality Engine, and broadcasts the result to all visualizer clients.
app.post('/api/perceive', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/perceive`, req.body);

    if (response.data.success && response.data.step) {
      broadcast({
        type: 'perceptual-simulation-stepped',
        step: response.data.step,
        data: { activeMachineIds: Object.keys(response.data.step.machineResults ?? {}) },
        timestamp: Date.now()
      });
    }

    res.json(response.data);
  } catch (error: any) {
    console.error('Error forwarding /api/perceive:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Reset perceptual simulation
app.post('/api/perceptual-simulation/reset', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/perceptual-simulation/reset`);

    // Stop polling
    stopPerceptualSimulationPolling();

    // Broadcast reset
    broadcast({
      type: 'perceptual-simulation-reset',
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error resetting perceptual simulation:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Get perceptual simulation state
app.get('/api/perceptual-simulation/state', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/perceptual-simulation/state`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error getting perceptual simulation state:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Get perceptual simulation history
app.get('/api/perceptual-simulation/history', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/perceptual-simulation/history`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error getting perceptual simulation history:', error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Perceptual simulation polling (similar to regular simulation)
let perceptualSimulationPollInterval: NodeJS.Timeout | null = null;
let lastPerceptualStep = -1;

function startPerceptualSimulationPolling() {
  if (perceptualSimulationPollInterval) return; // Already polling

  perceptualSimulationPollInterval = setInterval(async () => {
    try {
      // Stop polling if no clients are connected
      if (clients.size === 0) {
        console.log('No clients connected, stopping perceptual simulation polling');
        stopPerceptualSimulationPolling();
        return;
      }

      const response = await axios.get(`${REALITY_ENGINE_URL}/api/perceptual-simulation/state`);
      const state = response.data.state;

      // Check if simulation is still running
      if (!state.isRunning) {
        stopPerceptualSimulationPolling();
        return;
      }

      // Check if step changed
      if (state.currentStep !== lastPerceptualStep) {
        lastPerceptualStep = state.currentStep;

        // Get the latest step from history
        const historyResponse = await axios.get(`${REALITY_ENGINE_URL}/api/perceptual-simulation/history`);
        const history = historyResponse.data.history;
        const latestStep = history[history.length - 1];

        if (latestStep) {
          broadcast({
            type: 'perceptual-simulation-stepped',
            step: latestStep,
            state,
            data: { activeMachineIds: Object.keys(latestStep.machineResults ?? {}) },
            timestamp: Date.now()
          });
        }
      }
    } catch (error: any) {
      console.error('Error polling perceptual simulation state:', error.message);
    }
  }, 200); // Poll every 200ms
}

function stopPerceptualSimulationPolling() {
  if (perceptualSimulationPollInterval) {
    clearInterval(perceptualSimulationPollInterval);
    perceptualSimulationPollInterval = null;
    lastPerceptualStep = -1;
  }
}

// Start server
server.listen(PORT, () => {
  const protocol = tlsEnabled ? 'https' : 'http';
  const wsProtocol = tlsEnabled ? 'wss' : 'ws';
  console.log(`Reality Engine Visualizer Backend running on port ${PORT} (${protocol.toUpperCase()})`);
  console.log(`WebSocket server available at ${wsProtocol}://localhost:${PORT}/ws`);
  console.log(`Proxying to Reality Engine at ${REALITY_ENGINE_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  clearInterval(heartbeatInterval);
  stopPerceptualSimulationPolling();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  clearInterval(heartbeatInterval);
  stopPerceptualSimulationPolling();
  server.close(() => {
    process.exit(0);
  });
});
