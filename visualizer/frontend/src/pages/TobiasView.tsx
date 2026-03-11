import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVisualizerStore } from '../store';
import { useMachineSimulation, StepRecord, VisMachine } from '../hooks/useMachineSimulation';
import TobiasCanvas from '../components/tobias/TobiasCanvas';

import './TobiasView.css';

// ---------------------------------------------------------------------------
// HistoryStrip — scrolling input/output timeline
// ---------------------------------------------------------------------------

interface HistoryStripProps {
  title: string;
  type: 'input' | 'output';
  stepHistory: StepRecord[];
  machines: VisMachine[];
  selectedMachineId: string | null;
}

const HistoryStrip: React.FC<HistoryStripProps> = ({
  title, type, stepHistory, machines, selectedMachineId,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to show newest step on the right
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [stepHistory.length]);

  // Show selected machine first, then up to 6 machines total
  const displayMachines = useMemo(() => {
    const ordered = selectedMachineId
      ? [
          ...machines.filter(m => m.id === selectedMachineId),
          ...machines.filter(m => m.id !== selectedMachineId),
        ]
      : machines;
    return ordered.slice(0, 6);
  }, [machines, selectedMachineId]);

  const accentRgb = type === 'input' ? '100,200,255' : '168,85,247';

  return (
    <div className={`tobias-history-strip tobias-history-${type}`}>
      <div className="tobias-history-label">{title}</div>
      <div className="tobias-history-scroll" ref={scrollRef}>
        <div className="tobias-history-grid">

          {/* Machine name labels column */}
          <div className="tobias-history-names">
            {displayMachines.map(m => (
              <div key={m.id} className="tobias-history-name" title={m.name}>
                {m.name.replace(/^DC/, '').slice(0, 12)}
              </div>
            ))}
          </div>

          {/* Step columns (newest = rightmost) */}
          {stepHistory.map((step) => (
            <div key={step.stepNumber} className="tobias-history-col">
              <div className="tobias-history-step-num">{step.stepNumber}</div>
              {displayMachines.map(m => {
                const result = step.machineResults[m.id];
                const vec    = type === 'input' ? result?.inputVector : result?.outputVector;

                if (!vec || vec.length === 0) {
                  return (
                    <div key={m.id} className="tobias-history-cell tobias-history-cell-empty" />
                  );
                }

                return (
                  <div key={m.id} className="tobias-history-cell">
                    {vec.slice(0, 6).map((v, i) => (
                      <div
                        key={i}
                        className="tobias-history-dot"
                        style={{
                          background: `rgba(${accentRgb},${Math.max(0.08, Math.min(1, v))})`,
                        }}
                        title={`${m.name}[${i}]=${v.toFixed(3)}`}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {stepHistory.length === 0 && (
            <div className="tobias-history-empty">
              step the simulation to see {type} history
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TobiasView
// ---------------------------------------------------------------------------

/**
 * Tobias — Canvas 2D Machine Visualization
 *
 * Layout:
 *   header  (back button · title · step indicator · machine count)
 *   body (flex-row):
 *     sidebar (collapsible, LEFT) ← simulation controls + demo load + legend + filter
 *     sidebar-gutter              ← collapse toggle
 *     canvas-area (flex-1):
 *       HistoryStrip  [INPUT HISTORY]  — top
 *       TobiasCanvas                  — center (flex-1)
 *       HistoryStrip  [OUTPUT HISTORY] — bottom
 */
const TobiasView: React.FC = () => {
  const { setCurrentView } = useVisualizerStore();

  const {
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
    refreshMachines,
  } = useMachineSimulation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'idle' | 'processing' | 'active'>('all');

  const filteredMachines = useMemo(() => {
    if (statusFilter === 'all') return machines;
    return machines.filter((m) => m.status === statusFilter);
  }, [machines, statusFilter]);

  const statusCounts = useMemo(
    () =>
      machines.reduce(
        (acc, m) => { acc[m.status]++; return acc; },
        { idle: 0, processing: 0, active: 0 } as Record<string, number>,
      ),
    [machines],
  );

  const latestStep = stepHistory[stepHistory.length - 1];

  return (
    <div className="tobias-view">

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="tobias-header">
        <div className="tobias-header-left">
          <button
            className="tobias-back-button"
            onClick={() => setCurrentView('selection')}
            title="Back to Machine Selection"
          >
            ← Back
          </button>
          <div className="tobias-title-group">
            <h1 className="tobias-title">🔮 Tobias</h1>
            <p className="tobias-subtitle">Canvas 2D · machine visualization</p>
          </div>
        </div>

        <div className="tobias-header-right">
          {latestStep && (
            <span className="tobias-step-indicator">
              step <strong>{latestStep.stepNumber}</strong>
            </span>
          )}
          <button
            className="tobias-step-btn"
            onClick={stepSimulation}
            disabled={isSimulationRunning}
            title="Single step simulation"
          >
            ⏭ Step
          </button>
          {selectedMachineId && (
            <span className="tobias-selected-label">
              <strong>{selectedMachineId}</strong>
            </span>
          )}
          <span className="tobias-machine-count">
            {filteredMachines.length}/{machines.length} machine
            {machines.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="tobias-body">

        {/* ── Sidebar (LEFT) ───────────────────────────────────── */}
        <aside className={`tobias-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
          {sidebarOpen && (
            <div className="tobias-sidebar-content">

              {/* Section: Simulation Controls ─────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Simulation Controls</div>
                <div className="tbs-controls">
                  {isSimulationRunning ? (
                    <button className="tbs-ctrl-btn" onClick={pauseSimulation} title="Pause">
                      ⏸
                    </button>
                  ) : (
                    <button className="tbs-ctrl-btn" onClick={playSimulation} title="Play">
                      ▶
                    </button>
                  )}
                  <button
                    className="tbs-ctrl-btn"
                    onClick={stepSimulation}
                    disabled={isSimulationRunning}
                    title="Step"
                  >
                    ⏭
                  </button>
                  <button
                    className="tbs-ctrl-btn tbs-ctrl-reset"
                    onClick={resetSimulation}
                    title="Reset"
                  >
                    ↺
                  </button>
                </div>
              </div>

              {/* Section: Perceptual Engine ───────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Perceptual Engine</div>
                <button
                  className="tbs-demo-btn"
                  onClick={loadDataCenterDemo}
                  disabled={isDemoLoading}
                  title="Load DC monitoring machines into perceptual space simulator"
                >
                  {isDemoLoading ? '⟳ Loading…' : '⚡ Load DC Demo'}
                </button>
                <button
                  className="tbs-demo-btn tbs-demo-refresh"
                  onClick={refreshMachines}
                  title="Refresh machine list from backend"
                >
                  ↻ Refresh Machines
                </button>
              </div>

              {/* Section: Node Legend ─────────────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Node Legend</div>
                <div className="tbs-legend">
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#3b82f6' }} />
                    <span>Start (isInitial)</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot tbs-legend-ring" style={{ background: '#111827', borderColor: '#f59e0b' }} />
                    <span>Terminal (end)</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#f59e0b' }} />
                    <span>Active (fired)</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#64748b' }} />
                    <span>Intermediate</span>
                  </div>
                </div>
              </div>

              {/* Section: Machine Filter ──────────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Machine Filter</div>
                <div className="tbs-filter">
                  {(['all', 'idle', 'processing', 'active'] as const).map((s) => (
                    <button
                      key={s}
                      className={`tbs-filter-btn${statusFilter === s ? ' active' : ''}`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === 'all'
                        ? `All (${machines.length})`
                        : `${s[0].toUpperCase()}${s.slice(1)} (${statusCounts[s]})`}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </aside>

        {/* ── Sidebar gutter — collapse toggle ─────────────────── */}
        <div className="tobias-sidebar-gutter">
          <button
            className="tobias-sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {/* ── Canvas column ────────────────────────────────────── */}
        <div className="tobias-canvas-area">

          {/* TOP: input history */}
          <HistoryStrip
            title="INPUT HISTORY"
            type="input"
            stepHistory={stepHistory}
            machines={filteredMachines}
            selectedMachineId={selectedMachineId}
          />

          {/* CENTER: main Tobias canvas */}
          <div className="tobias-canvas-center">
            <TobiasCanvas
              machines={filteredMachines}
              selectedMachineId={selectedMachineId}
              onSelectMachine={selectMachine}
            />
          </div>

          {/* BOTTOM: output history */}
          <HistoryStrip
            title="OUTPUT HISTORY"
            type="output"
            stepHistory={stepHistory}
            machines={filteredMachines}
            selectedMachineId={selectedMachineId}
          />

        </div>
      </div>
    </div>
  );
};

export default TobiasView;
