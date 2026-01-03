import { create } from 'zustand';
import {
  SequenceGraph,
  EngineStats,
  HistoryEntry,
  SimulationState,
  VectorActivation,
  ActivityEvent,
  WebSocketMessage,
  Machine,
  OutputVector,
  MachineCreateRequest,
  MachineUpdateRequest
} from './types';
import { api } from './api';

interface VisualizerState {
  // View state
  currentView: 'selection' | 'administration';

  // Machine management
  machines: Machine[];
  currentMachineId: string | null;
  lastViewedMachineId: string | null;

  // UI state
  isFloatingPanelExpanded: boolean;
  floatingPanelActiveTab: 'overview' | 'simulation' | 'sequences' | 'settings';

  sequences: SequenceGraph[];
  selectedSequenceId: string | null;
  currentMachine: Machine | null;
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

  // Machine View state
  expandedSequenceIds: Set<string>;
  currentOutputVectors: OutputVector[];

  // View actions
  setCurrentView: (view: 'selection' | 'administration') => void;

  // Machine management actions
  setMachines: (machines: Machine[]) => void;
  loadMachine: (machineId: string) => Promise<void>;
  createMachine: (request: MachineCreateRequest) => Promise<Machine>;
  updateMachine: (machineId: string, request: MachineUpdateRequest) => Promise<void>;
  deleteMachine: (machineId: string) => Promise<void>;

  // UI actions
  toggleFloatingPanel: () => void;
  setFloatingPanelTab: (tab: 'overview' | 'simulation' | 'sequences' | 'settings') => void;

  setSequences: (sequences: SequenceGraph[]) => void;
  setSelectedSequence: (id: string | null) => void;
  setCurrentMachine: (machine: Machine | null) => void;
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
  loadNANDGateExample: () => Promise<void>;
  loadMultiStepExample: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  addActivityEvent: (event: ActivityEvent) => void;
  clearActivityEvents: () => void;
  toggleHeatmap: () => void;

