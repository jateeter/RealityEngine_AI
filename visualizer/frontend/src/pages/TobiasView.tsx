import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useVisualizerStore } from '../store';
import { useMachineSimulation, StepRecord, VisMachine } from '../hooks/useMachineSimulation';
import TobiasCanvas, { TobiasCanvasHandle } from '../components/tobias/TobiasCanvas';
import TobiasAISequencePulse from '../components/tobias/TobiasAISequencePulse';
import { classifyMachine, domainColor, DOMAINS, DOMAIN_ORDER, DomainId } from '../components/machineDomains';
import { PERCEPTUAL_DIM } from '../constants';

import './TobiasView.css';

// Parse "#rrggbb" → "r,g,b" for use inside rgba(...) fill strings.
function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

// ---------------------------------------------------------------------------
// PerceptualSpaceBar
// Condensed canvas heatmap of the full global perceptual space.
// Machine input regions are color-coded and labeled.
// SEQUENCES button opens the sequence management panel.
// ---------------------------------------------------------------------------

interface PerceptualSpaceBarProps {
  perceptualSpace: number[];
  machines: VisMachine[];
  latestStep: number | null;
}

const PerceptualSpaceBar: React.FC<PerceptualSpaceBarProps> = ({
  perceptualSpace, machines, latestStep,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vizRef    = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const viz    = vizRef.current;
    if (!canvas || !viz) return;
    const W = viz.clientWidth;
    if (W <= 0) return;
    canvas.width = W;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const DIM = PERCEPTUAL_DIM;
    const H   = canvas.height;

    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, W, H);

    // Pre-assign a domain-colored rgb triplet per perceptual-space index based on
    // which machine owns that region. Unowned regions fall back to slate.
    const DEFAULT_TRIPLET = hexToRgbTriplet(DOMAINS.general.color);
    const triplets = new Array<string>(DIM).fill(DEFAULT_TRIPLET);
    machines.forEach(m => {
      if (!m.inputRegion) return;
      const d = classifyMachine(m).domain;
      const triplet = hexToRgbTriplet(domainColor(d));
      const end = Math.min(DIM, m.inputRegion.offset + m.inputRegion.length);
      for (let j = m.inputRegion.offset; j < end; j++) triplets[j] = triplet;
    });

    const bw = W / DIM;
    for (let i = 0; i < DIM; i++) {
      const v = Math.max(0, Math.min(1, perceptualSpace[i] ?? 0));
      ctx.fillStyle = `rgba(${triplets[i]},${0.10 + v * 0.85})`;
      ctx.fillRect(i * bw, 0, Math.max(bw, 1), H);
    }

    // Region boundary markers
    const bounds = new Set<number>();
    machines.forEach(m => {
      if (m.inputRegion) {
        bounds.add(m.inputRegion.offset);
        bounds.add(m.inputRegion.offset + m.inputRegion.length);
      }
    });
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (const b of bounds) ctx.fillRect((b / DIM) * W, 0, 1, H);
  }, [perceptualSpace, machines]);

  // Redraw whenever data or layout changes
  useEffect(() => {
    const viz = vizRef.current;
    if (!viz) return;
    const ro = new ResizeObserver(draw);
    ro.observe(viz);
    draw();
    return () => ro.disconnect();
  }, [draw]);

  // Percentage-based region labels (no re-draw needed for layout)
  const regionLabels = useMemo(
    () => machines
      .filter(m => m.inputRegion)
      .map(m => ({
        id:     m.id,
        name:   m.name.replace(/^DC/, '').slice(0, 10),
        left:   (m.inputRegion!.offset / PERCEPTUAL_DIM) * 100,
        width:  (m.inputRegion!.length  / PERCEPTUAL_DIM) * 100,
        domain: classifyMachine(m).domain,
      })),
    [machines],
  );

  const hasData = perceptualSpace.some(v => v > 0);

  return (
    <div className="tobias-psbar">
      <div className="tobias-psbar-viz" ref={vizRef}>
        {/* Region labels (CSS percentage positioning) */}
        <div className="tobias-psbar-labels">
          {regionLabels.map(r => (
            <div
              key={r.id}
              className="tobias-psbar-region-label"
              style={{
                left:            `${r.left}%`,
                width:           `${r.width}%`,
                borderLeftColor: domainColor(r.domain),
              }}
              title={`${machines.find(m => m.id === r.id)?.name} · ${DOMAINS[r.domain].label}`}
            >
              {r.name}
            </div>
          ))}
          {!hasData && machines.length === 0 && (
            <span className="tobias-psbar-placeholder">load a demo or step the simulation</span>
          )}
        </div>
        <canvas ref={canvasRef} className="tobias-psbar-canvas" height={18} />
      </div>

      <div className="tobias-psbar-meta">
        {latestStep !== null ? `step ${latestStep}` : '—'}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// OutputHistoryBar
// Collapsed (default): single inline row per machine showing latest output dots.
// Expanded: scrolling step-history table (machines × steps).
// ---------------------------------------------------------------------------

interface OutputHistoryBarProps {
  stepHistory: StepRecord[];
  machines: VisMachine[];
  selectedMachineId: string | null;
}

const OutputHistoryBar: React.FC<OutputHistoryBarProps> = ({
  stepHistory, machines, selectedMachineId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest step on the right
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [stepHistory.length, expanded]);

  // Selected machine first, then up to 8 total
  const displayMachines = useMemo(() => {
    const ordered = selectedMachineId
      ? [
          ...machines.filter(m => m.id === selectedMachineId),
          ...machines.filter(m => m.id !== selectedMachineId),
        ]
      : machines;
    return ordered.slice(0, 6);
  }, [machines, selectedMachineId]);

  const latestStep = stepHistory[stepHistory.length - 1];

  return (
    <div className={`tobias-outbar${expanded ? ' expanded' : ''}`}>
      {/* Left column: toggle + "OUTPUT" label */}
      <div className="tobias-outbar-side">
        <button
          className="tobias-outbar-toggle"
          onClick={() => setExpanded(e => !e)}
          title={expanded ? 'Collapse output bar' : 'Expand output history'}
        >
          {expanded ? '▼' : '▲'}
        </button>
        <span className="tobias-outbar-label">OUTPUT</span>
      </div>

      {/* Content */}
      <div className="tobias-outbar-content" ref={scrollRef}>

        {!expanded ? (
          /* ── Collapsed: inline machine summary ── */
          <div className="tobias-outbar-summary">
            {displayMachines.map(m => {
              const result = latestStep?.machineResults[m.id];
              const ov     = result?.outputVector;
              return (
                <div key={m.id} className="tobias-outbar-machine" title={m.name}>
                  <span className="tobias-outbar-mname">
                    {m.name.replace(/^DC/, '').slice(0, 10)}
                  </span>
                  <div className="tobias-outbar-dots">
                    {ov && ov.length > 0
                      ? ov.slice(0, 4).map((v, i) => (
                          <div
                            key={i}
                            className="tobias-outbar-dot"
                            style={{
                              background: `rgba(168,85,247,${Math.max(0.07, Math.min(1, v))})`,
                            }}
                          />
                        ))
                      : <div className="tobias-outbar-dot tobias-outbar-dot-nil" />
                    }
                  </div>
                </div>
              );
            })}
            {stepHistory.length === 0 && (
              <span className="tobias-outbar-idle">awaiting simulation output…</span>
            )}
          </div>
        ) : (
          /* ── Expanded: step-history table ── */
          <div className="tobias-outbar-table">
            {/* Sticky machine-name column */}
            <div className="tobias-outbar-names">
              <div className="tobias-outbar-corner" />
              {displayMachines.map(m => (
                <div key={m.id} className="tobias-outbar-row-name" title={m.name}>
                  {m.name.replace(/^DC/, '').slice(0, 12)}
                </div>
              ))}
            </div>

            {/* Step columns, newest on the right */}
            {stepHistory.map(step => (
              <div key={step.stepNumber} className="tobias-outbar-stepcol">
                <div className="tobias-outbar-stepnum">{step.stepNumber}</div>
                {displayMachines.map(m => {
                  const result = step.machineResults[m.id];
                  const ov     = result?.outputVector;
                  return (
                    <div key={m.id} className="tobias-outbar-cell">
                      {ov && ov.length > 0
                        ? ov.slice(0, 4).map((v, i) => (
                            <div
                              key={i}
                              className="tobias-outbar-dot"
                              style={{
                                background: `rgba(168,85,247,${Math.max(0.07, Math.min(1, v))})`,
                              }}
                              title={`${m.name}[out${i}] = ${v.toFixed(3)} @ step ${step.stepNumber}`}
                            />
                          ))
                        : <div className="tobias-outbar-dot tobias-outbar-dot-nil" />
                      }
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
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
 *     sidebar (collapsible, LEFT) ← layout controls + machine/domain filters
 *                                    (simulation controls live in the PE UI)
 *     sidebar-gutter              ← collapse toggle
 *     canvas-area (flex-1, flex-col):
 *       PerceptualSpaceBar  [INPUT STREAM]   — top  (~44px)
 *       canvas-center (flex-1):
 *         floating legend panel              — left-margin overlay
 *         TobiasCanvas                       — fills remaining space
 *       OutputHistoryBar    [OUTPUT STREAM]  — bottom (32px collapsed / 148px expanded)
 *   TobiasSequencesPanel                    — modal overlay
 */
const TobiasView: React.FC = () => {
  const { setCurrentView } = useVisualizerStore();

  // Simulation controls (play / pause / step / reset) now live exclusively
  // in the Perception Engine visualization — Tobias is read-only for
  // simulation state.  We still consume machines + stepHistory for display.
  const {
    machines,
    selectedMachineId,
    stepHistory,
    selectMachine,
  } = useMachineSimulation();

  const canvasRef = useRef<TobiasCanvasHandle>(null);

  const [sidebarOpen,  setSidebarOpen]  = useState(true);
  const [legendOpen,   setLegendOpen]   = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'idle' | 'processing' | 'active'>('all');
  const [domainFilter, setDomainFilter] = useState<'all' | DomainId>('all');

  // Classify once per machine list change; both the filter predicate and the
  // per-domain counts rely on the same classification.
  const domainById = useMemo(
    () => new Map(machines.map(m => [m.id, classifyMachine(m).domain])),
    [machines],
  );

  const filteredMachines = useMemo(() => {
    return machines.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (domainFilter !== 'all' && domainById.get(m.id) !== domainFilter) return false;
      return true;
    });
  }, [machines, statusFilter, domainFilter, domainById]);

  const statusCounts = useMemo(
    () => machines.reduce(
      (acc, m) => { acc[m.status]++; return acc; },
      { idle: 0, processing: 0, active: 0 } as Record<string, number>,
    ),
    [machines],
  );

  const domainCounts = useMemo(() => {
    const counts: Record<DomainId, number> = {
      healthservices: 0, ai: 0, datacenter: 0, agriculture: 0, communityservices: 0, general: 0,
    };
    for (const m of machines) counts[domainById.get(m.id) ?? 'general']++;
    return counts;
  }, [machines, domainById]);

  const latestStep       = stepHistory[stepHistory.length - 1];
  const latestStepNumber = latestStep?.stepNumber ?? null;
  const perceptualSpace  = latestStep?.perceptualSpace ?? [];

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
          {latestStepNumber !== null && (
            <span className="tobias-step-indicator">
              step <strong>{latestStepNumber}</strong>
            </span>
          )}
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

              {/* Section: Layout ──────────────────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Layout</div>
                <button
                  className="tbs-demo-btn"
                  onClick={() => canvasRef.current?.clearLayout()}
                  title="Clear pinned bubble positions and restore the domain grid layout"
                >
                  ⊹ Reset Layout
                </button>
                <div className="tbs-layout-hint">
                  Click expands. Double-click opens live view. Drag bubbles to pin.
                </div>
              </div>

              {/* Section: Machine Filter ──────────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Machine Filter</div>
                <div className="tbs-filter">
                  {(['all', 'idle', 'processing', 'active'] as const).map(s => (
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

              {/* Section: Domain Filter ──────────────────────── */}
              <div className="tbs-section">
                <div className="tbs-section-title">Domain Filter</div>
                <div className="tbs-filter">
                  <button
                    className={`tbs-filter-btn${domainFilter === 'all' ? ' active' : ''}`}
                    onClick={() => setDomainFilter('all')}
                  >
                    All ({machines.length})
                  </button>
                  {DOMAIN_ORDER.map(d => (
                    <button
                      key={d}
                      className={`tbs-filter-btn${domainFilter === d ? ' active' : ''}`}
                      onClick={() => setDomainFilter(d)}
                      title={DOMAINS[d].description}
                      style={{
                        borderLeft: `3px solid ${DOMAINS[d].color}`,
                        paddingLeft: 6,
                      }}
                    >
                      {DOMAINS[d].short} ({domainCounts[d]})
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </aside>

        {/* ── Sidebar gutter ───────────────────────────────────── */}
        <div className="tobias-sidebar-gutter">
          <button
            className="tobias-sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        {/* ── Canvas column ────────────────────────────────────── */}
        <div className="tobias-canvas-area">

          {/* TOP: condensed global perceptual input stream */}
          <PerceptualSpaceBar
            perceptualSpace={perceptualSpace}
            machines={filteredMachines}
            latestStep={latestStepNumber}
          />

          {/* CENTER: canvas + floating legend overlay */}
          <div className="tobias-canvas-center">
            <div className={`tobias-legend-panel${legendOpen ? ' open' : ''}`}>
              <button
                className="tobias-legend-tab"
                onClick={() => setLegendOpen(o => !o)}
                title={legendOpen ? 'Hide legend' : 'Show legend'}
              >
                LEGEND
              </button>
              <div className="tobias-legend-content">
                <div className="tbs-legend">
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#3b82f6' }} />
                    <span>Start node (A+)</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#93c5fd' }} />
                    <span>Start matched (A+ fired)</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#06b6d4' }} />
                    <span>Queued / active</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span
                      className="tbs-legend-dot tbs-legend-ring"
                      style={{ background: '#111827', borderColor: '#f59e0b' }}
                    />
                    <span>Terminal node (output)</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#f59e0b' }} />
                    <span>Output emitted</span>
                  </div>
                  <div className="tbs-legend-item">
                    <span className="tbs-legend-dot" style={{ background: '#64748b' }} />
                    <span>Intermediate</span>
                  </div>
                </div>
              </div>
            </div>

            <TobiasCanvas
              ref={canvasRef}
              machines={filteredMachines}
              selectedMachineId={selectedMachineId}
              onSelectMachine={selectMachine}
            />
          </div>

          {/* BELOW CANVAS: AI sequence-fire pulse readout (localAI observability) */}
          <TobiasAISequencePulse
            stepHistory={stepHistory}
            machines={machines}
          />

          {/* BOTTOM: condensed output stream with history expansion */}
          <OutputHistoryBar
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
