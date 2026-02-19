import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

export interface VisMachine {
  id: string;
  name: string;
  isExample: boolean;
  sequences: any[];
  status: 'idle' | 'processing' | 'active';
  position?: { x: number; y: number };
}

export const useMachineSimulation = () => {
  const [machines, setMachines] = useState<VisMachine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

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
                    vectors: sequenceGraph.nodes,
                    metadata: sequenceGraph.metadata,
                  };
                } catch {
                  return null;
                }
              })
            );

            return {
              id: machine.id,
              name: machine.name,
              isExample: machine.isExample || false,
              sequences: fullSequences.filter(Boolean),
              status: 'idle' as const,
            };
          } catch {
            return {
              id: machine.id,
              name: machine.name,
              isExample: false,
              sequences: [],
              status: 'idle' as const,
            };
          }
        })
      );

      setMachines(detailedMachines);
    } catch (error) {
      console.error('Failed to load machines:', error);
    }
  }, []);

  // WebSocket for real-time machine status updates
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3001/ws');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'perceptual-simulation-stepped') {
            const activeIds: string[] = data.data?.activeMachineIds ?? [];
            setMachines((prev) =>
              prev.map((m) => ({
                ...m,
                status: activeIds.includes(m.id) ? ('processing' as const) : ('idle' as const),
              }))
            );
          } else if (data.type === 'perceptual-simulation-reset') {
            setMachines((prev) => prev.map((m) => ({ ...m, status: 'idle' as const })));
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
  }, []);

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  const selectMachine = useCallback((id: string | null) => setSelectedMachineId(id), []);

  const stepSimulation = useCallback(async () => {
    try {
      await api.stepPerceptualSimulation();
    } catch (error) {
      console.error('Failed to step simulation:', error);
    }
  }, []);

  const playSimulation = useCallback(() => setIsSimulationRunning(true), []);
  const pauseSimulation = useCallback(() => setIsSimulationRunning(false), []);

  const resetSimulation = useCallback(async () => {
    try {
      await api.resetPerceptualSimulation();
      setIsSimulationRunning(false);
      setMachines((prev) => prev.map((m) => ({ ...m, status: 'idle' as const })));
    } catch (error) {
      console.error('Failed to reset simulation:', error);
    }
  }, []);

  return {
    machines,
    selectedMachineId,
    isSimulationRunning,
    selectMachine,
    stepSimulation,
    playSimulation,
    pauseSimulation,
    resetSimulation,
    refreshMachines: loadMachines,
  };
};
