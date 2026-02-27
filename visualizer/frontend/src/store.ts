import { create } from 'zustand';
import {
  SequenceGraph,
  SimulationState,
  ActivityEvent,
  WebSocketMessage,
  Machine,
  OutputVector,
  MachineCreateRequest,
  MachineUpdateRequest,
  VectorSequenceItem
} from './types';
import { api } from './api';
import { perceptualLogger, calculateVectorStats } from './utils/perceptualSequenceLogger';

interface VisualizerState {
  // View state
  currentView: 'selection' | 'administration' | 'interconnection' | 'tobias';

  // Machine management
  machines: Machine[];
  currentMachineId: string | null;
  lastViewedMachineId: string | null;

  sequences: SequenceGraph[];
  currentMachine: Machine | null;

  // Simulation state
  simulationState: SimulationState | null;
  inputVectors: number[][];
  activityEvents: ActivityEvent[];
  ws: WebSocket | null;

  // Perceptual Input/Output Sequences (FIFO queues)
  inputQueue: VectorSequenceItem[];
  outputQueue: VectorSequenceItem[];
  currentInputVector: number[] | null;

  // Machine View state
  expandedSequenceIds: Set<string>;
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

  // Simulation methods
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  stepSimulation: () => Promise<void>;
  setSimulationSpeed: (delayMs: number) => Promise<void>;
  refreshSimulationState: () => Promise<void>;
  loadDataCenterExample: () => Promise<void>;
  loadMultiStepExample: () => Promise<void>;
  loadKleeneStarExample: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  addActivityEvent: (event: ActivityEvent) => void;
  clearActivityEvents: () => void;

  // Machine View actions
  toggleSequenceExpansion: (sequenceId: string) => void;
  expandAllSequences: () => void;
  collapseAllSequences: () => void;
  setCurrentOutputVectors: (outputs: OutputVector[]) => void;
  setHighlightedOutputId: (outputId: string | null) => void;

  // Perceptual Input/Output Queue actions
  addToInputQueue: (item: VectorSequenceItem) => void;
  addMultipleToInputQueue: (items: VectorSequenceItem[]) => void;
  popFromInputQueue: () => VectorSequenceItem | null;
  removeFromInputQueue: (id: string) => void;
  clearInputQueue: () => void;
  addToOutputQueue: (item: VectorSequenceItem) => void;
  removeFromOutputQueue: (id: string) => void;
  clearOutputQueue: () => void;
  setCurrentInputVector: (vector: number[] | null) => void;
  generateAlgorithmicSequence: (pattern: string, count: number) => Promise<void>;
  generateRandomSequence: (count: number, region: { offset: number; length: number }) => Promise<void>;
  loadQueueIntoSimulation: () => Promise<void>;
}

