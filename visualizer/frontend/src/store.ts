import { create } from 'zustand';
import {
  SequenceGraph,
  EngineStats,
  HistoryEntry,
  SimulationState,
  VectorActivation,
  ActivityEvent,
  WebSocketMessage
} from './types';
import { api } from './api';

interface VisualizerState {
  sequences: SequenceGraph[];
  selectedSequenceId: string | null;
  stats: EngineStats | null;
  history: HistoryEntry[];
  isConnected: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  zoomLevel: number;

  // Simulation state
  simulationState: SimulationState | null;
  simulationProgress: number;
  inputVectors: number[][];
  heatmapData: VectorActivation[];
  activityEvents: ActivityEvent[];
  isDemoLoaded: boolean;
  demoMetadata: any | null;
  ws: WebSocket | null;
  isHeatmapEnabled: boolean;

  setSequences: (sequences: SequenceGraph[]) => void;
  setSelectedSequence: (id: string | null) => void;
  setStats: (stats: EngineStats) => void;
  setHistory: (history: HistoryEntry[]) => void;
  setConnected: (connected: boolean) => void;
  setAutoRefresh: (auto: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  setZoomLevel: (zoom: number) => void;

  // Simulation methods
  loadSimulation: (vectors: number[][], options?: { autoPlayDelayMs?: number; loop?: boolean }) => Promise<void>;
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  stepSimulation: () => Promise<void>;
  setSimulationSpeed: (delayMs: number) => Promise<void>;
  refreshSimulationState: () => Promise<void>;
  refreshHeatmap: () => Promise<void>;
  loadDemo: () => Promise<void>;
  loadDataCenterExample: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  addActivityEvent: (event: ActivityEvent) => void;
  clearActivityEvents: () => void;
  toggleHeatmap: () => void;
}

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  sequences: [],
  selectedSequenceId: null,
  stats: null,
  history: [],
  isConnected: false,
  autoRefresh: true,
  refreshInterval: 2000,
  zoomLevel: 1,

  // Simulation state initialization
  simulationState: null,
  simulationProgress: 0,
  inputVectors: [],
  heatmapData: [],
  activityEvents: [],
  isDemoLoaded: false,
  demoMetadata: null,
  ws: null,
  isHeatmapEnabled: false,

  setSequences: (sequences) => set({ sequences }),
  setSelectedSequence: (id) => set({ selectedSequenceId: id }),
  setStats: (stats) => set({ stats }),
  setHistory: (history) => set({ history }),
  setConnected: (connected) => set({ isConnected: connected }),
  setAutoRefresh: (auto) => set({ autoRefresh: auto }),
  setRefreshInterval: (interval) => set({ refreshInterval: interval }),
  setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

