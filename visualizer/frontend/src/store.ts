import { create } from 'zustand';
import {
  SequenceGraph,
  WebSocketMessage,
  Machine,
  OutputVector,
  MachineCreateRequest,
  MachineUpdateRequest,
} from './types';
import { api } from './api';

interface VisualizerState {
  // View state
  currentView: 'selection' | 'administration' | 'interconnection' | 'tobias';

  // Machine management
  machines: Machine[];
  currentMachineId: string | null;
  lastViewedMachineId: string | null;

  sequences: SequenceGraph[];
  currentMachine: Machine | null;

  // WebSocket
  ws: WebSocket | null;

  // Output stream state (used by MachineContainerView / CriticalEventGraphView)
  currentOutputVectors: OutputVector[];
  highlightedOutputId: string | null;

  // View actions
  setCurrentView: (view: 'selection' | 'administration' | 'interconnection' | 'tobias') => void;

  // Machine management actions
  setMachines: (machines: Machine[]) => void;
  loadMachine: (machineId: string) => Promise<void>;
  createMachine: (request: MachineCreateRequest) => Promise<Machine>;
  updateMachine: (machineId: string, request: MachineUpdateRequest) => Promise<void>;
  deleteMachine: (machineId: string) => Promise<void>;

  // Machine JSON actions
  listMachineJSONFiles: () => Promise<any[]>;
  loadMachineFromJSON: (name: string) => Promise<void>;
  importMachineJSON: (jsonString: string) => Promise<void>;
  exportMachineToJSON: (machineId: string, pretty?: boolean) => Promise<string>;

  // Demo loaders
  loadDataCenterExample: () => Promise<void>;
  loadMultiStepExample: () => Promise<void>;
  loadKleeneStarExample: () => Promise<void>;

  // WebSocket lifecycle
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;