  // Machine View actions
  toggleSequenceExpansion: (sequenceId: string) => void;
  expandAllSequences: () => void;
  collapseAllSequences: () => void;
  setCurrentOutputVectors: (outputs: OutputVector[]) => void;
}

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  // View state initialization
  currentView: 'selection',

  // Machine management initialization
  machines: [],
  currentMachineId: null,
  lastViewedMachineId: localStorage.getItem('lastViewedMachineId'),

  // UI state initialization
  isFloatingPanelExpanded: false,
  floatingPanelActiveTab: 'overview',

  sequences: [],
  selectedSequenceId: null,
  currentMachine: null,
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

  // Machine View state initialization
  expandedSequenceIds: new Set<string>(),
  currentOutputVectors: [],

  // View actions implementation
  setCurrentView: (view) => set({ currentView: view }),

  // Machine management actions implementation
  setMachines: (machines) => set({ machines }),

  loadMachine: async (machineId: string) => {
    try {
      const machine = await api.getMachine(machineId);
      set({
        currentMachine: machine,
        currentMachineId: machineId,
        lastViewedMachineId: machineId,
        currentView: 'administration'
      });

      // Store in localStorage
      localStorage.setItem('lastViewedMachineId', machineId);

      // Update last accessed timestamp
      await api.updateMachine(machineId, { metadata: { lastAccessedAt: Date.now() } });

      // Load sequences for this machine
      const sequences = await api.getSequences();
      set({ sequences });

      // Automatically load simulation vectors for example machines
      if (machine.isExample) {
        try {
          // Load the appropriate example based on machine ID
          if (machineId === 'multi-step-example') {
            await get().loadMultiStepExample();
          } else if (machineId === 'nand-gate-example') {
            await get().loadNANDGateExample();
          } else if (machineId === 'data-center-example') {
            await get().loadDataCenterExample();
          }
        } catch (error) {
          console.log('Could not load example data for machine:', error);
        }
      }
    } catch (error) {
      console.error('Error loading machine:', error);
      throw error;
    }
  },

  createMachine: async (request: MachineCreateRequest) => {
    try {
      const machine = await api.createMachine(request);
      const machines = get().machines;
      set({ machines: [...machines, machine] });
      return machine;
    } catch (error) {
      console.error('Error creating machine:', error);
      throw error;
    }
  },

  updateMachine: async (machineId: string, request: MachineUpdateRequest) => {
    try {
      await api.updateMachine(machineId, request);
      const machines = get().machines;
      const updatedMachines = machines.map(m =>
        m.id === machineId ? { ...m, ...request, updatedAt: Date.now() } : m
      );
      set({ machines: updatedMachines });

      // If updating current machine, refresh it
      if (get().currentMachineId === machineId) {
        const machine = await api.getMachine(machineId);
        set({ currentMachine: machine });
      }
    } catch (error) {
      console.error('Error updating machine:', error);
      throw error;
    }
  },

  deleteMachine: async (machineId: string) => {
    try {
      await api.deleteMachine(machineId);
      const machines = get().machines;
      set({ machines: machines.filter(m => m.id !== machineId) });

      // If deleting current machine, navigate to selection
      if (get().currentMachineId === machineId) {
        set({
          currentMachine: null,
          currentMachineId: null,
          currentView: 'selection'
        });
        localStorage.removeItem('lastViewedMachineId');
      }
    } catch (error) {
      console.error('Error deleting machine:', error);
      throw error;
    }
  },

  // UI actions implementation
  toggleFloatingPanel: () => {
    set((state) => ({ isFloatingPanelExpanded: !state.isFloatingPanelExpanded }));
  },

  setFloatingPanelTab: (tab) => {
    set({ floatingPanelActiveTab: tab, isFloatingPanelExpanded: true });
  },

  setSequences: (sequences) => set({ sequences }),
  setSelectedSequence: (id) => set({ selectedSequenceId: id }),
  setCurrentMachine: (machine) => set({ currentMachine: machine }),
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

        // Store current outputs for Machine View
        set({ currentOutputVectors: totalOutputs });

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
        simulationProgress: result.progress,
        inputVectors: result.inputVectors || []
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

  loadNANDGateExample: async () => {
    try {
      const result = await api.loadNANDGateExample();
      set({
        isDemoLoaded: true,
        demoMetadata: result.metadata
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: 'NAND Gate Example loaded',
        timestamp: Date.now(),
        severity: 'success',
        metadata: result.metadata
      });

      // Refresh sequences after loading example
      const sequences = await api.getSequences();
      set({ sequences });
    } catch (error) {
      console.error('Error loading NAND gate example:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load NAND gate example',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  loadMultiStepExample: async () => {
    try {
      const result = await api.loadMultiStepExample();
      set({
        isDemoLoaded: true,
        demoMetadata: result.metadata,
        currentMachine: result.machine || null
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Machine loaded: ${result.machine?.name || 'Multi-Step Sequences'}`,
        timestamp: Date.now(),
        severity: 'success',
        metadata: result.metadata
      });

      // Refresh sequences after loading example
      const sequences = await api.getSequences();
      set({ sequences });

      // Refresh simulation state to load input vectors
      await get().refreshSimulationState();
    } catch (error) {
      console.error('Error loading multi-step sequences example:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load multi-step sequences example',
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
  },

  // Machine View actions implementation
  toggleSequenceExpansion: (sequenceId: string) => {
    set((state) => {
      const newSet = new Set(state.expandedSequenceIds);
      if (newSet.has(sequenceId)) {
        newSet.delete(sequenceId);
      } else {
        // Limit to 3 simultaneous expansions for performance
        if (newSet.size >= 3) {
          const firstId = newSet.values().next().value;
          if (firstId !== undefined) {
            newSet.delete(firstId);
          }
        }
        newSet.add(sequenceId);
      }
      return { expandedSequenceIds: newSet };
    });
  },

  expandAllSequences: () => {
    const { sequences } = get();
    const allIds = sequences.map(seq => seq.sequenceId);
    set({ expandedSequenceIds: new Set(allIds) });
  },

  collapseAllSequences: () => {
    set({ expandedSequenceIds: new Set<string>() });
  },

  setCurrentOutputVectors: (outputs: OutputVector[]) => {
    set({ currentOutputVectors: outputs });
  }
}));