  // Simulation methods implementation
  loadSimulation: async (vectors, options) => {
    try {
      const result = await api.loadSimulation(vectors, options);
      set({
        inputVectors: vectors,
        simulationState: result.state,
        simulationProgress: 0,
        activityEvents: []
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Loaded ${vectors.length} input vectors`,
        timestamp: Date.now(),
        severity: 'info'
      });
    } catch (error) {
      console.error('Error loading simulation:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load simulation',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  startSimulation: async () => {
    try {
      const result = await api.startSimulation();
      set({ simulationState: result.state });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Simulation started',
        timestamp: Date.now(),
        severity: 'success'
      });
    } catch (error) {
      console.error('Error starting simulation:', error);
    }
  },

  pauseSimulation: async () => {
    try {
      const result = await api.pauseSimulation();
      set({ simulationState: result.state });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Simulation paused',
        timestamp: Date.now(),
        severity: 'warning'
      });
    } catch (error) {
      console.error('Error pausing simulation:', error);
    }
  },

  resumeSimulation: async () => {
    try {
      const result = await api.resumeSimulation();
      set({ simulationState: result.state });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Simulation resumed',
        timestamp: Date.now(),
        severity: 'success'
      });
    } catch (error) {
      console.error('Error resuming simulation:', error);
    }
  },

  stopSimulation: async () => {
    try {
      const result = await api.stopSimulation();
      set({ simulationState: result.state });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Simulation stopped',
        timestamp: Date.now(),
        severity: 'warning'
      });
    } catch (error) {
      console.error('Error stopping simulation:', error);
    }
  },

  resetSimulation: async () => {
    try {
      const result = await api.resetSimulation();
      set({
        simulationState: result.state,
        simulationProgress: 0,
        activityEvents: []
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Simulation reset',
        timestamp: Date.now(),
        severity: 'info'
      });
    } catch (error) {
      console.error('Error resetting simulation:', error);
    }
  },

  stepSimulation: async () => {
    try {
      const result = await api.stepSimulation();
      set({ simulationState: result.state });

      if (result.result) {
        const { sequenceResults, totalOutputs } = result.result;
        const matchedCount = Object.values(sequenceResults).filter((r: any) => r.matched).length;

        get().addActivityEvent({
          id: `event-${Date.now()}`,
          type: 'vector-processed',
          message: `Vector #${result.state.currentIndex} processed → ${matchedCount} sequences matched`,
          timestamp: Date.now(),
          severity: 'info',
          metadata: { result: result.result }
        });

        if (totalOutputs.length > 0) {
          get().addActivityEvent({
            id: `event-${Date.now()}-outputs`,
            type: 'output-asserted',
            message: `${totalOutputs.length} outputs asserted`,
            timestamp: Date.now(),
            severity: 'success',
            metadata: { outputs: totalOutputs }
          });
        }
      }

      await get().refreshHeatmap();
    } catch (error) {
      console.error('Error stepping simulation:', error);
    }
  },

  setSimulationSpeed: async (delayMs) => {
    try {
      await api.setSimulationSpeed(delayMs);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Playback speed set to ${delayMs}ms`,
        timestamp: Date.now(),
        severity: 'info'
      });
    } catch (error) {
      console.error('Error setting simulation speed:', error);
    }
  },

  refreshSimulationState: async () => {
    try {
      const result = await api.getSimulationState();
      set({
        simulationState: result.state,
        simulationProgress: result.progress
      });
    } catch (error) {
      console.error('Error refreshing simulation state:', error);
    }
  },

  refreshHeatmap: async () => {
    try {
      const result = await api.getSimulationHeatmap();
      set({ heatmapData: result.heatmap });
    } catch (error) {
      console.error('Error refreshing heatmap:', error);
    }
  },

  loadDemo: async () => {
    try {
      const result = await api.loadDemo();
      set({
        isDemoLoaded: true,
        demoMetadata: result.metadata
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Demo dataset loaded',
        timestamp: Date.now(),
        severity: 'success',
        metadata: result.metadata
      });

      // Refresh sequences after loading demo
      const sequences = await api.getSequences();
      set({ sequences });
    } catch (error) {
      console.error('Error loading demo:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load demo dataset',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  loadDataCenterExample: async () => {
    try {
      const result = await api.loadDataCenterExample();
      set({
        isDemoLoaded: true,
        demoMetadata: result.metadata
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'Data Center Example loaded',
        timestamp: Date.now(),
        severity: 'success',
        metadata: result.metadata
      });

      // Refresh sequences after loading example
      const sequences = await api.getSequences();
      set({ sequences });
    } catch (error) {
      console.error('Error loading data center example:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load data center example',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  connectWebSocket: () => {
    const wsUrl = `ws://${window.location.hostname}:3001/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      set({ isConnected: true });
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      set({ isConnected: false });
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Handle different message types
        switch (message.type) {
          case 'simulation-started':
          case 'simulation-paused':
          case 'simulation-resumed':
          case 'simulation-stopped':
          case 'simulation-reset':
            if (message.state) {
              set({ simulationState: message.state });
            }
            break;

          case 'simulation-stepped':
            if (message.state) {
              set({ simulationState: message.state });
            }
            if (message.result) {
              get().refreshHeatmap();
            }
            break;

          case 'simulation-loaded':
          case 'demo-loaded':
            get().refreshSimulationState();
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    set({ ws });
  },

  disconnectWebSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },

  addActivityEvent: (event) => {
    set((state) => ({
      activityEvents: [event, ...state.activityEvents].slice(0, 100) // Keep last 100 events
    }));
  },

  clearActivityEvents: () => {
    set({ activityEvents: [] });
  },

  toggleHeatmap: () => {
    set((state) => ({ isHeatmapEnabled: !state.isHeatmapEnabled }));
  }
}));