export const useVisualizerStore = create<VisualizerState>((set, get) => ({
  // View state initialization
  currentView: 'selection',

  // Machine management initialization
  machines: [],
  currentMachineId: null,
  lastViewedMachineId: localStorage.getItem('lastViewedMachineId'),

  sequences: [],
  currentMachine: null,

  // Simulation state initialization
  simulationState: null,
  inputVectors: [],
  activityEvents: [],
  ws: null,

  // Perceptual Input/Output Queue initialization
  inputQueue: [],
  outputQueue: [],
  currentInputVector: null,

  // Machine View state initialization
  expandedSequenceIds: new Set<string>(),
  currentOutputVectors: [],
  highlightedOutputId: null,

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
        currentView: 'administration',
        currentOutputVectors: []
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

  // Machine JSON actions implementation
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

      // Add to machines list
      const machines = get().machines;
      const existingIndex = machines.findIndex(m => m.id === machine.id);

      if (existingIndex >= 0) {
        // Update existing machine
        machines[existingIndex] = machine;
        set({ machines: [...machines] });
      } else {
        // Add new machine
        set({ machines: [...machines, machine] });
      }

      // Automatically load the machine
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

      // Add to machines list
      const machines = get().machines;
      set({ machines: [...machines, machine] });

      // Automatically load the imported machine
      await get().loadMachine(machine.id);
    } catch (error) {
      console.error('Error importing machine JSON:', error);
      throw error;
    }
  },

  exportMachineToJSON: async (machineId: string, pretty: boolean = true) => {
    try {
      const jsonString = await api.exportMachineToJSON(machineId, pretty);
      return jsonString;
    } catch (error) {
      console.error('Error exporting machine to JSON:', error);
      throw error;
    }
  },


  startSimulation: async () => {
    try {
      await api.startPerceptualSimulation();
      const { inputVectors, simulationState } = get();
      set({
        simulationState: {
          status: 'playing',
          currentIndex: simulationState?.currentIndex ?? 0,
          totalVectors: inputVectors.length,
          startTime: Date.now(),
          lastStepTime: simulationState?.lastStepTime ?? null
        }
      });

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
      await api.stopPerceptualSimulation();
      const current = get().simulationState;
      set({
        simulationState: current ? { ...current, status: 'paused' } : null
      });

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
      await api.startPerceptualSimulation();
      const current = get().simulationState;
      set({
        simulationState: current ? { ...current, status: 'playing' } : null
      });

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

  resetSimulation: async () => {
    try {
      await api.resetPerceptualSimulation();
      set({
        simulationState: {
          status: 'stopped',
          currentIndex: 0,
          totalVectors: 0,
          startTime: null,
          lastStepTime: null
        },
        activityEvents: [],
        currentOutputVectors: []
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
      const result = await api.stepPerceptualSimulation();
      const current = get().simulationState;
      const stepNumber = result.step?.stepNumber ?? (current?.currentIndex ?? 0) + 1;
      set({
        simulationState: current ? {
          ...current,
          status: result.isComplete ? 'stopped' : current.status,
          currentIndex: stepNumber,
          lastStepTime: Date.now()
        } : null
      });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'vector-processed',
        message: `Perceptual step #${stepNumber} processed${result.isComplete ? ' — sequence complete' : ''}`,
        timestamp: Date.now(),
        severity: 'info',
        metadata: { step: result.step }
      });
    } catch (error) {
      console.error('Error stepping simulation:', error);
    }
  },

  setSimulationSpeed: async (delayMs) => {
    try {
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
      const result = await api.getPerceptualSimulationState();
      const { inputVectors } = get();
      set({
        simulationState: {
          status: result.isRunning ? 'playing' : 'stopped',
          currentIndex: result.currentStep ?? 0,
          totalVectors: inputVectors.length,
          startTime: result.isRunning ? Date.now() : null,
          lastStepTime: null
        }
      });
    } catch (error) {
      console.error('Error refreshing simulation state:', error);
    }
  },

  loadDataCenterExample: async () => {
    try {
      const result = await api.loadDataCenterExample();

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

  loadMultiStepExample: async () => {
    try {
      const result = await api.loadMultiStepExample();
      set({ currentMachine: result.machine || null });

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

  loadKleeneStarExample: async () => {
    try {
      const result = await api.loadKleeneStarExample();
      set({ currentMachine: result.machine || null });

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Machine loaded: ${result.machine?.name || '* Operator Test'}`,
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
      console.error('Error loading Kleene star example:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load Kleene star example',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  connectWebSocket: () => {
    const wsUrl = `ws://${window.location.hostname}:3001/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {};

    ws.onclose = () => {};

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        // Handle different message types
        switch (message.type) {
          case 'demo-loaded':
            get().refreshSimulationState();
            break;

          case 'perceptual-simulation-stepped': {
            const step = (message as any).step;
            if (step) {
              const current = get().simulationState;
              set({
                simulationState: current ? {
                  ...current,
                  currentIndex: step.stepNumber ?? current.currentIndex,
                  lastStepTime: Date.now()
                } : null
              });
            }
            break;
          }

          case 'perceptual-simulation-reset':
            set({
              simulationState: {
                status: 'stopped',
                currentIndex: 0,
                totalVectors: 0,
                startTime: null,
                lastStepTime: null
              },
              currentOutputVectors: []
            });
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
      set({ ws: null });
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
  },

  setHighlightedOutputId: (outputId: string | null) => {
    set({ highlightedOutputId: outputId });
  },

  // Perceptual Input/Output Queue actions implementation
  addToInputQueue: (item: VectorSequenceItem) => {
    const stats = calculateVectorStats(item.vector);

    perceptualLogger.info('input-queue-add', `Added vector to input queue: ${item.id}`, {
      queueType: 'input',
      itemId: item.id,
      vectorDimension: item.vector.length,
      vectorSource: item.source,
      vectorNonZeroCount: stats.nonZeroCount,
      vectorMean: stats.mean,
      vectorStdDev: stats.stdDev,
      queueLength: get().inputQueue.length + 1
    });

    set((state) => ({
      inputQueue: [...state.inputQueue, item]
    }));
  },

  addMultipleToInputQueue: (items: VectorSequenceItem[]) => {
    perceptualLogger.info('input-queue-add-bulk', `Added ${items.length} vectors to input queue`, {
      queueType: 'input',
      itemsAdded: items.length,
      queueLength: get().inputQueue.length + items.length,
      vectorSources: items.map(item => item.source),
      vectorIds: items.map(item => item.id)
    });

    set((state) => ({
      inputQueue: [...state.inputQueue, ...items]
    }));
  },

  popFromInputQueue: () => {
    const state = get();
    if (state.inputQueue.length === 0) {
      perceptualLogger.debug('input-queue-pop', 'Attempted to pop from empty input queue', {
        queueType: 'input',
        queueLength: 0
      });
      return null;
    }

    const [firstItem, ...rest] = state.inputQueue;
    const stats = calculateVectorStats(firstItem.vector);

    perceptualLogger.info('input-queue-pop', `Popped vector from input queue: ${firstItem.id}`, {
      queueType: 'input',
      itemId: firstItem.id,
      vectorDimension: firstItem.vector.length,
      vectorSource: firstItem.source,
      vectorNonZeroCount: stats.nonZeroCount,
      queueLength: rest.length
    });

    set({ inputQueue: rest });
    return firstItem;
  },

  removeFromInputQueue: (id: string) => {
    const removedItem = get().inputQueue.find(item => item.id === id);

    perceptualLogger.info('input-queue-remove', `Removed vector from input queue: ${id}`, {
      queueType: 'input',
      itemId: id,
      queueLength: get().inputQueue.length - 1,
      itemFound: !!removedItem
    });

    set((state) => ({
      inputQueue: state.inputQueue.filter(item => item.id !== id)
    }));
  },

  clearInputQueue: () => {
    const clearedCount = get().inputQueue.length;

    perceptualLogger.info('input-queue-clear', `Cleared input queue (${clearedCount} items)`, {
      queueType: 'input',
      itemsRemoved: clearedCount,
      queueLength: 0
    });

    set({ inputQueue: [] });
    get().addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'info',
      message: 'Input queue cleared',
      timestamp: Date.now(),
      severity: 'info'
    });
  },

  addToOutputQueue: (item: VectorSequenceItem) => {
    const stats = calculateVectorStats(item.vector);

    perceptualLogger.info('output-queue-add', `Added vector to output queue: ${item.id}`, {
      queueType: 'output',
      itemId: item.id,
      vectorDimension: item.vector.length,
      vectorSource: item.source,
      vectorNonZeroCount: stats.nonZeroCount,
      vectorMean: stats.mean,
      vectorStdDev: stats.stdDev,
      queueLength: get().outputQueue.length + 1,
      machineName: item.metadata?.machineName
    });

    set((state) => ({
      outputQueue: [...state.outputQueue, item]
    }));
  },

  removeFromOutputQueue: (id: string) => {
    const removedItem = get().outputQueue.find(item => item.id === id);

    perceptualLogger.info('output-queue-remove', `Removed vector from output queue: ${id}`, {
      queueType: 'output',
      itemId: id,
      queueLength: get().outputQueue.length - 1,
      itemFound: !!removedItem,
      machineName: removedItem?.metadata?.machineName
    });

    set((state) => ({
      outputQueue: state.outputQueue.filter(item => item.id !== id)
    }));
  },

  clearOutputQueue: () => {
    const clearedCount = get().outputQueue.length;

    perceptualLogger.info('output-queue-clear', `Cleared output queue (${clearedCount} items)`, {
      queueType: 'output',
      itemsRemoved: clearedCount,
      queueLength: 0
    });

    set({ outputQueue: [] });
    get().addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'info',
      message: 'Output queue cleared',
      timestamp: Date.now(),
      severity: 'info'
    });
  },

  setCurrentInputVector: (vector: number[] | null) => {
    set({ currentInputVector: vector });
  },

  generateAlgorithmicSequence: async (pattern: string, count: number) => {
    try {
      perceptualLogger.info('vector-generate-algorithmic', `Generating ${count} algorithmic vectors (${pattern})`, {
        vectorPattern: pattern,
        itemsAdded: count,
        vectorDimension: 256
      });

      const { generateAlgorithmicVectors } = await import('./utils/algorithmicVectorGeneration');

      const vectors = generateAlgorithmicVectors(pattern, count, 256);

      const items: VectorSequenceItem[] = vectors.map((vector, index) => ({
        id: `alg-${pattern}-${Date.now()}-${index}`,
        vector,
        timestamp: Date.now() + index,
        source: 'algorithmic' as const,
        metadata: { pattern, index }
      }));

      get().addMultipleToInputQueue(items);
      await get().loadQueueIntoSimulation();

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Generated ${count} algorithmic vectors (${pattern}) and loaded into simulation`,
        timestamp: Date.now(),
        severity: 'success'
      });
    } catch (error) {
      console.error('Error generating algorithmic sequence:', error);
      perceptualLogger.error('vector-generate-algorithmic', `Failed to generate algorithmic sequence: ${error}`, {
        vectorPattern: pattern,
        itemsAdded: 0
      });
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to generate algorithmic sequence',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  generateRandomSequence: async (count: number, region: { offset: number; length: number }) => {
    try {
      perceptualLogger.info('vector-generate-random', `Generating ${count} random vectors in region [${region.offset}:${region.offset + region.length}]`, {
        itemsAdded: count,
        vectorDimension: 256,
        vectorRegion: region
      });

      const items: VectorSequenceItem[] = [];

      for (let i = 0; i < count; i++) {
        const vector = new Array(256).fill(0);

        // Fill specified region with random values
        for (let j = region.offset; j < region.offset + region.length; j++) {
          if (j < vector.length) {
            vector[j] = Math.random();
          }
        }

        items.push({
          id: `rand-${Date.now()}-${i}`,
          vector,
          timestamp: Date.now() + i,
          source: 'random' as const,
          metadata: { region }
        });
      }

      get().addMultipleToInputQueue(items);
      await get().loadQueueIntoSimulation();

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Generated ${count} random vectors in region [${region.offset}:${region.offset + region.length}] and loaded into simulation`,
        timestamp: Date.now(),
        severity: 'success'
      });
    } catch (error) {
      console.error('Error generating random sequence:', error);
      perceptualLogger.error('vector-generate-random', `Failed to generate random sequence: ${error}`, {
        itemsAdded: 0,
        vectorRegion: region
      });
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to generate random sequence',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  },

  loadQueueIntoSimulation: async () => {
    const { inputQueue } = get();

    if (inputQueue.length === 0) return;

    const vectors = inputQueue.map(item => item.vector);

    try {
      // Update the store first so the UI reflects the vectors immediately,
      // regardless of whether the backend configuration succeeds.
      set({
        inputVectors: vectors,
        simulationState: {
          status: 'stopped',
          currentIndex: 0,
          totalVectors: vectors.length,
          startTime: null,
          lastStepTime: null
        }
      });

      // Stream vectors to the PerceptualSpaceSimulator in chunks to avoid
      // HTTP body-size limits. Each 256-float vector is ~2-5 KB as JSON;
      // sending them all at once easily exceeds the default parser limit.
      const CHUNK_SIZE = 50;
      for (let i = 0; i < vectors.length; i += CHUNK_SIZE) {
        const chunk = vectors.slice(i, i + CHUNK_SIZE);
        await api.appendSequenceChunk({
          vectors: chunk,
          ...(i === 0
            ? { reset: true, inputRegion: { offset: 0, length: 256 }, stepDelayMs: 1000 }
            : {})
        });
      }
      await api.commitSequenceConfig();

      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'info',
        message: `Loaded ${vectors.length} vector${vectors.length !== 1 ? 's' : ''} from input queue into simulation`,
        timestamp: Date.now(),
        severity: 'success'
      });
    } catch (error) {
      console.error('Error loading queue into simulation:', error);
      get().addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to load input queue into simulation',
        timestamp: Date.now(),
        severity: 'error'
      });
    }
  }
}));
