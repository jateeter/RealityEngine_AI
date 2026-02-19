import React, { useState, useMemo } from 'react';
import { useVisualizerStore } from '../store';
import { useMachineSimulation } from '../hooks/useMachineSimulation';
import TobiasCanvas from '../components/tobias/TobiasCanvas';

import './TobiasView.css';

/**
 * Tobias — Canvas 2D Machine Visualization
 *
 * Layout:
 *   header  (back button · title · step button · machine count)
 *   body (flex-row):
 *     canvas-area (flex-1)  ← TobiasCanvas
 *     sidebar-gutter        ← collapse toggle
 *     sidebar (collapsible) ← simulation controls + machine filter
 */
const TobiasView: React.FC = () => {
  const { setCurrentView } = useVisualizerStore();

  const {
    machines,
    selectedMachineId,
    isSimulationRunning,
    selectMachine,
    stepSimulation,
    playSimulation,
    pauseSimulation,
    resetSimulation,
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
              Selected: <strong>{selectedMachineId}</strong>
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

        {/* ── Canvas column ─────────────────────────────────── */}
        <div className="tobias-canvas-area">
          <TobiasCanvas
            machines={filteredMachines}
            selectedMachineId={selectedMachineId}
            onSelectMachine={selectMachine}
          />
        </div>

        {/* ── Sidebar gutter — toggle lives here, never clipped ── */}
        <div className="tobias-sidebar-gutter">
          <button
            className="tobias-sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '›' : '‹'}
          </button>
        </div>

        {/* ── Sidebar ───────────────────────────────────────── */}
        <aside className={`tobias-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
          {sidebarOpen && (
            <div className="tobias-sidebar-content">

              {/* Section: Controls ──────────────────────────── */}
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
                  <button className="tbs-ctrl-btn tbs-ctrl-reset" onClick={resetSimulation} title="Reset">
                    ↺
                  </button>
                </div>
              </div>

              {/* Section: Machine Filter ─────────────────────── */}
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
      </div>
    </div>
  );
};

export default TobiasView;
