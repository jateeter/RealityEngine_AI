import axios from 'axios';
import {
  SequenceGraph,
  EngineStats,
  HistoryEntry,
  SimulationState,
  VectorActivation,
  TransitionResult,
  Machine,
  MachineCreateRequest,
  MachineUpdateRequest
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

  // Update sequence
  async updateSequence(id: string, data: any): Promise<void> {
    await axios.put(`${API_BASE_URL}/sequences/${id}`, data);
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

  // ===== Machine Methods =====

  // Get all machines
  async getMachines(): Promise<Machine[]> {
    const response = await axios.get('/api/machines');
    return response.data.machines;
  },

  // Get specific machine
  async getMachine(id: string): Promise<Machine> {
    const response = await axios.get(`/api/machines/${id}`);
    return response.data.machine;
  },

  // Create new machine
  async createMachine(request: MachineCreateRequest): Promise<Machine> {
    const response = await axios.post('/api/machines', request);
    return response.data.machine;
  },

  // Update machine
  async updateMachine(id: string, request: MachineUpdateRequest): Promise<Machine> {
    const response = await axios.put(`/api/machines/${id}`, request);
    return response.data.machine;
  },

  // Delete machine
  async deleteMachine(id: string): Promise<{ success: boolean }> {
    const response = await axios.delete(`/api/machines/${id}`);
    return response.data;
  },

  // ===== Machine JSON Methods =====

  // List available machine JSON files
  async listMachineJSONFiles(): Promise<{
    machines: Array<{
      filename: string;
      name: string;
      description: string;
      version: string;
      metadata: any;
      sequenceCount: number;
    }>;
  }> {
    const response = await axios.get('/api/machines/json/list');
    return response.data;
  },

  // Load machine from JSON file
  async loadMachineFromJSON(name: string): Promise<{
    success: boolean;
    machine: Machine;
    message: string;
  }> {
    const response = await axios.get(`/api/machines/json/${name}`);
    return response.data;
  },

  // Import machine from JSON string
  async importMachineJSON(jsonString: string): Promise<{
    success: boolean;
    machine: Machine;
    message: string;
  }> {
    const response = await axios.post('/api/machines/json/import', { json: jsonString });
    return response.data;
  },

  // Export machine to JSON
  async exportMachineToJSON(id: string, pretty: boolean = true): Promise<string> {
    const response = await axios.get(`/api/machines/${id}/export?pretty=${pretty}`, {
      responseType: 'text'
    });
    return response.data;
  },

  // ===== Simulation Methods =====

  // Load simulation vectors
  async loadSimulation(vectors: number[][], options?: {
    autoPlayDelayMs?: number;
    loop?: boolean;
    machineId?: string;  // Machine ID for perceptual space mode
    usePerceptualSpace?: boolean;  // Explicit flag for perceptual space mode
  }): Promise<{ success: boolean; state: SimulationState; mode?: string }> {
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
    inputVectors?: number[][];
  }> {
    const response = await axios.get(SIMULATION_API_BASE + '/state');
    return response.data;
  },

  // Get activation heatmap
  async getSimulationHeatmap(): Promise<{ heatmap: VectorActivation[] }> {
    const response = await axios.get(SIMULATION_API_BASE + '/heatmap');
    return response.data;
  },

  // ===== Perceptual Space Simulation Methods =====

  // Configure perceptual space simulation
  async configurePerceptualSimulation(config: {
    inputSequence: number[][];
    inputRegion: { offset: number; length: number };
    stepDelayMs: number;
    maxSteps?: number;
  }): Promise<{ success: boolean; config: any }> {
    const response = await axios.post('/api/perceptual-simulation/configure', config);
    return response.data;
  },

  // Start perceptual simulation
  async startPerceptualSimulation(): Promise<{ success: boolean; state: any }> {
    const response = await axios.post('/api/perceptual-simulation/start');
    return response.data;
  },

  // Stop perceptual simulation
  async stopPerceptualSimulation(): Promise<{ success: boolean }> {
    const response = await axios.post('/api/perceptual-simulation/stop');
    return response.data;
  },

  // Step perceptual simulation
  async stepPerceptualSimulation(): Promise<{
    success: boolean;
    step: any;
    isComplete: boolean;
  }> {
    const response = await axios.post('/api/perceptual-simulation/step');
    return response.data;
  },

  // Reset perceptual simulation
  async resetPerceptualSimulation(): Promise<{ success: boolean }> {
    const response = await axios.post('/api/perceptual-simulation/reset');
    return response.data;
  },

  // Get perceptual simulation state
  async getPerceptualSimulationState(): Promise<{
    isRunning: boolean;
    currentStep: number;
    config: any;
    perceptualSpaceDimension: number;
  }> {
    const response = await axios.get('/api/perceptual-simulation/state');
    return response.data;
  },

  // Get perceptual simulation history
  async getPerceptualSimulationHistory(): Promise<{ history: any[] }> {
    const response = await axios.get('/api/perceptual-simulation/history');
    return response.data;
  },

  // Load demo dataset
  async loadDemo(): Promise<{ success: boolean; metadata: any }> {
    const response = await axios.get('/api/demo/load');
    return response.data;
  },

  // Load data center example
  async loadDataCenterExample(): Promise<{ success: boolean; metadata: any }> {
    const response = await axios.get('/api/demo/data-center');
    return response.data;
  },

  // DISABLED: NAND gate example removed
  // async loadNANDGateExample(): Promise<{ success: boolean; metadata: any }> {
  //   const response = await axios.get('/api/demo/nand-gate');
  //   return response.data;
  // },

  // Load multi-step sequences example
  async loadMultiStepExample(): Promise<{ success: boolean; metadata: any; machine?: any }> {
    const response = await axios.get('/api/demo/multi-step');
    return response.data;
  },

  // Load Kleene star example
  async loadKleeneStarExample(): Promise<{ success: boolean; metadata: any; machine?: any }> {
    const response = await axios.get('/api/demo/kleene-star');
    return response.data;
  },

  // Load RS Flip Flop example
  async loadRSFlipFlopExample(): Promise<{ success: boolean; metadata: any; machine?: any }> {
    const response = await axios.get('/api/demo/rs-flip-flop');
    return response.data;
  },

  // Load RS2 example
  async loadRS2Example(): Promise<{ success: boolean; metadata: any; machine?: any }> {
    const response = await axios.get('/api/demo/rs2');
    return response.data;
  }
};
