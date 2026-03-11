import * as d3 from 'd3';
import type { VisMachine, VisMachineSequence } from '../../hooks/useMachineSimulation';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const CARD_W   = 240;
const HEADER_H = 24;
const FOOTER_H = 22;
const PAD      = 10;
const INNER_W  = CARD_W - PAD * 2;   // 220 px available width per sequence band
const BAND_H   = 74;                  // height of each sequence band
const DIVIDER_H = 8;                  // vertical gap between bands
const NODE_R   = 5;
const ARROW_SIZE = 5;
const HIT_EXTRA  = 5;                 // extra px around node for hover hit testing

// Node state colours
const COLOR_INITIAL  = '#3b82f6'; // blue   — isInitial (always armed, A+)
const COLOR_FIRED    = '#a855f7'; // purple — terminal, just fired this step
const COLOR_TERMINAL = '#f59e0b'; // amber  — terminal, not fired
const COLOR_DEFAULT  = '#64748b'; // slate  — intermediate
const COLOR_HOVER    = '#facc15'; // yellow — hover highlight

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InnerNode {
  id: string;
  label: string;
  seqIdx: number;     // which sequence band this node belongs to
  ix: number;         // x in inner-graph coordinate space (origin = inner-area top-left)
  iy: number;         // y in inner-graph coordinate space
  isInitial: boolean;
  hasOutput: boolean;
  justFired: boolean;
  elements: { value: number; comparatorType: string; threshold?: number }[];
}

interface InnerEdge {
  source: InnerNode;
  target: InnerNode;
  bend: number; // perpendicular offset for quadratic bezier
}

interface SeqBand {
  yStart: number; // top of the band in inner-graph space
  yEnd: number;   // bottom of the band
  name: string;   // sequence name (truncated for display)
}

interface InnerGraphCache {
  nodes: InnerNode[];
  edges: InnerEdge[];
  neighbors: Map<string, Set<string>>;
  seqBands: SeqBand[];
  totalHeight: number; // sum of all bands + dividers
}

interface CardNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  machine: VisMachine;
  w: number;
  h: number;         // dynamic: HEADER_H + FOOTER_H + innerGraph.totalHeight + PAD*2
  headerH: number;
  innerGraph: InnerGraphCache;
}

interface OuterEdge {
  source: CardNode;
  target: CardNode;
  overlapLength: number;
}

interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

