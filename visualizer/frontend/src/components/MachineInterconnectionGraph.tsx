/**
 * MachineInterconnectionGraph - Enhanced D3.js visualization with perceptual space integration
 *
 * Shows machines as nodes with:
 * - Tooltips on hover with metadata and status
 * - Real-time perceptual space updates
 * - Internal machine status visualization
 * - Preception cycle indicators
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import './MachineInterconnectionGraph.css';
import { useVisualizerStore } from '../store';
import {
  classifyMachine,
  DOMAINS,
  DOMAIN_BOX_HALF,
  DOMAIN_ORDER,
  DomainId,
} from './machineDomains';
import { vizTheme } from '../styles/vizTheme';

interface Machine {
  id: string;
  name: string;
  description: string;
  perceptualMapping?: {
    input: { offset: number; length: number };
    output: { offset: number; length: number };
  };
  metadata?: Record<string, any>;
  sequenceCount?: number;
}

interface MachineNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  description: string;
  inputMapping: { offset: number; length: number };
  outputMapping: { offset: number; length: number };
  isCurrent: boolean;
  isConnected: boolean;
  metadata?: Record<string, any>;
  sequenceCount?: number;
  // Domain classification
  domain: DomainId;
  isExternal: boolean;
  // Runtime status
  status?: 'idle' | 'processing' | 'active';
  lastInput?: number[];
  lastOutput?: number[];
}

interface MachineLink {
  source: string | MachineNode;
  target: string | MachineNode;
  sourceRegion: { offset: number; length: number };
  targetRegion: { offset: number; length: number };
  overlapSize: number;
  sourceDomain: DomainId;
  targetDomain: DomainId;
  crossDomain: boolean;
  externalBridge: boolean;
}

interface PerceptualSpaceUpdate {
  stepNumber: number;
  perceptualSpace: number[];
  machineResults: Record<string, {
    machineId: string;
    machineName: string;
    inputVector: number[];
    outputVector: number[] | null;
  }>;
}

interface MachineInterconnectionGraphProps {
  currentMachineId: string;
  machines: Machine[];
}

export const MachineInterconnectionGraph: React.FC<MachineInterconnectionGraphProps> = ({
  currentMachineId,
  machines
}) => {
  const { ws, loadMachine } = useVisualizerStore();
  const loadMachineRef = useRef(loadMachine);
  useEffect(() => { loadMachineRef.current = loadMachine; }, [loadMachine]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 });
  // Persist node positions and zoom/pan across layout rebuilds so that
  // per-step state updates (status colors, vectors) never reset the layout.
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null);
  const [perceptualSpace, setPerceptualSpace] = useState<number[]>([]);
  const [machineStatuses, setMachineStatuses] = useState<Record<string, {
    status: 'idle' | 'processing' | 'active';
    lastInput?: number[];
    lastOutput?: number[];
  }>>({});
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Domain filter — each entry enables/disables a whole domain cluster.
  const [enabledDomains, setEnabledDomains] = useState<Record<DomainId, boolean>>({
    healthservices: true,
    lifebalance: true,
    healthpersonal: true,
    builtspace: true,
    transportation: true,
    legalservices: true,
    communityservices: true,
    agriculture: true,
    datacenter: true,
    digitallogic: true,
    ai: true,
    general: true,
  });

  // Classify every machine once per machine list change.
  const classifications = useMemo(() => {
    const map = new Map<string, ReturnType<typeof classifyMachine>>();
    for (const m of machines) map.set(m.id, classifyMachine(m));
    return map;
  }, [machines]);

  // Domain membership counts for the legend.
  const domainCounts = useMemo(() => {
    const counts: Record<DomainId, number> = {
      healthservices: 0, lifebalance: 0, healthpersonal: 0,
      builtspace: 0, transportation: 0, legalservices: 0,
      communityservices: 0, agriculture: 0, datacenter: 0,
      digitallogic: 0, ai: 0, general: 0,
    };
    for (const c of classifications.values()) counts[c.domain]++;
    return counts;
  }, [classifications]);

  const externalCount = useMemo(() => {
    let n = 0;
    for (const c of classifications.values()) if (c.isExternal) n++;
    return n;
  }, [classifications]);

  // Track container size with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Listen for WebSocket updates for perceptual space.
  // Depend on `ws` so we re-subscribe whenever the connection is (re)established.
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'perceptual-simulation-stepped') {
        const update: PerceptualSpaceUpdate = data.step;
        setCurrentStep(update.stepNumber);
        setPerceptualSpace(update.perceptualSpace);

        // Update machine statuses
        const newStatuses: Record<string, any> = {};
        Object.entries(update.machineResults).forEach(([machineId, result]) => {
          newStatuses[machineId] = {
            status: result.outputVector ? 'active' : 'processing',
            lastInput: result.inputVector,
            lastOutput: result.outputVector || undefined
          };
        });
        setMachineStatuses(newStatuses);
      } else if (data.type === 'perceptual-simulation-reset') {
        setPerceptualSpace([]);
        setMachineStatuses({});
        setCurrentStep(0);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  useEffect(() => {
    if (!svgRef.current || !machines || machines.length === 0) return;

    const { width, height } = dimensions;

    // Filter machines that have perceptual mappings AND whose domain is enabled.
    const validMachines = machines.filter(m => {
      if (!m.perceptualMapping) return false;
      const cls = classifications.get(m.id);
      if (!cls) return true;
      return enabledDomains[cls.domain];
    });

    if (validMachines.length === 0) {
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', vizTheme.text.secondary)
        .attr('font-size', '16px')
        .text('No machines with perceptual mappings configured');
      return;
    }

    // Determine connections
    const currentMachine = validMachines.find(m => m.id === currentMachineId);
    const connectedMachineIds = new Set<string>();

    if (currentMachine && currentMachine.perceptualMapping) {
      const { input: currentInput, output: currentOutput } = currentMachine.perceptualMapping;

      validMachines.forEach(m => {
        if (m.id === currentMachineId || !m.perceptualMapping) return;

        const { input: mInput, output: mOutput } = m.perceptualMapping;
        const currentOutputEnd = currentOutput.offset + currentOutput.length;
        const mInputEnd = mInput.offset + mInput.length;
        const outputToInput = !(currentOutputEnd <= mInput.offset || currentOutput.offset >= mInputEnd);

        const mOutputEnd = mOutput.offset + mOutput.length;
        const currentInputEnd = currentInput.offset + currentInput.length;
        const inputFromOutput = !(mOutputEnd <= currentInput.offset || mOutput.offset >= currentInputEnd);

        if (outputToInput || inputFromOutput) {
          connectedMachineIds.add(m.id);
        }
      });
    }

    // Per-domain disjoint bounding box.  Each domain occupies one cell in
    // a 4×3 grid; node positions are clamped to this box on every tick so
    // hulls from different domains never overlap.
    const domainBox = (domain: DomainId) => {
      const a = DOMAINS[domain].anchor;
      return {
        xMin: a.x * width - DOMAIN_BOX_HALF.x * width,
        xMax: a.x * width + DOMAIN_BOX_HALF.x * width,
        yMin: a.y * height - DOMAIN_BOX_HALF.y * height,
        yMax: a.y * height + DOMAIN_BOX_HALF.y * height,
      };
    };
    const clampX = (x: number, box: { xMin: number; xMax: number }) =>
      Math.max(box.xMin, Math.min(box.xMax, x));
    const clampY = (y: number, box: { yMin: number; yMax: number }) =>
      Math.max(box.yMin, Math.min(box.yMax, y));

    // Convert machines to nodes — status starts idle; the separate update
    // effect applies live per-step status without rebuilding the simulation.
    const nodes: MachineNode[] = validMachines.map(m => {
      const saved = nodePositionsRef.current.get(m.id);
      const cls = classifications.get(m.id) ?? { domain: 'general' as DomainId, isExternal: false, reason: 'missing' };
      const box = domainBox(cls.domain);
      // Seed positions inside the domain's box, distributed so the force
      // simulation has a starting point that already respects disjointness.
      const seedX = box.xMin + Math.random() * (box.xMax - box.xMin);
      const seedY = box.yMin + Math.random() * (box.yMax - box.yMin);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        inputMapping: m.perceptualMapping!.input,
        outputMapping: m.perceptualMapping!.output,
        isCurrent: m.id === currentMachineId,
        isConnected: m.id === currentMachineId || connectedMachineIds.has(m.id),
        metadata: m.metadata,
        sequenceCount: m.sequenceCount,
        domain: cls.domain,
        isExternal: cls.isExternal,
        status: 'idle' as const,
        // Restore saved position when valid, but clamp to the current box so
        // a domain rename or grid resize re-anchors the node correctly.
        x: saved ? clampX(saved.x, box) : seedX,
        y: saved ? clampY(saved.y, box) : seedY,
      };
    });

    // Detect links — output(A) ∩ input(B) ⇒ A drives B.  Tag each link with
    // its endpoints' domains so layout + styling can differentiate intra-
    // vs cross-domain flow and highlight external bridges.
    const links: MachineLink[] = [];
    for (let i = 0; i < validMachines.length; i++) {
      const sourceM = validMachines[i];
      if (!sourceM || !sourceM.perceptualMapping) continue;

      for (let j = 0; j < validMachines.length; j++) {
        if (i === j) continue;
        const targetM = validMachines[j];
        if (!targetM || !targetM.perceptualMapping) continue;

        const sourceOutput = sourceM.perceptualMapping.output;
        const targetInput = targetM.perceptualMapping.input;
        const sourceEnd = sourceOutput.offset + sourceOutput.length;
        const targetEnd = targetInput.offset + targetInput.length;
        const overlapStart = Math.max(sourceOutput.offset, targetInput.offset);
        const overlapEnd = Math.min(sourceEnd, targetEnd);

        if (overlapStart < overlapEnd) {
          const overlapSize = overlapEnd - overlapStart;
          const srcCls = classifications.get(sourceM.id);
          const tgtCls = classifications.get(targetM.id);
          const sourceDomain: DomainId = srcCls?.domain ?? 'general';
          const targetDomain: DomainId = tgtCls?.domain ?? 'general';
          links.push({
            source: sourceM.id,
            target: targetM.id,
            sourceRegion: sourceOutput,
            targetRegion: targetInput,
            overlapSize,
            sourceDomain,
            targetDomain,
            crossDomain: sourceDomain !== targetDomain,
            externalBridge: !!(srcCls?.isExternal || tgtCls?.isExternal),
          });
        }
      }
    }

    // Clear previous visualization
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const g = svg.append('g');

    // Domain hulls sit *behind* links and nodes so they don't steal clicks.
    const hullLayer = g.append('g').attr('class', 'domain-hulls');

    // Add zoom — save transform so it survives topology rebuilds.
    // Ignore mousedowns that originate on a hull or node so those drags win
    // without a competing pan (d3-drag does not stop mousedown propagation).
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .filter(event => {
        if (event.type === 'dblclick') return false;
        const t = event.target as Element | null;
        if (t?.closest?.('.domain-hull')) return false;
        if (t?.closest?.('g.node')) return false;
        return true;
      })
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        g.attr('transform', event.transform);
      });
    svg.call(zoom as any);
    // Restore previous zoom/pan if the layout was already established
    if (zoomTransformRef.current) {
      svg.call((zoom as any).transform, zoomTransformRef.current);
    }

    // Create simulation — intra-domain links pull harder than cross-domain.
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id)
        .distance((l: any) => l.crossDomain ? 340 : 220)
        .strength((l: any) => l.crossDomain ? 0.25 : 0.7))
      .force('charge', d3.forceManyBody().strength(-900))
      .force('collision', d3.forceCollide().radius(120))
      // Per-domain anchor forces replace the single center gravity.  Each node
      // is pulled toward its domain's quadrant so clusters emerge naturally
      // while the force-directed layout still resolves link overlaps.
      .force('domainX', d3.forceX<MachineNode>(d => DOMAINS[d.domain].anchor.x * width).strength(0.18))
      .force('domainY', d3.forceY<MachineNode>(d => DOMAINS[d.domain].anchor.y * height).strength(0.18));

    // Draw links
    const link = g.append('g').attr('class', 'links').selectAll('g').data(links).join('g');

    const endpointNodes = (d: MachineLink) => {
      const sId = typeof d.source === 'string' ? d.source : d.source.id;
      const tId = typeof d.target === 'string' ? d.target : d.target.id;
      return {
        s: nodes.find(n => n.id === sId),
        t: nodes.find(n => n.id === tId),
      };
    };

    const linkPath = link.append('path')
      .attr('class', 'link-path')
      .attr('fill', 'none')
      .attr('stroke', (d: MachineLink) => {
        const { s, t } = endpointNodes(d);
        if (s?.isCurrent || t?.isCurrent) return vizTheme.edge.active;
        if (d.externalBridge) return vizTheme.edge.bridge;
        if (!d.crossDomain) return DOMAINS[d.sourceDomain].color;
        return vizTheme.edge.idle;
      })
      .attr('stroke-width', (d: MachineLink) => {
        const { s, t } = endpointNodes(d);
        if (s?.isCurrent || t?.isCurrent) return 3;
        return d.crossDomain ? 1.5 : 2.2;
      })
      .attr('stroke-dasharray', (d: MachineLink) =>
        d.externalBridge ? '6,4' : d.crossDomain ? '3,3' : null)
      .attr('opacity', (d: MachineLink) => {
        const { s, t } = endpointNodes(d);
        if (!s?.isConnected || !t?.isConnected) return 0.22;
        return d.crossDomain ? 0.55 : 0.8;
      })
      .attr('marker-end', (d: MachineLink) => {
        const { s, t } = endpointNodes(d);
        return (s?.isCurrent || t?.isCurrent) ? 'url(#arrowhead-active)' : 'url(#arrowhead)';
      });

    // Arrowheads
    svg.append('defs').selectAll('marker')
      .data(['arrowhead', 'arrowhead-active'])
      .join('marker')
      .attr('id', markerType => markerType)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', markerType => markerType === 'arrowhead-active' ? vizTheme.edge.active : vizTheme.edge.arrowhead);

    // Link labels
    const linkLabel = link.append('text')
      .attr('class', 'link-label')
      .attr('font-size', '10px')
      .attr('fill', vizTheme.edge.label)
      .attr('text-anchor', 'middle')
      .text((d: MachineLink) =>
        `[${d.sourceRegion.offset}:${d.sourceRegion.offset + d.sourceRegion.length - 1}] → [${d.targetRegion.offset}:${d.targetRegion.offset + d.targetRegion.length - 1}]`
      );

    // Draw nodes
    const node = g.append('g').attr('class', 'nodes').selectAll('g').data(nodes).join('g')
      .attr('class', 'node')
      .call(d3.drag<any, MachineNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)
      .on('dblclick', (_event: any, d: MachineNode) => {
        loadMachineRef.current(d.id);
      });

    // Node rectangles — data-field marker allows the update effect to patch
    // colors in-place without a full simulation rebuild.  Border color
    // encodes the machine's domain so the cluster remains identifiable even
    // when nodes drift between force regions.
    node.append('rect')
      .attr('data-field', 'status-rect')
      .attr('width', 200)
      .attr('height', 140)
      .attr('x', -100)
      .attr('y', -70)
      .attr('rx', 10)
      .attr('fill', (d: MachineNode) => d.isCurrent ? vizTheme.bg.cardActive : d.isConnected ? vizTheme.bg.cardConnected : vizTheme.bg.cardIdle)
      .attr('stroke', (d: MachineNode) => DOMAINS[d.domain].color)
      .attr('stroke-width', (d: MachineNode) => d.isCurrent ? 4 : 2.5)
      .attr('opacity', (d: MachineNode) => d.isConnected ? 1 : 0.7)
      .on('mouseover', showTooltip)
      .on('mousemove', moveTooltip)
      .on('mouseout', hideTooltip);

    // Domain badge strip across the top of every node.
    node.append('rect')
      .attr('width', 200)
      .attr('height', 6)
      .attr('x', -100)
      .attr('y', -70)
      .attr('rx', 3)
      .attr('fill', (d: MachineNode) => DOMAINS[d.domain].color)
      .attr('opacity', 0.9);

    // External-entity chip (localAIStack bridges).
    node.filter((d: MachineNode) => d.isExternal)
      .append('g')
      .attr('class', 'external-chip')
      .call(g => {
        g.append('rect')
          .attr('x', -96).attr('y', -64)
          .attr('width', 66).attr('height', 14)
          .attr('rx', 7)
          .attr('fill', vizTheme.accent.externalFill)
          .attr('opacity', 0.9);
        g.append('text')
          .attr('x', -63).attr('y', -54)
          .attr('text-anchor', 'middle')
          .attr('font-size', '9px')
          .attr('font-weight', 700)
          .attr('fill', vizTheme.text.emphasis)
          .text('↯ EXTERNAL');
      });

    // Domain label chip (opposite corner from external chip).
    node.append('text')
      .attr('x', 94).attr('y', -54)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('font-weight', 700)
      .attr('fill', (d: MachineNode) => DOMAINS[d.domain].color)
      .text((d: MachineNode) => DOMAINS[d.domain].short.toUpperCase());

    // Current machine indicator
    node.filter((d: MachineNode) => d.isCurrent)
      .append('rect')
      .attr('width', 210)
      .attr('height', 150)
      .attr('x', -105)
      .attr('y', -75)
      .attr('rx', 12)
      .attr('fill', 'none')
      .attr('stroke', vizTheme.outline.focus)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.6);

    // Machine name
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -40)
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', (d: MachineNode) => d.isCurrent ? vizTheme.accent.current : vizTheme.text.primary)
      .text((d: MachineNode) => {
        const maxLen = 20;
        return d.name.length > maxLen ? d.name.substring(0, maxLen) + '...' : d.name;
      });

    // Status indicator
    node.append('circle')
      .attr('data-field', 'status-dot')
      .attr('cx', 85)
      .attr('cy', -60)
      .attr('r', 6)
      .attr('fill', vizTheme.status.dotIdle)
      .attr('opacity', 0.9);

    // Input mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -18)
      .attr('font-size', '11px')
      .attr('fill', vizTheme.accent.input)
      .text((d: MachineNode) => `In: [${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length - 1}]`);

    // Output mapping
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -3)
      .attr('font-size', '11px')
      .attr('fill', vizTheme.accent.outputBright)
      .text((d: MachineNode) => `Out: [${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length - 1}]`);

    // Last input vector — starts empty; filled by update effect
    node.append('text')
      .attr('data-field', 'last-input')
      .attr('text-anchor', 'middle')
      .attr('y', 15)
      .attr('font-size', '9px')
      .attr('fill', vizTheme.text.secondary);

    // Last output vector — starts empty; filled by update effect
    node.append('text')
      .attr('data-field', 'last-output')
      .attr('text-anchor', 'middle')
      .attr('y', 30)
      .attr('font-size', '9px')
      .attr('fill', vizTheme.accent.output);

    // Sequence count
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 50)
      .attr('font-size', '10px')
      .attr('fill', vizTheme.text.secondary)
      .text((d: MachineNode) => d.sequenceCount ? `${d.sequenceCount} sequences` : '');

    // Group nodes by domain for hull rendering.  Hulls are recomputed each
    // tick so they deform smoothly as the force simulation settles.
    const nodesByDomain = new Map<DomainId, MachineNode[]>();
    for (const d of DOMAIN_ORDER) nodesByDomain.set(d, []);
    for (const n of nodes) nodesByDomain.get(n.domain)!.push(n);

    // Tight hull halo — a small offset around the node *center* (not around
    // the full card extent).  The inter-cell gap in the 4×3 grid is at least
    // 28 px vertically and 48 px horizontally, so a 12 px halo guarantees
    // hulls from adjacent domains never share a pixel.
    const HULL_HALO = 12;
    const cornerPoints = (n: MachineNode): [number, number][] => {
      const x = n.x ?? 0, y = n.y ?? 0;
      return [
        [x - HULL_HALO, y - HULL_HALO],
        [x + HULL_HALO, y - HULL_HALO],
        [x + HULL_HALO, y + HULL_HALO],
        [x - HULL_HALO, y + HULL_HALO],
      ];
    };

    // Domain hull drag is intentionally disabled: each domain is bound to a
    // fixed grid cell so its hull can't be moved without breaking
    // disjointness.  Hull elements are pointer-events:none so they don't
    // intercept clicks meant for nodes underneath.

    const drawHulls = () => {
      const hullData = DOMAIN_ORDER
        .map(domainId => {
          const group = nodesByDomain.get(domainId)!;
          if (group.length === 0) return null;
          // Anchor the hull at its domain's box corners as a fallback so
          // domains with a single node (or fewer than 3 unique points) still
          // render a bubble that sits inside the cell.
          const box = domainBox(domainId);
          const pts: [number, number][] = [
            [box.xMin + 4, box.yMin + 4],
            [box.xMax - 4, box.yMin + 4],
            [box.xMax - 4, box.yMax - 4],
            [box.xMin + 4, box.yMax - 4],
          ];
          for (const n of group) pts.push(...cornerPoints(n));
          const hull = pts.length >= 3 ? d3.polygonHull(pts) : pts;
          return { domainId, hull };
        })
        .filter((h): h is { domainId: DomainId; hull: [number, number][] | null } => h !== null);

      const hullSel = hullLayer.selectAll<SVGPathElement, typeof hullData[number]>('path.domain-hull')
        .data(hullData, (d: any) => d.domainId);

      hullSel.exit().remove();

      const hullEnter = hullSel.enter().append('path')
        .attr('class', 'domain-hull')
        .attr('fill', d => DOMAINS[d.domainId].fill)
        .attr('stroke', d => DOMAINS[d.domainId].color)
        .attr('stroke-opacity', 0.75)
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '8,6')
        .attr('pointer-events', 'none');

      hullEnter.merge(hullSel as any).attr('d', d => {
        if (!d.hull || d.hull.length === 0) return null;
        const line = d3.line<[number, number]>().curve(d3.curveCatmullRomClosed.alpha(0.6));
        return line(d.hull);
      });
    };

    // Domain labels floating at the anchor points so empty clusters are still legible.
    const domainLabelLayer = g.append('g').attr('class', 'domain-labels');
    domainLabelLayer.selectAll('text')
      .data(DOMAIN_ORDER)
      .join('text')
      .attr('class', 'domain-anchor-label')
      .attr('x', d => DOMAINS[d].anchor.x * width)
      .attr('y', d => DOMAINS[d].anchor.y * height - 120)
      .attr('text-anchor', 'middle')
      .attr('font-size', '20px')
      .attr('font-weight', 700)
      .attr('letter-spacing', '3px')
      .attr('fill', d => DOMAINS[d].color)
      .attr('opacity', 0.22)
      .text(d => DOMAINS[d].label.toUpperCase());

    // Update simulation — also persist positions so rebuilds preserve layout
    simulation.on('tick', () => {
      // Clamp every node to its domain's box.  This runs after the force
      // step, so cross-domain link forces and charge repulsion can shove
      // nodes around but they always snap back inside their cell.  Both
      // the live position (x/y) and any pinned position (fx/fy from drag)
      // are clamped so dragging a node out of its cell is rejected.
      for (const n of nodes) {
        const box = domainBox(n.domain);
        if (n.fx != null) n.fx = clampX(n.fx, box);
        else if (n.x != null) n.x = clampX(n.x, box);
        if (n.fy != null) n.fy = clampY(n.fy, box);
        else if (n.y != null) n.y = clampY(n.y, box);
        if (n.x != null && n.y != null) nodePositionsRef.current.set(n.id, { x: n.x, y: n.y });
      }

      drawHulls();

      linkPath.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragstarted(event: any, d: MachineNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: MachineNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: MachineNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Tooltip functions
    function showTooltip(event: any, d: MachineNode) {
      if (!tooltipRef.current) return;

      const tooltip = d3.select(tooltipRef.current);
      tooltip.style('display', 'block');

      let content = `
        <div class="tooltip-title">${d.name}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">Domain:</span>
          <span class="tooltip-value" style="color: ${DOMAINS[d.domain].color}">
            ${DOMAINS[d.domain].label}${d.isExternal ? ' · External' : ''}
          </span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Status:</span>
          <span class="tooltip-value">${d.status || 'idle'}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Description:</span>
          <span class="tooltip-value">${d.description}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Input Region:</span>
          <span class="tooltip-value">[${d.inputMapping.offset}:${d.inputMapping.offset + d.inputMapping.length}]</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Output Region:</span>
          <span class="tooltip-value">[${d.outputMapping.offset}:${d.outputMapping.offset + d.outputMapping.length}]</span>
        </div>
      `;

      if (d.sequenceCount) {
        content += `
          <div class="tooltip-row">
            <span class="tooltip-label">Sequences:</span>
            <span class="tooltip-value">${d.sequenceCount}</span>
          </div>
        `;
      }

      if (d.metadata) {
        const metaKeys = Object.keys(d.metadata);
        if (metaKeys.length > 0) {
          content += `<div class="tooltip-row"><span class="tooltip-label">Metadata:</span></div>`;
          metaKeys.slice(0, 3).forEach(key => {
            content += `
              <div class="tooltip-row" style="margin-left: 10px;">
                <span class="tooltip-label">${key}:</span>
                <span class="tooltip-value">${JSON.stringify(d.metadata![key]).substring(0, 30)}</span>
              </div>
            `;
          });
        }
      }

      if (d.lastInput && d.lastInput.length > 0) {
        content += `
          <div class="tooltip-row">
            <span class="tooltip-label">Last Input:</span>
            <span class="tooltip-value">[${d.lastInput.map(v => v.toFixed(2)).join(', ')}]</span>
          </div>
        `;
      }

      if (d.lastOutput && d.lastOutput.length > 0) {
        content += `
          <div class="tooltip-row">
            <span class="tooltip-label">Last Output:</span>
            <span class="tooltip-value">[${d.lastOutput.map(v => v.toFixed(2)).join(', ')}]</span>
          </div>
        `;
      }

      tooltip.html(content);
      moveTooltip(event);
    }

    function moveTooltip(event: any) {
      if (!tooltipRef.current) return;
      const tooltip = d3.select(tooltipRef.current);
      tooltip
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    }

    function hideTooltip() {
      if (!tooltipRef.current) return;
      d3.select(tooltipRef.current).style('display', 'none');
    }

    // Cleanup
    return () => {
      simulation.stop();
    };

  // Intentionally excludes machineStatuses and perceptualSpace — per-step
  // status updates are applied in-place by the effect below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machines, currentMachineId, dimensions, classifications, enabledDomains]);

  // ── Lightweight per-step update — patches colors/text without rebuilding ──
  // Runs whenever machine statuses change (every WebSocket step) but never
  // touches positions, zoom, or the D3 simulation.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll<SVGGElement, MachineNode>('g.node').each(function(d) {
      const info   = machineStatuses[d.id];
      const status = info?.status ?? 'idle';

      d3.select(this).select('rect[data-field="status-rect"]')
        .attr('fill', () => {
          if (status === 'active')     return vizTheme.status.activeFill;
          if (status === 'processing') return vizTheme.status.processingFill;
          if (d.isCurrent)             return vizTheme.bg.cardActive;
          if (d.isConnected)           return vizTheme.bg.cardConnected;
          return vizTheme.bg.cardIdle;
        })
        // Idle nodes keep their domain color so clusters remain readable;
        // active/processing override to convey runtime urgency.
        .attr('stroke', () => {
          if (status === 'active')     return vizTheme.status.activeStroke;
          if (status === 'processing') return vizTheme.status.processingStroke;
          return DOMAINS[d.domain].color;
        });

      d3.select(this).select('circle[data-field="status-dot"]')
        .attr('fill', () => {
          if (status === 'active')     return vizTheme.status.dotActive;
          if (status === 'processing') return vizTheme.status.dotProcessing;
          return vizTheme.status.dotIdle;
        });

      const iv = info?.lastInput;
      d3.select(this).select('text[data-field="last-input"]')
        .text(() => {
          if (iv && iv.length > 0) {
            const preview = iv.slice(0, 4).map((v: number) => v.toFixed(1)).join(',');
            return `In: [${preview}${iv.length > 4 ? '...' : ''}]`;
          }
          return '';
        });

      const ov = info?.lastOutput;
      d3.select(this).select('text[data-field="last-output"]')
        .text(() => {
          if (ov && ov.length > 0) {
            const preview = ov.slice(0, 4).map((v: number) => v.toFixed(1)).join(',');
            return `Out: [${preview}${ov.length > 4 ? '...' : ''}]`;
          }
          return '';
        });
    });
  }, [machineStatuses]);

  return (
    <div ref={containerRef} className="machine-interconnection-graph">
      <svg ref={svgRef} className="graph-svg"></svg>

      {/* Enhanced tooltip */}
      <div ref={tooltipRef} className="node-tooltip" style={{ display: 'none' }}></div>

      {/* Perceptual space status indicator */}
      {perceptualSpace.length > 0 && (
        <div className="perceptual-status">
          <div className="status-header">
            <span className="status-title">Perceptual Space (En)</span>
            <span className="status-step">Step: {currentStep}</span>
          </div>
          <div className="status-info">
            <span>{perceptualSpace.length}D vector</span>
            <span>Non-zero: {perceptualSpace.filter(v => v !== 0).length}</span>
          </div>
        </div>
      )}

      {/* Domain legend — click to toggle a domain's nodes on/off */}
      <div className="graph-legend">
        <div className="legend-section-title">Domains of Effect</div>
        {DOMAIN_ORDER.map(domainId => {
          const def = DOMAINS[domainId];
          const enabled = enabledDomains[domainId];
          const count = domainCounts[domainId];
          return (
            <button
              key={domainId}
              className={`legend-item legend-toggle ${enabled ? 'enabled' : 'disabled'}`}
              onClick={() =>
                setEnabledDomains(prev => ({ ...prev, [domainId]: !prev[domainId] }))
              }
              title={def.description}
            >
              <div
                className="legend-box"
                style={{ backgroundColor: def.fill, borderColor: def.color, borderWidth: 2 }}
              />
              <span className="legend-label">{def.label}</span>
              <span className="legend-count">{count}</span>
            </button>
          );
        })}

        {externalCount > 0 && (
          <div className="legend-item" title="Machines registered by an external stack (e.g. localAIStack)">
            <div className="legend-box" style={{
              borderColor: vizTheme.accent.externalFill,
              backgroundColor: 'rgba(168, 85, 247, 0.28)',
              borderStyle: 'dashed',
              borderWidth: 2,
            }} />
            <span className="legend-label">External Bridge</span>
            <span className="legend-count">{externalCount}</span>
          </div>
        )}

        <div className="legend-divider" />
        <div className="legend-section-title">Runtime</div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: vizTheme.status.activeFill, borderColor: vizTheme.status.activeStroke }} />
          <span>Active (Output)</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: vizTheme.status.processingFill, borderColor: vizTheme.status.processingStroke }} />
          <span>Processing</span>
        </div>
        <div className="legend-item">
          <div className="legend-arrow" />
          <span>Data Flow</span>
        </div>
      </div>

    </div>
  );
};
