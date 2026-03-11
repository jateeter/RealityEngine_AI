import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VectorNodeLite {
  id: string;
  label: string;
  isInitial: boolean;
  hasOutput: boolean;
  elements: { value: number; comparatorType: string; threshold?: number }[];
}

export interface VisMachineEdge {
  source: string; // VectorNode id
  target: string; // VectorNode id
}

export interface VisMachineSequence {
  sequenceId: string;
  name: string;
  vectors: VectorNodeLite[];
  edges: VisMachineEdge[];
  metadata?: Record<string, any>;
}

export interface VisMachine {
  id: string;
  name: string;
  isExample: boolean;
  sequences: VisMachineSequence[];
  status: 'idle' | 'processing' | 'active';
  position?: { x: number; y: number };
  // Perceptual mapping regions
  inputRegion?: { offset: number; length: number };
  outputRegion?: { offset: number; length: number };
  // Latest step values
  latestInputVector?: number[];
  latestOutputVector?: number[] | null;
  justFired: boolean;
}

export interface StepMachineResult {
  machineId: string;
  machineName: string;
  inputVector: number[];
  outputVector: number[] | null;
  inputRegion: { offset: number; length: number };
  outputRegion?: { offset: number; length: number } | null;
}

export interface StepRecord {
  stepNumber: number;
  timestamp: number;
  perceptualSpace: number[];
  machineResults: Record<string, StepMachineResult>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const MAX_HISTORY = 24;
const AUTO_PLAY_INTERVAL_MS = 600;

export const useMachineSimulation = () => {
  const [machines, setMachines] = useState<VisMachine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [stepHistory, setStepHistory] = useState<StepRecord[]>([]);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<number | null>(null);

  // ── Machine loading ────────────────────────────────────────────────────────

  const loadMachines = useCallback(async () => {
    try {
      const machinesData = await api.getMachines();

      const detailedMachines = await Promise.all(
        machinesData.map(async (machine: any) => {
          try {
            const details = await api.getMachine(machine.id);

            const fullSequences = await Promise.all(
              (details.sequenceIds || []).map(async (seqId: string) => {
                try {
                  const sequenceGraph = await api.getSequence(seqId);
                  return {
                    sequenceId: sequenceGraph.sequenceId,
                    name: sequenceGraph.sequenceName,
                    vectors: (sequenceGraph.nodes || []).map((n: any): VectorNodeLite => ({
                      id: n.id,
                      // Prefer semantic name from metadata, fall back to truncated UUID
                      label: n.metadata?.name || n.metadata?.role || (n.label && !n.label.startsWith('V-') ? n.label : '') || n.id.slice(-8),
                      isInitial: n.isInitial ?? false,
                      hasOutput: n.hasOutput ?? (n.outputVectors?.length > 0 ? true : false),
                      elements: n.elements ?? [],
                    })),
                    // Actual edges from nextVectorIds — drives the correct CES graph
                    edges: (sequenceGraph.edges || []).map((e: any): VisMachineEdge => ({
                      source: e.source,
                      target: e.target,
                    })),
                    metadata: sequenceGraph.metadata,
                  } as VisMachineSequence;
                } catch {
                  return null;
                }
              })
            );

            return {
              id: machine.id,
              name: machine.name,
              isExample: machine.isExample || false,
              sequences: fullSequences.filter(Boolean) as VisMachineSequence[],
              status: 'idle' as const,
              justFired: false,
              inputRegion: details.perceptualMapping?.input,
              outputRegion: details.perceptualMapping?.output,
            } as VisMachine;
          } catch {
            return {
              id: machine.id,
              name: machine.name,
              isExample: false,
              sequences: [],
              status: 'idle' as const,
              justFired: false,
            } as VisMachine;
          }
        })
      );

      setMachines(detailedMachines);
    } catch (error) {
      console.error('Failed to load machines:', error);
    }
  }, []);

  // ── Demo loading ───────────────────────────────────────────────────────────

  const loadDataCenterDemo = useCallback(async () => {
    setIsDemoLoading(true);
    try {
      await api.loadDataCenterExample();
      await loadMachines();
    } catch (error) {
      console.error('Failed to load data center demo:', error);
    } finally {
      setIsDemoLoading(false);
    }
  }, [loadMachines]);

  // ── WebSocket ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3001/ws');

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'perceptual-simulation-stepped') {
            const d = msg.data || {};
            const activeIds: string[] = d.activeMachineIds ?? [];
            const machineResults: Record<string, StepMachineResult> = d.machineResults ?? {};
            const perceptualSpace: number[] = d.perceptualSpace ?? [];
            const stepNumber: number = d.stepNumber ?? 0;

            // Append step record to history (capped at MAX_HISTORY)
            const record: StepRecord = {
              stepNumber,
              timestamp: d.timestamp ?? Date.now(),
              perceptualSpace,
              machineResults,
            };
            setStepHistory((prev) => {
              const next = [...prev, record];
              return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
            });

            // Update machine states
            setMachines((prev) =>
              prev.map((m) => {
                const fired = activeIds.includes(m.id);
                const result = machineResults[m.id];
                return {
                  ...m,
                  status: fired ? ('processing' as const) : ('idle' as const),
                  justFired: fired,
                  latestInputVector: result?.inputVector ?? m.latestInputVector,
                  latestOutputVector: fired
                    ? (result?.outputVector ?? m.latestOutputVector)
                    : m.latestOutputVector,
                };
              })
            );
          } else if (msg.type === 'perceptual-simulation-reset') {
            setStepHistory([]);
            setMachines((prev) =>
              prev.map((m) => ({
                ...m,
                status: 'idle' as const,
                justFired: false,
                latestInputVector: undefined,
                latestOutputVector: undefined,
              }))
            );
          } else if (msg.type === 'demo-loaded') {
            // Refresh machine list when a demo is loaded externally
            loadMachines();
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => setTimeout(connect, 3000);
      wsRef.current = ws;
    };

    connect();
    return () => wsRef.current?.close();
  }, [loadMachines]);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  // ── Auto-play interval ─────────────────────────────────────────────────────

  const stepSimulation = useCallback(async () => {
    try {
      await api.stepPerceptualSimulation();
    } catch (error) {
      console.error('Failed to step simulation:', error);
    }
  }, []);

  useEffect(() => {
    if (isSimulationRunning) {
      intervalRef.current = window.setInterval(stepSimulation, AUTO_PLAY_INTERVAL_MS);
    } else if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isSimulationRunning, stepSimulation]);

  // ── Controls ───────────────────────────────────────────────────────────────

  const selectMachine = useCallback((id: string | null) => setSelectedMachineId(id), []);
  const playSimulation = useCallback(() => setIsSimulationRunning(true), []);
  const pauseSimulation = useCallback(() => setIsSimulationRunning(false), []);

  const resetSimulation = useCallback(async () => {
    try {
      await api.resetPerceptualSimulation();
      setIsSimulationRunning(false);
      setStepHistory([]);
      setMachines((prev) =>
        prev.map((m) => ({
          ...m,
          status: 'idle' as const,
          justFired: false,
          latestInputVector: undefined,
          latestOutputVector: undefined,
        }))
      );
    } catch (error) {
      console.error('Failed to reset simulation:', error);
    }
  }, []);

  return {
    machines,
    selectedMachineId,
    isSimulationRunning,
    stepHistory,
    isDemoLoading,
    selectMachine,
    stepSimulation,
    playSimulation,
    pauseSimulation,
    resetSimulation,
    loadDataCenterDemo,
    refreshMachines: loadMachines,
  };
};