export interface TobiasRendererOptions {
  canvas: HTMLCanvasElement;
  onSelectMachine: (id: string | null) => void;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function hashToUnit(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function statusColor(status: VisMachine['status']): string {
  switch (status) {
    case 'active':     return '#22c55e';
    case 'processing': return '#a855f7';
    default:           return '#334155';
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  tx: number, ty: number,
  color: string,
): void {
  const adx = tx - cx, ady = ty - cy;
  const alen = Math.hypot(adx, ady) || 1;
  const ax = adx / alen, ay = ady / alen;
  const ex = tx - ax * NODE_R, ey = ty - ay * NODE_R;
  const px = -ay, py = ax;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - ax * ARROW_SIZE + px * ARROW_SIZE * 0.4, ey - ay * ARROW_SIZE + py * ARROW_SIZE * 0.4);
  ctx.lineTo(ex - ax * ARROW_SIZE - px * ARROW_SIZE * 0.4, ey - ay * ARROW_SIZE - py * ARROW_SIZE * 0.4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function nodeColor(node: InnerNode, isHovered: boolean): string {
  if (isHovered)      return COLOR_HOVER;
  if (node.justFired) return COLOR_FIRED;
  if (node.hasOutput) return COLOR_TERMINAL;
  if (node.isInitial) return COLOR_INITIAL;
  return COLOR_DEFAULT;
}

// ---------------------------------------------------------------------------
// BFS rank assignment for a sequence
// Returns Map<vectorId, rank> where rank 0 = leftmost (initial/source nodes)
// ---------------------------------------------------------------------------
function bfsRanks(
  vectorIds: string[],
  edges: { source: string; target: string }[],
  initialIds: Set<string>,
): Map<string, number> {
  const ranks = new Map<string, number>();
  // Build adjacency (exclude self-loops for rank purposes)
  const adj = new Map<string, string[]>();
  for (const id of vectorIds) adj.set(id, []);
  for (const e of edges) {
    if (e.source !== e.target) adj.get(e.source)?.push(e.target);
  }

  // BFS from initial nodes first, then any unvisited nodes
  const starts = vectorIds.filter(id => initialIds.has(id));
  if (starts.length === 0 && vectorIds.length > 0) starts.push(vectorIds[0]);

  const queue: { id: string; rank: number }[] = starts.map(id => ({ id, rank: 0 }));
  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    if (ranks.has(id)) continue;
    ranks.set(id, rank);
    for (const nid of (adj.get(id) ?? [])) {
      if (!ranks.has(nid)) queue.push({ id: nid, rank: rank + 1 });
    }
  }

  // Any nodes unreachable from BFS get the next available rank
  const maxRank = ranks.size > 0 ? Math.max(...ranks.values()) : 0;
  let extra = maxRank + 1;
  for (const id of vectorIds) {
    if (!ranks.has(id)) ranks.set(id, extra++);
  }

  return ranks;
}

// ---------------------------------------------------------------------------
// TobiasRenderer
// ---------------------------------------------------------------------------

export class TobiasRenderer {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private readonly _dpr: number;
  private readonly _onSelectMachine: (id: string | null) => void;

  private _cards: CardNode[] = [];
  private _outerEdges: OuterEdge[] = [];
  private _simulation: d3.Simulation<CardNode, never> | null = null;

  private _viewport: Viewport = { tx: 0, ty: 0, scale: 1 };

  private _selectedId: string | null = null;
  private _hoveredCardId: string | null = null;
  private _hoveredInnerNodeId: string | null = null;

  private _isPanning = false;
  private _isDraggingCard = false;
  private _dragCardNode: CardNode | null = null;
  private _dragPrevX = 0;
  private _dragPrevY = 0;
  private _mouseDownX = 0;
  private _mouseDownY = 0;
  private _hasDragged = false;

  private _rafId = 0;

  constructor(opts: TobiasRendererOptions) {
    this._canvas = opts.canvas;
    const ctx = opts.canvas.getContext('2d');
    if (!ctx) throw new Error('TobiasRenderer: could not get 2D context');
    this._ctx = ctx;
    this._dpr = window.devicePixelRatio || 1;
    this._onSelectMachine = opts.onSelectMachine;
    this._bindEvents();
    this._rafId = requestAnimationFrame(this._loop);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  resize(cssW: number, cssH: number): void {
    this._canvas.width  = Math.round(cssW * this._dpr);
    this._canvas.height = Math.round(cssH * this._dpr);
    if (this._simulation) {
      this._simulation
        .force('center', d3.forceCenter(cssW / 2, cssH / 2))
        .alpha(0.1).restart();
    }
  }

  setData(machines: VisMachine[]): void {
    if (this._simulation) { this._simulation.stop(); this._simulation = null; }

    const existingById = new Map(this._cards.map(c => [c.id, c]));
    const cssW = this._canvas.width  / this._dpr;
    const cssH = this._canvas.height / this._dpr;
    const cx = cssW / 2 || 400, cy = cssH / 2 || 300;

    this._cards = machines.map((machine): CardNode => {
      const existing = existingById.get(machine.id);

      // Only rebuild inner graph when sequence structure changes
      const existingSeqIds = existing?.machine.sequences.map(s => s.sequenceId).join('|') ?? '';
      const newSeqIds      = machine.sequences.map(s => s.sequenceId).join('|');
      const structureChanged = !existing || existingSeqIds !== newSeqIds;

      const innerGraph = structureChanged
        ? this._buildInnerGraph(machine)
        : this._refreshNodeStates(existing!.innerGraph, machine);

      const spread = 280;
      return {
        id: machine.id,
        name: machine.name,
        machine,
        w: CARD_W,
        h: HEADER_H + FOOTER_H + innerGraph.totalHeight + PAD * 2,
        headerH: HEADER_H,
        innerGraph,
        x: existing?.x ?? cx + (Math.random() - 0.5) * spread,
        y: existing?.y ?? cy + (Math.random() - 0.5) * spread,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
      };
    });

    this._outerEdges = this._buildOuterEdges(machines);
    this._startOuterSimulation();
  }

  setSelectedId(id: string | null): void { this._selectedId = id; }

  destroy(): void {
    cancelAnimationFrame(this._rafId);
    this._simulation?.stop();
    this._unbindEvents();
  }

  // ---------------------------------------------------------------------------
  // Inner graph construction
  // ---------------------------------------------------------------------------

  /**
   * Build the inner graph for a machine.
   * Each CES sequence gets its own horizontal band, laid out left-to-right
   * by BFS rank order (rank 0 = initial/source, increasing = further downstream).
   * Sequences are independent — NO cross-sequence edges.
   */
  private _buildInnerGraph(machine: VisMachine): InnerGraphCache {
    const allNodes: InnerNode[]  = [];
    const allEdges: InnerEdge[]  = [];
    const neighbors = new Map<string, Set<string>>();
    const seqBands: SeqBand[]    = [];

    let yOffset = 0;
    const seqCount = machine.sequences.length;

    machine.sequences.forEach((seq, seqIdx) => {
      const bandResult = this._layoutSequenceBand(seq, seqIdx, yOffset, machine.justFired);
      seqBands.push({ yStart: yOffset, yEnd: yOffset + BAND_H, name: seq.name });

      for (const n of bandResult.nodes) {
        allNodes.push(n);
        neighbors.set(n.id, new Set());
      }
      for (const e of bandResult.edges) {
        allEdges.push(e);
        if (e.source.id !== e.target.id) {
          neighbors.get(e.source.id)?.add(e.target.id);
          neighbors.get(e.target.id)?.add(e.source.id);
        }
      }

      yOffset += BAND_H + (seqIdx < seqCount - 1 ? DIVIDER_H : 0);
    });

    const totalHeight = seqCount > 0
      ? seqCount * BAND_H + (seqCount - 1) * DIVIDER_H
      : BAND_H; // fallback for empty machine

    return { nodes: allNodes, edges: allEdges, neighbors, seqBands, totalHeight };
  }

  /**
   * Layout a single sequence as a horizontal band using BFS rank assignment.
   * Rank 0 = leftmost (initial nodes), higher rank = further right in flow.
   * Nodes at the same rank are stacked vertically within the band.
   * Self-loop edges are included when present in edge data; implicit self-loops
   * are added for isInitial nodes that don't have an explicit one.
   */
  private _layoutSequenceBand(
    seq: VisMachineSequence,
    seqIdx: number,
    yBase: number,
    machineFired: boolean,
  ): { nodes: InnerNode[]; edges: InnerEdge[] } {
    const { vectors, edges: seqEdges } = seq;
    if (vectors.length === 0) return { nodes: [], edges: [] };

    // --- BFS rank assignment ---
    const initialIds = new Set(vectors.filter(v => v.isInitial).map(v => v.id));
    const vectorIds  = vectors.map(v => v.id);
    const ranks      = bfsRanks(vectorIds, seqEdges, initialIds);
    const maxRank    = Math.max(0, ...ranks.values());

    // Group vectors by rank, preserving definition order within each rank
    const byRank = new Map<number, string[]>();
    for (const v of vectors) {
      const r = ranks.get(v.id) ?? 0;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(v.id);
    }

    // --- Assign pixel positions ---
    const xStep  = INNER_W / (maxRank + 1);
    const posById = new Map<string, { ix: number; iy: number }>();

    for (const [rank, ids] of byRank) {
      const x     = (rank + 0.5) * xStep;
      const count = ids.length;
      ids.forEach((id, i) => {
        const y = yBase + ((i + 1) / (count + 1)) * BAND_H;
        posById.set(id, {
          ix: Math.max(NODE_R + 2, Math.min(INNER_W - NODE_R - 2, x)),
          iy: Math.max(yBase + NODE_R + 2, Math.min(yBase + BAND_H - NODE_R - 2, y)),
        });
      });
    }

    // --- Build InnerNodes ---
    const innerById   = new Map<string, InnerNode>();
    const nodes: InnerNode[] = vectors.map(v => {
      const pos = posById.get(v.id) ?? { ix: INNER_W / 2, iy: yBase + BAND_H / 2 };
      const node: InnerNode = {
        id:        v.id,
        label:     v.label,
        seqIdx,
        ix:        pos.ix,
        iy:        pos.iy,
        isInitial: v.isInitial,
        hasOutput: v.hasOutput,
        justFired: machineFired && v.hasOutput,
        elements:  v.elements,
      };
      innerById.set(v.id, node);
      return node;
    });

    // --- Build InnerEdges from actual sequence edges ---
    const edges: InnerEdge[] = [];
    // Track which source→target pairs we've already added to avoid duplicates
    const addedEdges = new Set<string>();

    for (const e of seqEdges) {
      const sNode = innerById.get(e.source);
      const tNode = innerById.get(e.target);
      if (!sNode || !tNode) continue;

      const key = `${e.source}→${e.target}`;
      if (addedEdges.has(key)) continue;
      addedEdges.add(key);

      edges.push({
        source: sNode,
        target: tNode,
        // Bend parallel edges so multiple arrows between same pair are visible
        bend: (hashToUnit(key) - 0.5) * 34,
      });
    }

    // --- Implicit self-loop for isInitial nodes without an explicit one ---
    for (const v of vectors) {
      if (v.isInitial) {
        const key = `${v.id}→${v.id}`;
        if (!addedEdges.has(key)) {
          const n = innerById.get(v.id)!;
          edges.push({ source: n, target: n, bend: 0 });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Refresh only the dynamic per-step state (justFired) without re-running layout.
   * Called on every simulation step for performance.
   */
  private _refreshNodeStates(cache: InnerGraphCache, machine: VisMachine): InnerGraphCache {
    const updatedNodes = cache.nodes.map((n): InnerNode => ({
      ...n,
      justFired: machine.justFired && n.hasOutput,
    }));
    return { ...cache, nodes: updatedNodes };
  }

  /**
   * Build inter-machine edges from perceptual space output→input overlaps.
   */
  private _buildOuterEdges(machines: VisMachine[]): OuterEdge[] {
    const edges: OuterEdge[] = [];
    const cardById = new Map(this._cards.map(c => [c.id, c]));

    for (const src of machines) {
      if (!src.outputRegion) continue;
      const srcStart = src.outputRegion.offset;
      const srcEnd   = srcStart + src.outputRegion.length;

      for (const tgt of machines) {
        if (src.id === tgt.id || !tgt.inputRegion) continue;
        const tgtStart = tgt.inputRegion.offset;
        const tgtEnd   = tgtStart + tgt.inputRegion.length;

        const overlapStart = Math.max(srcStart, tgtStart);
        const overlapEnd   = Math.min(srcEnd, tgtEnd);
        if (overlapEnd <= overlapStart) continue;

        const srcCard = cardById.get(src.id);
        const tgtCard = cardById.get(tgt.id);
        if (srcCard && tgtCard) {
          edges.push({ source: srcCard, target: tgtCard, overlapLength: overlapEnd - overlapStart });
        }
      }
    }
    return edges;
  }

  // ---------------------------------------------------------------------------
  // Outer D3 force simulation
  // ---------------------------------------------------------------------------

  private _startOuterSimulation(): void {
    if (this._cards.length === 0) return;
    const cssW = this._canvas.width  / this._dpr || 800;
    const cssH = this._canvas.height / this._dpr || 600;

    const linkData = this._outerEdges.map(e => ({ source: e.source.id, target: e.target.id }));

    this._simulation = d3.forceSimulation<CardNode>(this._cards)
      .force('link', d3.forceLink<CardNode, d3.SimulationLinkDatum<CardNode>>(linkData)
                       .id((d) => d.id).distance(280))
      .force('charge', d3.forceManyBody<CardNode>().strength(-1000))
      .force('center',  d3.forceCenter(cssW / 2, cssH / 2))
      .force('collide', d3.forceCollide<CardNode>((d) => Math.max(d.w, d.h) * 0.56))
      .alphaDecay(0.02);
  }

  // ---------------------------------------------------------------------------
  // rAF loop
  // ---------------------------------------------------------------------------

  private _loop = (_ts: number): void => {
    this._draw();
    this._rafId = requestAnimationFrame(this._loop);
  };

  private _draw(): void {
    const ctx = this._ctx;
    const dpr = this._dpr;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    const { tx, ty, scale } = this._viewport;
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    for (const edge of this._outerEdges) this._drawOuterEdge(edge);

    for (const card of this._cards) {
      if (card.id !== this._selectedId) this._drawCard(card, false);
    }
    for (const card of this._cards) {
      if (card.id === this._selectedId) this._drawCard(card, true);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Card drawing
  // ---------------------------------------------------------------------------

  private _drawOuterEdge(edge: OuterEdge): void {
    const ctx = this._ctx;
    const sx = edge.source.x ?? 0, sy = edge.source.y ?? 0;
    const tx = edge.target.x ?? 0, ty = edge.target.y ?? 0;
    const mx = (sx + tx) / 2, my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx + nx * 35, my + ny * 35, tx, ty);
    ctx.strokeStyle = '#64c8ff';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth   = Math.max(1, Math.min(3, edge.overlapLength / 4));
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawArrowHead(ctx, mx + nx * 35, my + ny * 35, tx, ty, 'rgba(100,200,255,0.65)');
  }

  private _drawCard(node: CardNode, isSelected: boolean): void {
    const ctx = this._ctx;
    const cx = node.x ?? 0, cy = node.y ?? 0;
    const x  = cx - node.w / 2, y = cy - node.h / 2;

    ctx.save();
    ctx.translate(x, y);

    const fired = node.machine.justFired;
    if (isSelected || fired) {
      ctx.shadowBlur  = isSelected ? 20 : 12;
      ctx.shadowColor = isSelected ? '#c864ff' : '#a855f7';
    }

    // Card background
    roundRectPath(ctx, 0, 0, node.w, node.h, 8);
    ctx.fillStyle = '#101318';
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#c864ff' : fired ? '#a855f7' : statusColor(node.machine.status);
    ctx.lineWidth   = (isSelected || fired) ? 2 : 1;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Header strip
    ctx.fillStyle = isSelected ? '#2d1040' : fired ? '#1e0a30' : '#1a1f2e';
    ctx.fillRect(0, 0, node.w, node.headerH);

    // Header/body separator
    ctx.beginPath();
    ctx.moveTo(0, node.headerH);
    ctx.lineTo(node.w, node.headerH);
    ctx.strokeStyle = isSelected ? '#c864ff55' : '#2a3040';
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    // Machine name
    ctx.fillStyle    = isSelected ? '#e2b6ff' : fired ? '#d8aaff' : '#e2e8f0';
    ctx.font         = 'bold 10px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    const nameText = node.name.length > 28 ? node.name.slice(0, 26) + '…' : node.name;
    ctx.fillText(nameText, 8, node.headerH / 2, node.w - 16);

    // Inner graph area
    const innerH = node.innerGraph.totalHeight;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD, node.headerH + PAD, INNER_W, innerH);
    ctx.clip();
    ctx.translate(PAD, node.headerH + PAD);
    this._drawInnerGraph(node.innerGraph, node.id);
    ctx.restore();

    // Perceptual vector footer
    this._drawFooter(node);
    ctx.restore();
  }

  /**
   * Draw the inner graph:
   * - Sequence band dividers with sequence index labels
   * - Edges (self-loops + directed arcs)
   * - Nodes colored by state (initial/terminal/fired/intermediate)
   * - Node label shown near hovered node
   */
  private _drawInnerGraph(cache: InnerGraphCache, cardId: string): void {
    const ctx = this._ctx;

    if (cache.nodes.length === 0) {
      ctx.fillStyle = '#475569';
      ctx.font = '9px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('no sequences', INNER_W / 2, cache.totalHeight / 2);
      return;
    }

    const isCardHovered   = this._hoveredCardId === cardId;
    const activeInnerNode = isCardHovered ? this._hoveredInnerNodeId : null;

    // ── Draw sequence band dividers ────────────────────────────────────────
    for (let i = 0; i < cache.seqBands.length; i++) {
      const band = cache.seqBands[i];

      // Sequence index label (top-left of each band)
      ctx.fillStyle    = '#2a3450';
      ctx.font         = '7px monospace';
      ctx.textBaseline = 'top';
      ctx.textAlign    = 'left';
      ctx.fillText(`${i + 1}`, 1, band.yStart + 1);

      // Divider line above this band (not above band 0)
      if (i > 0) {
        const divY = band.yStart - DIVIDER_H / 2;
        ctx.beginPath();
        ctx.moveTo(0, divY);
        ctx.lineTo(INNER_W, divY);
        ctx.strokeStyle = '#1a2233';
        ctx.lineWidth   = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ── Draw edges ─────────────────────────────────────────────────────────
    for (const edge of cache.edges) {
      const { source: s, target: t, bend } = edge;
      const isHighlight = activeInnerNode
        ? (s.id === activeInnerNode || t.id === activeInnerNode)
        : false;
      const isDimmed = activeInnerNode ? !isHighlight : false;

      const edgeColor = isHighlight ? COLOR_HOVER : '#5a6880';
      ctx.globalAlpha = isDimmed ? 0.18 : 1.0;
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth   = isHighlight ? 1.8 : 1.2;

      if (s.id === t.id) {
        // Self-loop: small arc above/to-the-side of the node
        this._drawSelfLoop(ctx, s);
      } else {
        const mx  = (s.ix + t.ix) / 2, my = (s.iy + t.iy) / 2;
        const dx  = t.ix - s.ix,   dy = t.iy - s.iy;
        const len = Math.hypot(dx, dy) || 1;
        const nx  = -dy / len,    ny = dx / len;
        const cpx = mx + nx * bend, cpy = my + ny * bend;

        ctx.beginPath();
        ctx.moveTo(s.ix, s.iy);
        ctx.quadraticCurveTo(cpx, cpy, t.ix, t.iy);
        ctx.stroke();
        drawArrowHead(ctx, cpx, cpy, t.ix, t.iy, edgeColor);
      }
      ctx.globalAlpha = 1;
    }

    // ── Draw nodes ─────────────────────────────────────────────────────────
    for (const node of cache.nodes) {
      const isHovNode  = node.id === activeInnerNode;
      const isNeighbor = activeInnerNode
        ? (cache.neighbors.get(activeInnerNode)?.has(node.id) ?? false)
        : false;
      const isDimNode  = activeInnerNode ? (!isHovNode && !isNeighbor) : false;

      ctx.globalAlpha = isDimNode ? 0.18 : 1.0;
      const fill = nodeColor(node, isHovNode);

      if (node.justFired) { ctx.shadowBlur = 8; ctx.shadowColor = COLOR_FIRED; }

      ctx.beginPath();
      ctx.arc(node.ix, node.iy, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer ring for terminal nodes (shows even when not fired)
      if (node.hasOutput && !node.justFired) {
        ctx.beginPath();
        ctx.arc(node.ix, node.iy, NODE_R + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = COLOR_TERMINAL;
        ctx.lineWidth   = 1;
        ctx.globalAlpha = isDimNode ? 0.18 : 0.55;
        ctx.stroke();
      }

      // Inner ring for isInitial (A+ visual hint)
      if (node.isInitial && !isHovNode) {
        ctx.beginPath();
        ctx.arc(node.ix, node.iy, NODE_R - 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth   = 0.7;
        ctx.globalAlpha = isDimNode ? 0.18 : 0.45;
        ctx.stroke();
      }

      // Node border
      ctx.globalAlpha = isDimNode ? 0.18 : 1.0;
      ctx.beginPath();
      ctx.arc(node.ix, node.iy, NODE_R, 0, Math.PI * 2);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth   = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label under hovered node
      if (isHovNode && node.label) {
        ctx.fillStyle    = '#e2e8f0';
        ctx.font         = '7px monospace';
        ctx.textBaseline = 'top';
        ctx.textAlign    = 'center';
        ctx.fillText(node.label, node.ix, node.iy + NODE_R + 2, 60);
      }

      // Small label always shown for terminal and initial nodes (when not hovering anything)
      if (!activeInnerNode && (node.isInitial || node.hasOutput)) {
        ctx.fillStyle    = node.isInitial ? '#93c5fd' : node.justFired ? COLOR_FIRED : COLOR_TERMINAL;
        ctx.font         = '6px monospace';
        ctx.textBaseline = 'bottom';
        ctx.textAlign    = 'center';
        ctx.globalAlpha  = 0.7;
        ctx.fillText(node.label.slice(0, 8), node.ix, node.iy - NODE_R - 1, 50);
        ctx.globalAlpha  = 1;
      }
    }
  }

  /** Draw a self-loop arc above a node. */
  private _drawSelfLoop(ctx: CanvasRenderingContext2D, node: InnerNode): void {
    const r  = 8;
    const ox = node.ix, oy = node.iy;
    ctx.beginPath();
    ctx.arc(ox + r, oy - r, r, Math.PI * 0.9, Math.PI * 2.1, false);
    ctx.stroke();
    // Tiny arrowhead at the base of the self-loop
    ctx.beginPath();
    ctx.moveTo(ox, oy - NODE_R);
    ctx.lineTo(ox - 3, oy - NODE_R - 4);
    ctx.lineTo(ox + 3, oy - NODE_R - 4);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle as string;
    ctx.fill();
  }

  /** Footer bar: cyan dots for input vector, purple dots for output vector. */
  private _drawFooter(node: CardNode): void {
    const ctx = this._ctx;
    const m = node.machine;
    const footerY = node.h - FOOTER_H;

    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, footerY, node.w, FOOTER_H);

    ctx.beginPath();
    ctx.moveTo(0, footerY);
    ctx.lineTo(node.w, footerY);
    ctx.strokeStyle = '#1e2535';
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    const midY = footerY + FOOTER_H / 2;
    ctx.font = '7px monospace';
    ctx.textBaseline = 'middle';

    const iv = m.latestInputVector;
    const ov = m.latestOutputVector;

    if (!iv && !ov) {
      ctx.fillStyle = '#283040';
      ctx.textAlign = 'center';
      ctx.fillText('awaiting data', node.w / 2, midY);
      return;
    }

    if (iv && iv.length > 0) {
      const max = Math.min(iv.length, 8), gap = 7, startX = 6;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#374558';
      ctx.fillText('in', startX, midY);
      for (let i = 0; i < max; i++) {
        const v = Math.max(0, Math.min(1, iv[i]));
        ctx.beginPath();
        ctx.arc(startX + 16 + i * gap, midY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,200,255,${0.12 + v * 0.88})`;
        ctx.fill();
      }
    }

    if (ov && ov.length > 0) {
      const max = Math.min(ov.length, 4), gap = 7, endX = node.w - 6;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#374558';
      ctx.fillText('out', endX, midY);
      for (let i = 0; i < max; i++) {
        const v = Math.max(0, Math.min(1, ov[i]));
        ctx.beginPath();
        ctx.arc(endX - 16 - (max - 1 - i) * gap, midY, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,85,247,${0.12 + v * 0.88})`;
        ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Coordinate helpers + hit testing
  // ---------------------------------------------------------------------------

  private _toWorld(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: (cssX - this._viewport.tx) / this._viewport.scale,
      y: (cssY - this._viewport.ty) / this._viewport.scale,
    };
  }

  private _hitTestHeader(wx: number, wy: number): CardNode | null {
    for (const c of this._cards) {
      const lx = (c.x ?? 0) - c.w / 2, ty = (c.y ?? 0) - c.h / 2;
      if (wx >= lx && wx <= lx + c.w && wy >= ty && wy <= ty + c.headerH) return c;
    }
    return null;
  }

  private _hitTestCard(wx: number, wy: number): CardNode | null {
    for (const c of this._cards) {
      const lx = (c.x ?? 0) - c.w / 2, ty = (c.y ?? 0) - c.h / 2;
      if (wx >= lx && wx <= lx + c.w && wy >= ty && wy <= ty + c.h) return c;
    }
    return null;
  }

  private _updateHover(wx: number, wy: number): void {
    const card = this._hitTestCard(wx, wy);
    if (!card) { this._hoveredCardId = null; this._hoveredInnerNodeId = null; return; }
    this._hoveredCardId = card.id;
    const lx = (card.x ?? 0) - card.w / 2, ty = (card.y ?? 0) - card.h / 2;
    const innerX = wx - lx - PAD;
    const innerY = wy - ty - card.headerH - PAD;
    let hitId: string | null = null;
    for (const n of card.innerGraph.nodes) {
      if (Math.hypot(innerX - n.ix, innerY - n.iy) <= NODE_R + HIT_EXTRA) { hitId = n.id; break; }
    }
    this._hoveredInnerNodeId = hitId;
  }

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------

  private _bindEvents(): void {
    this._canvas.addEventListener('wheel',      this._onWheel,     { passive: false });
    this._canvas.addEventListener('mousedown',  this._onMouseDown);
    this._canvas.addEventListener('mousemove',  this._onMouseMove);
    this._canvas.addEventListener('mouseup',    this._onMouseUp);
    this._canvas.addEventListener('mouseleave', this._onMouseLeave);
  }

  private _unbindEvents(): void {
    this._canvas.removeEventListener('wheel',      this._onWheel);
    this._canvas.removeEventListener('mousedown',  this._onMouseDown);
    this._canvas.removeEventListener('mousemove',  this._onMouseMove);
    this._canvas.removeEventListener('mouseup',    this._onMouseUp);
    this._canvas.removeEventListener('mouseleave', this._onMouseLeave);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const factor   = Math.pow(0.95, e.deltaY / 40);
    const newScale = Math.max(0.1, Math.min(5, this._viewport.scale * factor));
    const worldX   = (e.offsetX - this._viewport.tx) / this._viewport.scale;
    const worldY   = (e.offsetY - this._viewport.ty) / this._viewport.scale;
    this._viewport.scale = newScale;
    this._viewport.tx    = e.offsetX - worldX * newScale;
    this._viewport.ty    = e.offsetY - worldY * newScale;
  };

  private _onMouseDown = (e: MouseEvent): void => {
    this._mouseDownX = e.offsetX; this._mouseDownY = e.offsetY;
    this._dragPrevX  = e.offsetX; this._dragPrevY  = e.offsetY;
    this._hasDragged = false;
    const wp = this._toWorld(e.offsetX, e.offsetY);
    const hh = this._hitTestHeader(wp.x, wp.y);
    if (hh) {
      this._isDraggingCard = true; this._dragCardNode = hh;
      hh.fx = hh.x ?? 0; hh.fy = hh.y ?? 0;
      if (this._simulation) this._simulation.alphaTarget(0.3).restart();
      this._canvas.style.cursor = 'grabbing';
    } else {
      this._isPanning = true;
      this._canvas.style.cursor = 'grab';
    }
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (Math.hypot(e.offsetX - this._mouseDownX, e.offsetY - this._mouseDownY) > 3)
      this._hasDragged = true;
    if (this._isDraggingCard && this._dragCardNode) {
      const wp = this._toWorld(e.offsetX, e.offsetY);
      this._dragCardNode.fx = wp.x; this._dragCardNode.fy = wp.y;
    } else if (this._isPanning) {
      this._viewport.tx += e.offsetX - this._dragPrevX;
      this._viewport.ty += e.offsetY - this._dragPrevY;
    } else {
      const wp = this._toWorld(e.offsetX, e.offsetY);
      this._updateHover(wp.x, wp.y);
      const hc = this._hitTestCard(wp.x, wp.y);
      this._canvas.style.cursor = hc
        ? (this._hitTestHeader(wp.x, wp.y) ? 'pointer' : 'default')
        : 'default';
    }
    this._dragPrevX = e.offsetX; this._dragPrevY = e.offsetY;
  };

  private _onMouseUp = (e: MouseEvent): void => {
    if (!this._hasDragged) {
      const wp = this._toWorld(e.offsetX, e.offsetY);
      const hh = this._hitTestHeader(wp.x, wp.y);
      if (hh) {
        const newId = this._selectedId === hh.id ? null : hh.id;
        this._selectedId = newId;
        this._onSelectMachine(newId);
      } else if (!this._hitTestCard(wp.x, wp.y)) {
        this._selectedId = null;
        this._onSelectMachine(null);
      }
    }
    if (this._isDraggingCard && this._dragCardNode) {
      this._dragCardNode.fx = null; this._dragCardNode.fy = null;
      this._dragCardNode = null;
      if (this._simulation) this._simulation.alphaTarget(0);
    }
    this._isDraggingCard = false; this._isPanning = false;
    this._canvas.style.cursor = 'default';
  };

  private _onMouseLeave = (): void => {
    if (this._isDraggingCard && this._dragCardNode) {
      this._dragCardNode.fx = null; this._dragCardNode.fy = null;
      this._dragCardNode = null;
      if (this._simulation) this._simulation.alphaTarget(0);
    }
    this._isDraggingCard = false; this._isPanning = false;
    this._hoveredCardId = null; this._hoveredInnerNodeId = null;
    this._canvas.style.cursor = 'default';
  };
}
