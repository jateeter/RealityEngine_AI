/**
 * MachineGraphView - Visualization of machines as computational nodes
 *
 * Shows machines with their perceptual space input/output mappings
 * and visualizes the flow of data through the system.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useVisualizerStore } from '../store';
import { classifyMachine, DOMAINS, DOMAIN_ORDER, DomainId } from './machineDomains';
import { vizTheme } from '../styles/vizTheme';
import './MachineGraphView.css';
import './VisLegend.css';

interface MachineNode {
  id: string;
  name: string;
  description: string;
  inputMapping: { offset: number; length: number };
  outputMapping: { offset: number; length: number };
  metadata: Record<string, any>;
  // Domain classification — drives cluster hulls and per-node color accents.
  domain?: DomainId;
}

interface MachineEdge {
  source: string;
  target: string;
  sourceRegion: { offset: number; length: number };
  targetRegion: { offset: number; length: number };
  overlap: boolean;
}

interface MachineGraphData {
  nodes: MachineNode[];
  edges: MachineEdge[];
  perceptualSpaceDimension: number;
}

interface SimulationStep {
  stepNumber: number;
  timestamp: number;
  perceptualSpace: number[];
  machineResults: Record<string, {
    machineId: string;
    machineName: string;
    inputVector: number[];
    outputVector: number[] | null;
    inputRegion: { offset: number; length: number };
    outputRegion: { offset: number; length: number } | null;
  }>;
  activeRegions: Array<{
    offset: number;
    length: number;
    machineId: string;
    type: 'input' | 'output';
  }>;
}

// ---------------------------------------------------------------------------
// Layout persistence
// ---------------------------------------------------------------------------

const LAYOUT_KEY = 'machine-graph-layout';

function loadLayout(): Record<string, { fx: number; fy: number }> {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveLayout(nodes: d3.SimulationNodeDatum[]): void {
  const layout: Record<string, { fx: number; fy: number }> = {};
  for (const n of nodes as any[]) {
    if (n.fx != null && n.fy != null) {
      layout[n.id] = { fx: n.fx, fy: n.fy };
    }
  }
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MachineGraphView: React.FC = () => {
  const svgRef       = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // D3 objects that must persist across step updates
  const nodeSelRef      = useRef<d3.Selection<SVGGElement, MachineNode, SVGGElement, unknown> | null>(null);
  const stepTextRef     = useRef<d3.Selection<SVGTextElement, MachineNode, SVGGElement, unknown> | null>(null);
  const simRef          = useRef<d3.Simulation<MachineNode & d3.SimulationNodeDatum, undefined> | null>(null);
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null);

  const [graphData,   setGraphData]   = useState<MachineGraphData | null>(null);
  const [currentStep, setCurrentStep] = useState<SimulationStep | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [dimensions,  setDimensions]  = useState({ width: 1200, height: 600 });
  const [legendOpen,  setLegendOpen]  = useState(false);
  // Incrementing this forces a full layout rebuild (Reset Layout)
  const [layoutEpoch, setLayoutEpoch] = useState(0);

  const ws = useVisualizerStore(state => state.ws);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const fetchGraphData = useCallback(async () => {
    try {
      const response = await fetch('/api/machine-graph');
      if (!response.ok) {
        setError(`Failed to load machine graph (HTTP ${response.status})`);
        return;
      }
      const result = await response.json();
      if (Array.isArray(result.nodes)) {
        setGraphData(result as MachineGraphData);
        setError(null);
      } else {
        setError(result.error || 'Failed to load machine graph');
      }
    } catch (err: any) {
      setError(`Error fetching graph data: ${err.message}`);
    }
  }, []);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  // ── Container resize ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height: Math.max(height - 140, 400) });
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── WebSocket step updates ─────────────────────────────────────────────────
  useEffect(() => {
    if (!ws) return;
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'perceptual-simulation-stepped') {
        setCurrentStep(data.step);
      } else if (data.type === 'perceptual-simulation-reset') {
        setCurrentStep(null);
      }
    };
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  // ── Reset layout ───────────────────────────────────────────────────────────
  const handleResetLayout = useCallback(() => {
    try { localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
    zoomTransformRef.current = null;
    setLayoutEpoch(e => e + 1);
  }, []);

  // ── Layout effect — only runs on structural changes, NOT on each step ──────
  useEffect(() => {
    if (!svgRef.current || !graphData || graphData.nodes.length === 0) return;

    const svg    = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    nodeSelRef.current  = null;
    stepTextRef.current = null;
    simRef.current?.stop();
    simRef.current = null;

    const width  = dimensions.width;
    const height = dimensions.height;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    svg.attr('width', width).attr('height', height);

    // Outer group owned by zoom/pan; inner group owns margin translation
    const outerG = svg.append('g');
    const g      = outerG.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const innerWidth  = width  - margin.left - margin.right;
    const innerHeight = height - margin.top  - margin.bottom;

    // ── Pan / zoom ─────────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 4])
      .filter(event => event.type !== 'dblclick')   // dblclick = unpin node
      .on('zoom', (event) => {
        outerG.attr('transform', event.transform);
        zoomTransformRef.current = event.transform;
      });
    svg.call(zoom);
    if (zoomTransformRef.current) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }

    // Restore saved positions before starting simulation
    const savedLayout = loadLayout();
    const simNodes = graphData.nodes.map(n => {
      const saved = savedLayout[n.id];
      const domain = classifyMachine(n).domain;
      return Object.assign({}, n, {
        domain,
        x:  saved?.fx ?? undefined,
        y:  saved?.fy ?? undefined,
        fx: saved?.fx ?? null,
        fy: saved?.fy ?? null,
      });
    }) as (MachineNode & d3.SimulationNodeDatum)[];

    const nodeById = new Map(simNodes.map(n => [n.id, n]));

    const simEdges = graphData.edges.map(e => ({
      ...e,
      source: nodeById.get(e.source) ?? e.source,
      target: nodeById.get(e.target) ?? e.target,
    }));

    // Domain anchors pull same-domain nodes toward a shared quadrant so the
    // hulls emerge as visible bubbles rather than tangled blobs in the center.
    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges).id((d: any) => d.id).distance(200))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('collision', d3.forceCollide().radius(80))
      .force('domainX', d3.forceX<MachineNode & d3.SimulationNodeDatum>(
        d => DOMAINS[(d.domain ?? 'general')].anchor.x * innerWidth,
      ).strength(0.16))
      .force('domainY', d3.forceY<MachineNode & d3.SimulationNodeDatum>(
        d => DOMAINS[(d.domain ?? 'general')].anchor.y * innerHeight,
      ).strength(0.16))
      .alphaDecay(0.02);

    simRef.current = simulation as any;

    // ── Domain hull layer — sits behind edges and nodes ─────────────────────
    // Insert the hull layer BEFORE the edges/nodes are appended so that it
    // renders underneath without stealing pointer events from card hits.
    const hullLayer = g.insert('g', ':first-child').attr('class', 'domain-hulls');

    // Faint anchor labels so empty clusters are still identifiable.
    const labelLayer = g.insert('g', ':first-child').attr('class', 'domain-labels');
    labelLayer.selectAll('text')
      .data(DOMAIN_ORDER)
      .join('text')
      .attr('x', d => DOMAINS[d].anchor.x * innerWidth)
      .attr('y', d => DOMAINS[d].anchor.y * innerHeight - 110)
      .attr('text-anchor', 'middle')
      .attr('font-size', '18px')
      .attr('font-weight', 700)
      .attr('letter-spacing', '3px')
      .attr('fill', d => DOMAINS[d].color)
      .attr('opacity', 0.18)
      .attr('pointer-events', 'none')
      .text(d => DOMAINS[d].label.toUpperCase());

    // Expand each card into its four corners so the hull wraps the card, not
    // just its center point. Matches the pattern from MachineInterconnectionGraph
    // but sized for this view's 160×100 cards with a 20px pad.
    const HULL_PAD = 20;
    const cornerPoints = (n: MachineNode & d3.SimulationNodeDatum): [number, number][] => {
      const x = n.x ?? 0, y = n.y ?? 0;
      const halfW = 80 + HULL_PAD;
      const halfH = 50 + HULL_PAD;
      return [
        [x - halfW, y - halfH],
        [x + halfW, y - halfH],
        [x + halfW, y + halfH],
        [x - halfW, y + halfH],
      ];
    };

    // ── Domain hull drag — translate every machine in the domain together ───
    let hullDragStarts: Map<string, { x: number; y: number }> = new Map();
    let hullDragOrigin = { x: 0, y: 0 };
    const hullDrag = d3.drag<SVGPathElement, { domainId: DomainId; hull: [number, number][] | null }>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.05).restart();
        hullDragStarts = new Map();
        hullDragOrigin = { x: event.x, y: event.y };
        for (const n of simNodes) {
          if ((n.domain ?? 'general') === d.domainId) {
            hullDragStarts.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
            n.fx = n.x ?? 0;
            n.fy = n.y ?? 0;
          }
        }
        (event.sourceEvent as Event)?.stopPropagation?.();
      })
      .on('drag', (event, d) => {
        const dx = event.x - hullDragOrigin.x;
        const dy = event.y - hullDragOrigin.y;
        for (const n of simNodes) {
          if ((n.domain ?? 'general') === d.domainId) {
            const start = hullDragStarts.get(n.id);
            if (!start) continue;
            n.fx = start.x + dx;
            n.fy = start.y + dy;
          }
        }
      })
      .on('end', (event) => {
        if (!event.active) simulation.alphaTarget(0);
        saveLayout(simNodes);
      });

    const drawHulls = () => {
      const byDomain = new Map<DomainId, (MachineNode & d3.SimulationNodeDatum)[]>();
      for (const d of DOMAIN_ORDER) byDomain.set(d, []);
      for (const n of simNodes) byDomain.get((n.domain ?? 'general'))!.push(n);

      const hullData = DOMAIN_ORDER
        .map(domainId => {
          const group = byDomain.get(domainId)!;
          if (group.length === 0) return null;
          const pts: [number, number][] = [];
          for (const n of group) pts.push(...cornerPoints(n));
          const hull = pts.length >= 3 ? d3.polygonHull(pts) : pts;
          return { domainId, hull };
        })
        .filter((h): h is { domainId: DomainId; hull: [number, number][] | null } => h !== null);

      const sel = hullLayer.selectAll<SVGPathElement, typeof hullData[number]>('path.domain-hull')
        .data(hullData, (d: any) => d.domainId);

      sel.exit().remove();

      const enter = sel.enter().append('path')
        .attr('class', 'domain-hull')
        .attr('fill', d => DOMAINS[d.domainId].fill)
        .attr('stroke', d => DOMAINS[d.domainId].color)
        .attr('stroke-opacity', 0.75)
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '8,6')
        .attr('pointer-events', 'all')
        .style('cursor', 'grab')
        .call(hullDrag as any);

      enter.merge(sel as any).attr('d', d => {
        if (!d.hull || d.hull.length === 0) return null;
        const line = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed.alpha(0.6));
        return line(d.hull);
      });
    };

    // ── Edges ──────────────────────────────────────────────────────────────
    const link = g.append('g')
      .selectAll<SVGLineElement, typeof simEdges[0]>('line')
      .data(simEdges)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', vizTheme.edge.idle)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.75);

    const linkLabels = g.append('g')
      .selectAll<SVGTextElement, typeof simEdges[0]>('text')
      .data(simEdges)
      .join('text')
      .attr('class', 'edge-label')
      .attr('font-size', '10px')
      .attr('fill', vizTheme.edge.label)
      .text((d: any) => {
        const sr = d.sourceRegion ?? (d.source as any).outputMapping;
        const tr = d.targetRegion ?? (d.target as any).inputMapping;
        return sr && tr
          ? `[${sr.offset}:${sr.offset + sr.length}] → [${tr.offset}:${tr.offset + tr.length}]`
          : '';
      });

    // ── Nodes ──────────────────────────────────────────────────────────────
    const node = g.append('g')
      .selectAll<SVGGElement, MachineNode & d3.SimulationNodeDatum>('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node');

    nodeSelRef.current = node as any;

    node.append('rect')
      .attr('width', 160)
      .attr('height', 100)
      .attr('x', -80)
      .attr('y', -50)
      .attr('rx', 8)
      .attr('fill', vizTheme.bg.cardIdle)
      .attr('stroke', (d: MachineNode) => DOMAINS[(d.domain ?? 'general')].color)
      .attr('stroke-width', 2.5);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -20)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', vizTheme.text.primary)
      .text((d: MachineNode) => d.name);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 0)
      .attr('font-size', '11px')
      .attr('fill', vizTheme.accent.input)
      .text((d: MachineNode) => `In: [${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length}]`);

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 15)
      .attr('font-size', '11px')
      .attr('fill', vizTheme.accent.output)
      .text((d: MachineNode) => `Out: [${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length}]`);

    const stepText = node.append<SVGTextElement>('text')
      .attr('text-anchor', 'middle')
      .attr('y', 35)
      .attr('font-size', '10px')
      .attr('fill', 'white');

    stepTextRef.current = stepText as any;

    // ── Drag — pin on drop, double-click to unpin ──────────────────────────
    let lastClickTime = 0;
    let lastClickId: string | null = null;

    const drag = d3.drag<SVGGElement, MachineNode & d3.SimulationNodeDatum>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x ?? 0;
        d.fy = d.y ?? 0;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // Pin at dropped position
        d.fx = d.x ?? d.fx;
        d.fy = d.y ?? d.fy;
        saveLayout(simNodes);
      });

    node.call(drag as any);

    // Double-click to unpin
    node.on('dblclick', (_event, d: any) => {
      const now = Date.now();
      if (now - lastClickTime < 350 && lastClickId === d.id) {
        d.fx = null;
        d.fy = null;
        simulation.alpha(0.3).restart();
        saveLayout(simNodes);
      }
      lastClickTime = now;
      lastClickId   = d.id;
    });

    // ── Simulation tick ────────────────────────────────────────────────────
    simulation.on('tick', () => {
      drawHulls();

      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
    // layoutEpoch is intentionally included so Reset Layout triggers a rebuild
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, dimensions, layoutEpoch]);

  // ── State update effect — updates node appearance on each step ─────────────
  // Does NOT touch the simulation or positions.
  useEffect(() => {
    const node     = nodeSelRef.current;
    const stepText = stepTextRef.current;
    if (!node) return;

    node.select<SVGRectElement>('rect')
      .attr('fill', (d: MachineNode) =>
        currentStep?.machineResults[d.id] ? '#06b6d4' : vizTheme.bg.cardIdle
      );

    if (stepText) {
      stepText.text((d: MachineNode) => {
        const result = currentStep?.machineResults[d.id];
        if (result?.outputVector) {
          return `Output: [${result.outputVector.join(', ')}]`;
        }
        return '';
      });
    }
  }, [currentStep]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="machine-graph-view error">
        <h2>Machine Graph View</h2>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!graphData) {
    return (
      <div className="machine-graph-view loading">
        <h2>Machine Graph View</h2>
        <div>Loading machine graph...</div>
      </div>
    );
  }

  return (
    <div className="machine-graph-view" ref={containerRef}>
      <div className="graph-header">
        <h2>Machine Graph View</h2>
        <div className="graph-info">
          <span>Machines: {graphData.nodes.length}</span>
          <span>Connections: {graphData.edges.length}</span>
          <span>Perceptual Space: {graphData.perceptualSpaceDimension}D</span>
          {currentStep && (
            <span className="step-indicator">Step: {currentStep.stepNumber}</span>
          )}
        </div>
        <button
          className="vis-reset-layout-btn"
          onClick={handleResetLayout}
          title="Clear pinned positions and let force layout run freely"
        >
          ⊹ Reset Layout
        </button>
      </div>

      <div className="machine-graph-svg-wrapper">
        {/* Floating left-side legend — same placement as Tobias */}
        <div className={`vis-legend-panel${legendOpen ? ' open' : ''}`}>
          <button
            className="vis-legend-tab"
            onClick={() => setLegendOpen(o => !o)}
            title={legendOpen ? 'Hide legend' : 'Show legend'}
          >
            LEGEND
          </button>
          <div className="vis-legend-content">
            <div className="vis-legend-items">
              <div className="vis-legend-item">
                <span className="vis-legend-dot" style={{ background: '#06b6d4' }} />
                <span>Active machine</span>
              </div>
              <div className="vis-legend-item">
                <span className="vis-legend-dot" style={{ background: vizTheme.bg.cardIdle, border: `1px solid ${vizTheme.outline.idle}` }} />
                <span>Idle machine</span>
              </div>
              <div className="vis-legend-divider" />
              <div className="vis-legend-item">
                <span className="vis-legend-dash" />
                <span>Data flow</span>
              </div>
              <div className="vis-legend-divider" />
              <div className="vis-legend-item" style={{ color: vizTheme.text.secondary, fontSize: '10px' }}>
                Scroll to zoom · Drag to pan
              </div>
              <div className="vis-legend-item" style={{ color: vizTheme.text.secondary, fontSize: '10px' }}>
                Drag node to pin
              </div>
              <div className="vis-legend-item" style={{ color: vizTheme.text.secondary, fontSize: '10px' }}>
                Double-click to unpin
              </div>
            </div>
          </div>
        </div>

        <svg ref={svgRef} className="machine-graph-svg"></svg>
      </div>
    </div>
  );
};
