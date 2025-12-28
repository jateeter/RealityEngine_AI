import axios from 'axios';
import {
  SequenceGraph,
  EngineStats,
  HistoryEntry,
  SimulationState,
  VectorActivation,
  DemoDataset,
  TransitionResult
} from './types';

const API_BASE_URL = '/api/viz';
const SIMULATION_API_BASE = '/api/simulation';

export const api = {
  // Get all sequences with graph data
  async getSequences(): Promise<SequenceGraph[]> {
    const response = await axios.get(`${API_BASE_URL}/sequences`);
    return response.data.sequences;
  },

  // Get specific sequence graph
  async getSequence(id: string): Promise<SequenceGraph> {
    const response = await axios.get(`${API_BASE_URL}/sequences/${id}`);
    return response.data;
  },

  // Get engine stats
  async getStats(): Promise<EngineStats> {
    const response = await axios.get(`${API_BASE_URL}/stats`);
    return response.data.stats;
  },

  // Get active vectors
  async getActiveVectors(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/active`);
    return response.data.activeVectors;
  },

  // Get history
  async getHistory(limit?: number): Promise<HistoryEntry[]> {
    const url = limit
      ? `${API_BASE_URL}/history?limit=${limit}`
      : `${API_BASE_URL}/history`;
    const response = await axios.get(url);
    return response.data.history;
  },

  // Reset sequence
  async resetSequence(id: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/sequences/${id}/reset`);
    return response.data;
  },

  // Process input
  async processInput(vector: number[]): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/process`, { vector });
    return response.data;
  },

  // Poll for updates
  async poll(): Promise<{ hasChanges: boolean; lastUpdateTime: number; timestamp: number }> {
    const response = await axios.get(`${API_BASE_URL}/poll`);
    return response.data;
  },

  // ===== Simulation Methods =====

  // Load simulation vectors
  async loadSimulation(vectors: number[][], options?: {
    autoPlayDelayMs?: number;
    loop?: boolean;
  }): Promise<{ success: boolean; state: SimulationState }> {
    const response = await axios.post(SIMULATION_API_BASE + '/load', {
      vectors,
      ...options
    });
    return response.data;
  },

  // Start auto-play
  async startSimulation(): Promise<{ success: boolean; state: SimulationState }> {
    const response = await axios.post(SIMULATION_API_BASE + '/start');
    return response.data;
  },

  // Pause simulation
  async pauseSimulation(): Promise<{ success: boolean; state: SimulationState }> {
    const response = await axios.post(SIMULATION_API_BASE + '/pause');
    return response.data;
  },

  // Resume simulation
  async resumeSimulation(): Promise<{ success: boolean; state: SimulationState }> {
    const response = await axios.post(SIMULATION_API_BASE + '/resume');
    return response.data;
  },

  // Stop simulation
  async stopSimulation(): Promise<{ success: boolean; state: SimulationState }> {
    const response = await axios.post(SIMULATION_API_BASE + '/stop');
    return response.data;
  },

  // Reset simulation
  async resetSimulation(): Promise<{ success: boolean; state: SimulationState }> {
    const response = await axios.post(SIMULATION_API_BASE + '/reset');
    return response.data;
  },

  // Execute single step
  async stepSimulation(): Promise<{
    success: boolean;
    state: SimulationState;
    result: TransitionResult | null;
  }> {
    const response = await axios.post(SIMULATION_API_BASE + '/step');
    return response.data;
  },

  // Set playback speed
  async setSimulationSpeed(delayMs: number): Promise<{ success: boolean; delayMs: number }> {
    const response = await axios.put(SIMULATION_API_BASE + '/speed', { delayMs });
    return response.data;
  },

  // Get simulation state
  async getSimulationState(): Promise<{
    state: SimulationState;
    progress: number;
  }> {
    const response = await axios.get(SIMULATION_API_BASE + '/state');
    return response.data;
  },

  // Get activation heatmap
  async getSimulationHeatmap(): Promise<{ heatmap: VectorActivation[] }> {
    const response = await axios.get(SIMULATION_API_BASE + '/heatmap');
    return response.data;
  },

  // Load demo dataset
  async loadDemo(): Promise<{ success: boolean; metadata: any }> {
    const response = await axios.get('/api/demo/load');
    return response.data;
  }
};
