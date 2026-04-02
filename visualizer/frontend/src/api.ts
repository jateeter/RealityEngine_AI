import axios from 'axios';
import {
  SequenceGraph,
  Machine,
  MachineCreateRequest,
  MachineUpdateRequest
} from './types';

const API_BASE_URL = '/api/viz';
const PE_BASE_URL  = '/api/perception';

// Perception Engine API — controls the flow of inputs pushed into the Reality Engine
export const perceptionEngineApi = {
  async getState(): Promise<any> {
    const response = await axios.get(`${PE_BASE_URL}/state`);
    return response.data;
  },

  async push(): Promise<{ success: boolean; step?: any; globalStep: number; timestamp: number; error?: string }> {
    const response = await axios.post(`${PE_BASE_URL}/push`);
    return response.data;
  },

  async autoStart(intervalMs: number): Promise<{ success: boolean; intervalMs: number }> {
    const response = await axios.post(`${PE_BASE_URL}/auto/start`, { intervalMs });
    return response.data;
  },

  async autoStop(): Promise<{ success: boolean }> {
    const response = await axios.post(`${PE_BASE_URL}/auto/stop`);
    return response.data;
  },

  async reset(): Promise<{ success: boolean }> {
    const response = await axios.post(`${PE_BASE_URL}/reset`);
    return response.data;
  },
};

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

  // ===== Perceptual Space Simulation Methods =====

  // Append a chunk of vectors to the server-side staging buffer.
  // Set reset:true on the first call to start a new sequence.
  async appendSequenceChunk(payload: {
    vectors: number[][];
    reset?: boolean;
    inputRegion?: { offset: number; length: number };
    stepDelayMs?: number;
    maxSteps?: number;
  }): Promise<{ success: boolean; buffered: number }> {
    const response = await axios.post('/api/perceptual-simulation/configure/chunk', payload);
    return response.data;
  },

  // Commit the staged buffer into the PerceptualSpaceSimulator.
  async commitSequenceConfig(): Promise<{ success: boolean; committed: number; config: any }> {
    const response = await axios.post('/api/perceptual-simulation/configure/commit');
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

  // Load data center example
  async loadDataCenterExample(): Promise<{ success: boolean; metadata: any }> {
    const response = await axios.get('/api/demo/data-center');
    return response.data;
  },

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

};
