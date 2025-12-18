import axios from 'axios';
import { SequenceGraph, EngineStats, HistoryEntry } from './types';

const API_BASE_URL = '/api/viz';

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
  }
};
