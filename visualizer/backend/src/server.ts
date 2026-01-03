import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import { WebSocketServer } from 'ws';
import * as http from 'http';

/**
 * Visualization Backend Server
 *
 * This server acts as a proxy between the React frontend and the Reality Engine,
 * providing WebSocket support for real-time updates without modifying the core engine.
 */

const app = express();
const PORT = parseInt(process.env.VIZ_PORT || '3001', 10);
const REALITY_ENGINE_URL = process.env.REALITY_ENGINE_URL || 'http://localhost:3000';

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Store connected clients
const clients = new Set<any>();

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

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
          isActive: vector.state === 'ACTIVE',
          hasOutput: vector.outputVectors && vector.outputVectors.length > 0,
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
        isActive: vector.state === 'ACTIVE',
        hasOutput: vector.outputVectors && vector.outputVectors.length > 0,
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

// Proxy endpoint: Get engine stats
app.get('/api/viz/stats', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/engine/stats`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Get active vectors
app.get('/api/viz/active', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/engine/active`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching active vectors:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Get history
app.get('/api/viz/history', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? `?limit=${req.query.limit}` : '';
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/engine/history${limit}`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error fetching history:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Reset sequence
app.post('/api/viz/sequences/:id/reset', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/sequences/${id}/reset`);

    // Broadcast update to connected clients
    broadcast({
      type: 'sequence-reset',
      sequenceId: id,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error resetting sequence:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Process input (with WebSocket broadcast)
app.post('/api/viz/process', async (req: Request, res: Response) => {
  try {
    const { vector } = req.body;
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/engine/process`, { vector });

    // Broadcast update to connected clients
    broadcast({
      type: 'input-processed',
      data: response.data,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error processing input:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Polling endpoint to check for updates (alternative to WebSocket)
let lastUpdateTime = Date.now();
let cachedSequences: any = null;

app.get('/api/viz/poll', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/sequences`);
    const sequences = response.data.sequences;

    // Simple change detection based on active vectors
    const currentState = JSON.stringify(sequences.map((s: any) =>
      s.vectors.map((v: any) => ({ id: v.id, state: v.state }))
    ));

    const previousState = cachedSequences
      ? JSON.stringify(cachedSequences.map((s: any) =>
          s.vectors.map((v: any) => ({ id: v.id, state: v.state }))
        ))
      : null;

    const hasChanges = currentState !== previousState;

    if (hasChanges) {
      lastUpdateTime = Date.now();
      cachedSequences = sequences;
    }

    res.json({
      hasChanges,
      lastUpdateTime,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error('Error polling for updates:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ===== Simulation Proxy Endpoints (with WebSocket Broadcasting) =====

// Proxy endpoint: Load simulation vectors
app.post('/api/simulation/load', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/load`, req.body);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-loaded',
      data: response.data,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Start simulation
app.post('/api/simulation/start', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/start`);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-started',
      state: response.data.state,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error starting simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Pause simulation
app.post('/api/simulation/pause', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/pause`);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-paused',
      state: response.data.state,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error pausing simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Resume simulation
app.post('/api/simulation/resume', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/resume`);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-resumed',
      state: response.data.state,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error resuming simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Stop simulation
app.post('/api/simulation/stop', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/stop`);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-stopped',
      state: response.data.state,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error stopping simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Reset simulation
app.post('/api/simulation/reset', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/reset`);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-reset',
      state: response.data.state,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error resetting simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Step simulation
app.post('/api/simulation/step', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${REALITY_ENGINE_URL}/api/simulation/step`);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-stepped',
      state: response.data.state,
      result: response.data.result,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error stepping simulation:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Set simulation speed
app.put('/api/simulation/speed', async (req: Request, res: Response) => {
  try {
    const response = await axios.put(`${REALITY_ENGINE_URL}/api/simulation/speed`, req.body);

    // Broadcast update to connected clients
    broadcast({
      type: 'simulation-speed-changed',
      delayMs: response.data.delayMs,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error setting simulation speed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Get simulation state
app.get('/api/simulation/state', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/simulation/state`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error getting simulation state:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Get simulation heatmap
app.get('/api/simulation/heatmap', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/simulation/heatmap`);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error getting simulation heatmap:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint: Load demo data
app.get('/api/demo/load', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/demo/load`);

    // Broadcast update to connected clients
    broadcast({
      type: 'demo-loaded',
      metadata: response.data.metadata,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading demo:', error.message);
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

// Proxy endpoint: Load NAND gate example
app.get('/api/demo/nand-gate', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/demo/nand-gate`);

    // Broadcast update to connected clients
    broadcast({
      type: 'demo-loaded',
      metadata: response.data.metadata,
      timestamp: Date.now()
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error loading NAND gate example:', error.message);
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

// ===== Machine Management Endpoints =====

// In-memory machine storage (for demo purposes - would use a database in production)
interface Machine {
  id: string;
  name: string;
  description: string;
  sequenceCount: number;
  totalVectors: number;
  sequenceIds: string[];
  sequences: Array<{ id: string; name: string }>;
  metadata: Record<string, any>;
  isExample: boolean;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number | null;
}

const machines: Map<string, Machine> = new Map();

// Initialize with example machines
function initializeExampleMachines() {
  const exampleMachines: Partial<Machine>[] = [
    {
      id: 'nand-gate-example',
      name: 'NAND Gate Logic',
      description: 'Critical event sequence modeling a NAND gate operation with truth table verification',
      isExample: true,
      metadata: { type: 'logic-gate', difficulty: 'beginner' }
    },
    {
      id: 'data-center-example',
      name: 'Data Center Monitoring',
      description: 'Multi-step sequence tracking server health, load balancing, and failover events',
      isExample: true,
      metadata: { type: 'infrastructure', difficulty: 'intermediate' }
    },
    {
      id: 'multi-step-example',
      name: 'Multi-Step Workflow',
      description: 'Complex sequence demonstrating cascading events and conditional transitions',
      isExample: true,
      metadata: { type: 'workflow', difficulty: 'advanced' }
    }
  ];

  exampleMachines.forEach((example) => {
    const machine: Machine = {
      id: example.id!,
      name: example.name!,
      description: example.description!,
      sequenceCount: 0,
      totalVectors: 0,
      sequenceIds: [],
      sequences: [],
      metadata: example.metadata || {},
      isExample: example.isExample!,
      createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      updatedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      lastAccessedAt: null
    };
    machines.set(machine.id, machine);
  });
}

initializeExampleMachines();

// Get all machines
app.get('/api/machines', async (req: Request, res: Response) => {
  try {
    // Fetch sequences from Reality Engine to populate machine stats
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/sequences`);
    const sequences = response.data.sequences;

    // Update example machines with current sequence data
    machines.forEach((machine) => {
      if (machine.isExample) {
        const machineSequences = sequences.filter((seq: any) =>
          seq.name.toLowerCase().includes(machine.name.toLowerCase().split(' ')[0])
        );
        machine.sequenceIds = machineSequences.map((seq: any) => seq.id);
        machine.sequences = machineSequences.map((seq: any) => ({ id: seq.id, name: seq.name }));
        machine.sequenceCount = machineSequences.length;
        machine.totalVectors = machineSequences.reduce((sum: number, seq: any) => sum + (seq.vectors?.length || 0), 0);
      }
    });

    const machineList = Array.from(machines.values());
    res.json({ machines: machineList });
  } catch (error: any) {
    console.error('Error fetching machines:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get specific machine
app.get('/api/machines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const machine = machines.get(id);

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    // Fetch updated sequence data
    const response = await axios.get(`${REALITY_ENGINE_URL}/api/sequences`);
    const sequences = response.data.sequences;

    const machineSequences = sequences.filter((seq: any) => machine.sequenceIds.includes(seq.id));
    machine.sequences = machineSequences.map((seq: any) => ({ id: seq.id, name: seq.name }));
    machine.sequenceCount = machineSequences.length;
    machine.totalVectors = machineSequences.reduce((sum: number, seq: any) => sum + (seq.vectors?.length || 0), 0);

    res.json({ machine });
  } catch (error: any) {
    console.error('Error fetching machine:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create new machine
app.post('/api/machines', async (req: Request, res: Response) => {
  try {
    const { name, description, sequenceIds = [], metadata = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Machine name is required' });
    }

    const id = `machine-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    const machine: Machine = {
      id,
      name,
      description: description || '',
      sequenceCount: sequenceIds.length,
      totalVectors: 0,
      sequenceIds,
      sequences: [],
      metadata,
      isExample: false,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: null
    };

    machines.set(id, machine);

    res.json({ machine });
  } catch (error: any) {
    console.error('Error creating machine:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update machine
app.put('/api/machines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const machine = machines.get(id);

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    const { name, description, sequenceIds, metadata } = req.body;

    if (name !== undefined) machine.name = name;
    if (description !== undefined) machine.description = description;
    if (sequenceIds !== undefined) {
      machine.sequenceIds = sequenceIds;
      machine.sequenceCount = sequenceIds.length;
    }
    if (metadata !== undefined) {
      machine.metadata = { ...machine.metadata, ...metadata };
      // Update lastAccessedAt if provided in metadata
      if (metadata.lastAccessedAt !== undefined) {
        machine.lastAccessedAt = metadata.lastAccessedAt;
      }
    }

    machine.updatedAt = Date.now();

    res.json({ machine });
  } catch (error: any) {
    console.error('Error updating machine:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete machine
app.delete('/api/machines/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const machine = machines.get(id);

    if (!machine) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    if (machine.isExample) {
      return res.status(403).json({ error: 'Cannot delete example machines' });
    }

    machines.delete(id);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting machine:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Reality Engine Visualizer Backend running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  console.log(`Proxying to Reality Engine at ${REALITY_ENGINE_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
