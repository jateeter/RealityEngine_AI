import { useEffect, useRef, useState, useCallback } from 'react';
import type { EngineState, PushLogEntry, SourceConfig, MatchAlgorithm } from './types.js';
import { getState, push, startAuto, stopAuto, resetEngine, addSource, deleteSource, updateSource, setMatchAlgorithm } from './api.js';
import Header from './components/Header.js';
import SourcesPanel from './components/SourcesPanel.js';
import VectorDisplay from './components/VectorDisplay.js';
import PushLog from './components/PushLog.js';
import AddSourceModal from './components/AddSourceModal.js';

const MAX_LOG = 20;

export default function App() {
  const [state, setState] = useState<EngineState | null>(null);
  const [pushLog, setPushLog] = useState<PushLogEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const autoIntervalRef = useRef<number>(1000);

  // Load initial state
  useEffect(() => {
    getState().then(setState).catch(console.error);
  }, []);

  // WebSocket connection with reconnect
  useEffect(() => {
    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (destroyed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; [key: string]: unknown };

          if (msg.type === 'state-update') {
            setState(msg.state as EngineState);
          } else if (msg.type === 'push-result') {
            const entry: PushLogEntry = {
              id: `${Date.now()}-${Math.random()}`,
              success: msg.success as boolean,
              step: msg.step as Record<string, unknown> | undefined,
              timestamp: msg.timestamp as number,
              globalStep: msg.globalStep as number,
              error: msg.error as string | undefined,
            };
            setPushLog(prev => [entry, ...prev].slice(0, MAX_LOG));
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (!destroyed) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handlePush = useCallback(async () => {
    await push();
    // State update comes via WebSocket
  }, []);

  const handleAutoStart = useCallback(async () => {
    await startAuto(autoIntervalRef.current);
  }, []);

  const handleAutoStop = useCallback(async () => {
    await stopAuto();
  }, []);

  const handleReset = useCallback(async () => {
    await resetEngine();
  }, []);

  const handleIntervalChange = useCallback((ms: number) => {
    autoIntervalRef.current = ms;
    if (state?.auto.running) {
      startAuto(ms).catch(console.error);
    }
  }, [state?.auto.running]);

  const handleAddSource = useCallback(async (config: Omit<SourceConfig, 'id'>) => {
    await addSource(config);
    setShowAddModal(false);
  }, []);

  const handleDeleteSource = useCallback(async (id: string) => {
    await deleteSource(id);
  }, []);

  const handleToggleSource = useCallback(async (id: string, active: boolean) => {
    await updateSource(id, { active });
  }, []);

  const handleMatchAlgorithmChange = useCallback(async (algo: MatchAlgorithm) => {
    await setMatchAlgorithm(algo);
    // State will update via WebSocket state-update broadcast
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header
        step={state?.globalStep ?? 0}
        isAutoRunning={state?.auto.running ?? false}
        autoIntervalMs={state?.auto.intervalMs ?? 1000}
        matchAlgorithm={state?.matchAlgorithm ?? 'gte'}
        onPush={handlePush}
        onAutoStart={handleAutoStart}
        onAutoStop={handleAutoStop}
        onReset={handleReset}
        onMatchAlgorithmChange={handleMatchAlgorithmChange}
        onIntervalChange={handleIntervalChange}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SourcesPanel
          sources={state?.sources ?? []}
          onAdd={() => setShowAddModal(true)}
          onDelete={handleDeleteSource}
          onToggle={handleToggleSource}
          onHover={setHoveredSourceId}
          hoveredSourceId={hoveredSourceId}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px', gap: '12px' }}>
          <VectorDisplay
            vector={state?.assembledVector ?? new Array(256).fill(0)}
            sources={state?.sources ?? []}
            hoveredSourceId={hoveredSourceId}
          />
          <PushLog entries={pushLog} />
        </div>
      </div>
      {showAddModal && (
        <AddSourceModal
          onAdd={handleAddSource}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