  // Output stream actions
  setCurrentOutputVectors: (outputs: OutputVector[]) => void;
  setHighlightedOutputId: (outputId: string | null) => void;
}

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  // Initialization
  currentView: 'selection',
  machines: [],
  currentMachineId: null,
  lastViewedMachineId: localStorage.getItem('lastViewedMachineId'),
  sequences: [],
  currentMachine: null,
  ws: null,
  currentOutputVectors: [],
  highlightedOutputId: null,

  // View actions
  setCurrentView: (view) => set({ currentView: view }),

  // Machine management
  setMachines: (machines) => set({ machines }),

  loadMachine: async (machineId: string) => {
    try {
      const machine = await api.getMachine(machineId);
      set({
        currentMachine: machine,
        currentMachineId: machineId,
        lastViewedMachineId: machineId,
        currentView: 'administration',
        currentOutputVectors: []
      });

      localStorage.setItem('lastViewedMachineId', machineId);

      // Update last accessed timestamp (best-effort — PUT requires full machine JSON so this may
      // fail; wrap so it never aborts the sequence fetch below)
      try {
        await api.updateMachine(machineId, { metadata: { lastAccessedAt: Date.now() } });
      } catch { /* non-fatal */ }

      const sequences = await api.getSequences();
      set({ sequences });

      if (machine.isExample) {
        try {
          if (machineId === 'multi-step-example') {
            await get().loadMultiStepExample();
          } else if (machineId === 'data-center-example') {
            await get().loadDataCenterExample();
          } else if (machineId === 'kleene-star-example') {
            await get().loadKleeneStarExample();
          }
        } catch (error) {
          console.error('Could not load example data for machine:', error);
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
      set({ machines: [...get().machines, machine] });
      return machine;
    } catch (error) {
      console.error('Error creating machine:', error);
      throw error;
    }
  },

  updateMachine: async (machineId: string, request: MachineUpdateRequest) => {
    try {
      await api.updateMachine(machineId, request);
      const updated = get().machines.map(m =>
        m.id === machineId ? { ...m, ...request, updatedAt: Date.now() } : m
      );
      set({ machines: updated });

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
      set({ machines: get().machines.filter(m => m.id !== machineId) });

      if (get().currentMachineId === machineId) {
        set({ currentMachine: null, currentMachineId: null, currentView: 'selection' });
        localStorage.removeItem('lastViewedMachineId');
      }
    } catch (error) {
      console.error('Error deleting machine:', error);
      throw error;
    }
  },

  // Machine JSON actions
  listMachineJSONFiles: async () => {
    try {
      const response = await api.listMachineJSONFiles();
      return response.machines;
    } catch (error) {
      console.error('Error listing machine JSON files:', error);
      throw error;
    }
  },

  loadMachineFromJSON: async (name: string) => {
    try {
      const response = await api.loadMachineFromJSON(name);
      const machine = response.machine;

      const machines = get().machines;
      const existingIndex = machines.findIndex(m => m.id === machine.id);
      if (existingIndex >= 0) {
        machines[existingIndex] = machine;
        set({ machines: [...machines] });
      } else {
        set({ machines: [...machines, machine] });
      }

      await get().loadMachine(machine.id);
    } catch (error) {
      console.error('Error loading machine from JSON:', error);
      throw error;
    }
  },

  importMachineJSON: async (jsonString: string) => {
    try {
      const response = await api.importMachineJSON(jsonString);
      const machine = response.machine;
      set({ machines: [...get().machines, machine] });
      await get().loadMachine(machine.id);
    } catch (error) {
      console.error('Error importing machine JSON:', error);
      throw error;
    }
  },

  exportMachineToJSON: async (machineId: string, pretty: boolean = true) => {
    try {
      return await api.exportMachineToJSON(machineId, pretty);
    } catch (error) {
      console.error('Error exporting machine to JSON:', error);
      throw error;
    }
  },

  // Demo loaders
  loadDataCenterExample: async () => {
    try {
      await api.loadDataCenterExample();
      const sequences = await api.getSequences();
      set({ sequences });
    } catch (error) {
      console.error('Error loading data center example:', error);
    }
  },

  loadMultiStepExample: async () => {
    try {
      const result = await api.loadMultiStepExample();
      set({ currentMachine: result.machine || null });
      const sequences = await api.getSequences();
      set({ sequences });
    } catch (error) {
      console.error('Error loading multi-step sequences example:', error);
    }
  },

  loadKleeneStarExample: async () => {
    try {
      const result = await api.loadKleeneStarExample();
      set({ currentMachine: result.machine || null });
      const sequences = await api.getSequences();
      set({ sequences });
    } catch (error) {
      console.error('Error loading Kleene star example:', error);
    }
  },

  // WebSocket — used by MachineAdministrationView and MachineInterconnectionView
  connectWebSocket: () => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.hostname}:3001/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'perceptual-simulation-stepped': {
            const step = (message as any).step;
            if (step) {
              // Refresh sequences so CriticalEventGraphView sees live activation state
              // (isActive, wasJustMatched, lastOutputVector) from the engine.
              api.getSequences().then(sequences => {
                const newOutputs: OutputVector[] = [];
                for (const seq of sequences) {
                  for (const node of seq.nodes) {
                    if (node.wasJustMatched && node.lastOutputVector) {
                      newOutputs.push(node.lastOutputVector as OutputVector);
                    }
                  }
                }
                const updates: { sequences: SequenceGraph[]; currentOutputVectors?: OutputVector[] } = { sequences };
                if (newOutputs.length > 0) updates.currentOutputVectors = newOutputs;
                set(updates);
              }).catch(err => console.error('Error refreshing sequences after step:', err));
            }
            break;
          }

          case 'perceptual-simulation-reset':
            set({ currentOutputVectors: [] });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    (window as any).realityEngineWS = ws;
    set({ ws });
  },

  disconnectWebSocket: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      (window as any).realityEngineWS = null;
      set({ ws: null });
    }
  },

  // Output stream actions
  setCurrentOutputVectors: (outputs: OutputVector[]) => set({ currentOutputVectors: outputs }),
  setHighlightedOutputId: (outputId: string | null) => set({ highlightedOutputId: outputId }),
}));
