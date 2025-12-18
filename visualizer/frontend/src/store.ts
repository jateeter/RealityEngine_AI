import { create } from 'zustand';
import { SequenceGraph, EngineStats, HistoryEntry } from './types';

interface VisualizerState {
  sequences: SequenceGraph[];
  selectedSequenceId: string | null;
  stats: EngineStats | null;
  history: HistoryEntry[];
  isConnected: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  zoomLevel: number;

  setSequences: (sequences: SequenceGraph[]) => void;
  setSelectedSequence: (id: string | null) => void;
  setStats: (stats: EngineStats) => void;
  setHistory: (history: HistoryEntry[]) => void;
  setConnected: (connected: boolean) => void;
  setAutoRefresh: (auto: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setZoomLevel: (zoom: number) => void;
}

export const useVisualizerStore = create<VisualizerState>((set) => ({
  sequences: [],
  selectedSequenceId: null,
  stats: null,
  history: [],
  isConnected: false,
  autoRefresh: true,
  refreshInterval: 2000,
  zoomLevel: 1,

  setSequences: (sequences) => set({ sequences }),
  setSelectedSequence: (id) => set({ selectedSequenceId: id }),
  setStats: (stats) => set({ stats }),
  setHistory: (history) => set({ history }),
  setConnected: (connected) => set({ isConnected: connected }),
  setAutoRefresh: (auto) => set({ autoRefresh: auto }),
  setRefreshInterval: (interval) => set({ refreshInterval: interval }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom })
}));
