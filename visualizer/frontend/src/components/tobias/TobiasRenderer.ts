import * as d3 from 'd3';
import type { VisMachine } from '../../hooks/useMachineSimulation';

// ---------------------------------------------------------------------------
// Card layout constants
// ---------------------------------------------------------------------------
const CARD_W = 240;
const CARD_H = 180;
const HEADER_H = 24;
const PAD = 10;
const INNER_W = CARD_W - PAD * 2;  // 220
const INNER_H = CARD_H - HEADER_H - PAD * 2; // 136
const NODE_R = 4.5;
const ARROW_SIZE = 5;
const HIT_EXTRA = 4; // extra px around node for hover detection

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface InnerNode {
  id: string;
  ix: number;
  iy: number;
}

interface InnerEdge {
  source: InnerNode;
  target: InnerNode;
  bend: number;
}

interface InnerGraphCache {
  nodes: InnerNode[];
  edges: InnerEdge[];
  neighbors: Map<string, Set<string>>;
}

interface CardNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  machine: VisMachine;
  w: number;
  h: number;
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
// Pure helper functions
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
    case 'processing': return '#f59e0b';
    default:           return '#334155';
  }
}

/** Draw a rounded rectangle path (no fill/stroke — caller does that). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number,
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

/**
 * Draw an arrowhead at the end of a quadratic bezier from (sx,sy) via
 * control point (cx,cy) to (tx,ty).
 */
function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  tx: number, ty: number,
  color: string,
): void {
  // Tangent direction at t=1: target - controlPoint
  const adx = tx - cx;
  const ady = ty - cy;
  const alen = Math.hypot(adx, ady) || 1;
  const ax = adx / alen;
  const ay = ady / alen;

  // Arrow tip pulled back by node radius
  const ex = tx - ax * NODE_R;
  const ey = ty - ay * NODE_R;

  const perpX = -ay;
  const perpY =  ax;

  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(
    ex - ax * ARROW_SIZE + perpX * ARROW_SIZE * 0.4,
    ey - ay * ARROW_SIZE + perpY * ARROW_SIZE * 0.4,
  );
  ctx.lineTo(
    ex - ax * ARROW_SIZE - perpX * ARROW_SIZE * 0.4,
    ey - ay * ARROW_SIZE - perpY * ARROW_SIZE * 0.4,
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------------------------------------------------------------------------
// TobiasRenderer
// ---------------------------------------------------------------------------

export class TobiasRenderer {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _ctx: CanvasRenderingContext2D;
  private readonly _dpr: number;
  private readonly _onSelectMachine: (id: string | null) => void;

  // Simulation data
  private _cards: CardNode[] = [];
  private _outerEdges: OuterEdge[] = [];
  private _simulation: d3.Simulation<CardNode, never> | null = null;

  // Viewport
  private _viewport: Viewport = { tx: 0, ty: 0, scale: 1 };

  // Selection / hover state
  private _selectedId: string | null = null;
  private _hoveredCardId: string | null = null;
  private _hoveredInnerNodeId: string | null = null;

  // Interaction state
  private _isPanning = false;
  private _isDraggingCard = false;
  private _dragCardNode: CardNode | null = null;
  private _dragPrevX = 0;
  private _dragPrevY = 0;
  private _mouseDownX = 0;
  private _mouseDownY = 0;
  private _hasDragged = false;

  // rAF loop
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
        .alpha(0.1)
        .restart();
    }
  }

  setData(machines: VisMachine[]): void {
    // Stop any running simulation
    if (this._simulation) {
      this._simulation.stop();
      this._simulation = null;
    }

    // Build card nodes, preserving D3 positions for existing cards
    const existingById = new Map(this._cards.map(c => [c.id, c]));

    const cssW = this._canvas.width  / this._dpr;
    const cssH = this._canvas.height / this._dpr;
    const cx = cssW / 2 || 400;
    const cy = cssH / 2 || 300;

    this._cards = machines.map((machine): CardNode => {
      const existing = existingById.get(machine.id);
      const spread = 220;
      return {
        id: machine.id,
        name: machine.name,
        machine,
        w: CARD_W,
        h: CARD_H,
        headerH: HEADER_H,
        innerGraph: this._layoutInnerGraph(machine),
        // Preserve prior position or scatter randomly
        x: existing?.x ?? cx + (Math.random() - 0.5) * spread,
        y: existing?.y ?? cy + (Math.random() - 0.5) * spread,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx ?? null,
        fy: existing?.fy ?? null,
      };
    });

    // No perceptual-mapping data available; inter-machine edges are not drawn.
    this._outerEdges = [];

    this._startOuterSimulation();
  }

  setSelectedId(id: string | null): void {
    this._selectedId = id;
  }

  destroy(): void {
    cancelAnimationFrame(this._rafId);
    this._simulation?.stop();
    this._unbindEvents();
  }

  // ---------------------------------------------------------------------------
  // Inner graph layout (D3 sim, 320 ticks, returns frozen cache)
  // ---------------------------------------------------------------------------

  private _layoutInnerGraph(machine: VisMachine): InnerGraphCache {
    // Build nodes
    type LayoutNode = d3.SimulationNodeDatum & { id: string };
    const layoutNodes: LayoutNode[] = [];

    machine.sequences.forEach((seq) => {
      const vectors: any[] = seq.vectors || [];
      vectors.forEach((_v, vecIdx) => {
        layoutNodes.push({ id: `${seq.sequenceId}-${vecIdx}` });
      });
    });

    if (layoutNodes.length === 0) {
      return { nodes: [], edges: [], neighbors: new Map() };
    }

    // Build links
    const layoutLinks: { source: string; target: string }[] = [];

    machine.sequences.forEach((seq) => {
      const vectors: any[] = seq.vectors || [];
      for (let i = 0; i < vectors.length - 1; i++) {
        layoutLinks.push({
          source: `${seq.sequenceId}-${i}`,
          target: `${seq.sequenceId}-${i + 1}`,
        });
      }
    });

    // Cross-sequence links (last node of seq N → first of seq N+1)
    machine.sequences.forEach((seq, seqIdx) => {
      if (seqIdx >= machine.sequences.length - 1) return;
      const nextSeq = machine.sequences[seqIdx + 1];
      const seqVecs: any[] = seq.vectors || [];
      const nextVecs: any[] = nextSeq.vectors || [];
      if (seqVecs.length > 0 && nextVecs.length > 0) {
        layoutLinks.push({
          source: `${seq.sequenceId}-${seqVecs.length - 1}`,
          target: `${nextSeq.sequenceId}-0`,
        });
      }
    });

    // Run static force simulation
    const sim = d3.forceSimulation<LayoutNode>(layoutNodes)
      .force('link',   d3.forceLink<LayoutNode, d3.SimulationLinkDatum<LayoutNode>>(layoutLinks)
                         .id((d) => d.id)
                         .distance(28)
                         .strength(0.7))
      .force('charge', d3.forceManyBody<LayoutNode>().strength(-80))
      .force('collide', d3.forceCollide<LayoutNode>(6))
      .force('center', d3.forceCenter(INNER_W / 2, INNER_H / 2))
      .stop();

    for (let i = 0; i < 320; i++) sim.tick();

    // Freeze positions into InnerNodes
    const nodeById = new Map<string, InnerNode>();
    const nodes: InnerNode[] = layoutNodes.map((n): InnerNode => {
      const node: InnerNode = {
        id: n.id,
        ix: Math.max(NODE_R + 1, Math.min(INNER_W - NODE_R - 1, n.x ?? INNER_W / 2)),
        iy: Math.max(NODE_R + 1, Math.min(INNER_H - NODE_R - 1, n.y ?? INNER_H / 2)),
      };
      nodeById.set(node.id, node);
      return node;
    });

    // Build edges from resolved links
    const edges: InnerEdge[] = [];
    const linkForce = sim.force<d3.ForceLink<LayoutNode, d3.SimulationLinkDatum<LayoutNode>>>('link');
    if (linkForce) {
      for (const rawLink of linkForce.links() as any[]) {
        const sId: string = rawLink.source.id;
        const tId: string = rawLink.target.id;
        const sNode = nodeById.get(sId);
        const tNode = nodeById.get(tId);
        if (sNode && tNode) {
          edges.push({
            source: sNode,
            target: tNode,
            bend: (hashToUnit(`${sId}->${tId}`) - 0.5) * 44,
          });
        }
      }
    }

    // Build neighbor map
    const neighbors = new Map<string, Set<string>>();
    for (const n of nodes) neighbors.set(n.id, new Set());
    for (const e of edges) {
      neighbors.get(e.source.id)?.add(e.target.id);
      neighbors.get(e.target.id)?.add(e.source.id);
    }

    return { nodes, edges, neighbors };
  }

  // ---------------------------------------------------------------------------
  // Outer D3 force simulation (NO tick callback — rAF reads positions)
  // ---------------------------------------------------------------------------

  private _startOuterSimulation(): void {
    if (this._cards.length === 0) return;

    const cssW = this._canvas.width  / this._dpr || 800;
    const cssH = this._canvas.height / this._dpr || 600;

    // Build link data from outer edges
    const linkData = this._outerEdges.map(e => ({
      source: e.source.id,
      target: e.target.id,
    }));

    const collideRadius = Math.max(CARD_W, CARD_H) * 0.6;

    this._simulation = d3.forceSimulation<CardNode>(this._cards)
      .force('link', d3.forceLink<CardNode, d3.SimulationLinkDatum<CardNode>>(linkData)
                       .id((d) => d.id)
                       .distance(240))
      .force('charge', d3.forceManyBody<CardNode>().strength(-800))
      .force('center',  d3.forceCenter(cssW / 2, cssH / 2))
      .force('collide', d3.forceCollide<CardNode>(collideRadius))
      // No .on('tick') — the rAF loop reads node.x/node.y directly
      .alphaDecay(0.02);
  }

  // ---------------------------------------------------------------------------
  // rAF render loop
  // ---------------------------------------------------------------------------

  private _loop = (_ts: number): void => {
    this._draw();
    this._rafId = requestAnimationFrame(this._loop);
  };

  private _draw(): void {
    const ctx   = this._ctx;
    const dpr   = this._dpr;
    const cw    = this._canvas.width;
    const ch    = this._canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    ctx.save();

    // Apply DPR scale first (canvas physical vs logical pixels)
    ctx.scale(dpr, dpr);

    // Apply viewport pan + zoom
    const { tx, ty, scale } = this._viewport;
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    // Draw outer edges (behind cards)
    for (const edge of this._outerEdges) {
      this._drawOuterEdge(edge);
    }

    // Draw non-selected cards first so selected card renders on top
    for (const card of this._cards) {
      if (card.id !== this._selectedId) {
        this._drawCard(card, false);
      }
    }
    for (const card of this._cards) {
      if (card.id === this._selectedId) {
        this._drawCard(card, true);
      }
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  private _drawOuterEdge(edge: OuterEdge): void {
    const ctx = this._ctx;
    const sx = edge.source.x ?? 0;
    const sy = edge.source.y ?? 0;
    const tx = edge.target.x ?? 0;
    const ty = edge.target.y ?? 0;

    const strokeW = Math.max(1, edge.overlapLength / 10);

    ctx.beginPath();
    ctx.moveTo(sx, sy);

    // Slight arc using a midpoint offset
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;
    const dx = tx - sx, dy = ty - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bend = 30;

    ctx.quadraticCurveTo(mx + nx * bend, my + ny * bend, tx, ty);
    ctx.strokeStyle = '#64c8ff';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth   = strokeW;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private _drawCard(node: CardNode, isSelected: boolean): void {
    const ctx = this._ctx;
    const cx  = node.x ?? 0;
    const cy  = node.y ?? 0;
    const x   = cx - node.w / 2;
    const y   = cy - node.h / 2;

    ctx.save();
    ctx.translate(x, y);

    // Glow when selected
    if (isSelected) {
      ctx.shadowBlur  = 20;
      ctx.shadowColor = '#c864ff';
    }

    // Card background
    roundRectPath(ctx, 0, 0, node.w, node.h, 8);
    ctx.fillStyle = '#101318';
    ctx.fill();

    // Border
    ctx.strokeStyle = isSelected ? '#c864ff' : statusColor(node.machine.status);
    ctx.lineWidth   = isSelected ? 2 : 1;
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Header strip
    ctx.fillStyle = isSelected ? '#2d1040' : '#1a1f2e';
    ctx.fillRect(0, 0, node.w, node.headerH);

    // Header separator line
    ctx.beginPath();
    ctx.moveTo(0, node.headerH);
    ctx.lineTo(node.w, node.headerH);
    ctx.strokeStyle = isSelected ? '#c864ff55' : '#2a3040';
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    // Machine name text
    ctx.fillStyle    = isSelected ? '#e2b6ff' : '#e2e8f0';
    ctx.font         = 'bold 10px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    // Clip text to header width
    const maxNameW = node.w - 16;
    const nameText = node.name.length > 28
      ? node.name.slice(0, 26) + '…'
      : node.name;
    ctx.fillText(nameText, 8, node.headerH / 2, maxNameW);

    // Inner graph area — clip to avoid overflow
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD, node.headerH + PAD, INNER_W, INNER_H);
    ctx.clip();

    // Translate into inner graph coordinate space
    ctx.translate(PAD, node.headerH + PAD);
    this._drawInnerGraph(node.innerGraph, node.id);

    ctx.restore(); // inner clip
    ctx.restore(); // card translate
  }

  private _drawInnerGraph(cache: InnerGraphCache, cardId: string): void {
    const ctx = this._ctx;

    if (cache.nodes.length === 0) {
      ctx.fillStyle    = '#475569';
      ctx.font         = '10px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign    = 'center';
      ctx.fillText('no sequences', INNER_W / 2, INNER_H / 2);
      return;
    }

    const isCardHovered    = this._hoveredCardId === cardId;
    const activeInnerNode  = isCardHovered ? this._hoveredInnerNodeId : null;

    // Draw edges
    for (const edge of cache.edges) {
      const { source: s, target: t, bend } = edge;
      const isHighlight = activeInnerNode
        ? (s.id === activeInnerNode || t.id === activeInnerNode)
        : false;
      const isDimmed    = activeInnerNode ? !isHighlight : false;

      const edgeColor = isHighlight ? '#ffcc00' : '#7a869a';

      ctx.globalAlpha  = isDimmed ? 0.2 : 1.0;
      ctx.strokeStyle  = edgeColor;
      ctx.lineWidth    = isHighlight ? 1.8 : 1.2;

      if (s.id === t.id) {
        // Self-loop
        const r = 10;
        ctx.beginPath();
        ctx.moveTo(s.ix, s.iy);
        ctx.bezierCurveTo(s.ix + r, s.iy - r, s.ix + 2 * r, s.iy + r, s.ix, s.iy + 2 * r);
        ctx.stroke();
      } else {
        const mx  = (s.ix + t.ix) / 2;
        const my  = (s.iy + t.iy) / 2;
        const dx  = t.ix - s.ix;
        const dy  = t.iy - s.iy;
        const len = Math.hypot(dx, dy) || 1;
        const nx  = -dy / len;
        const ny  =  dx / len;
        const cpx = mx + nx * bend;
        const cpy = my + ny * bend;

        ctx.beginPath();
        ctx.moveTo(s.ix, s.iy);
        ctx.quadraticCurveTo(cpx, cpy, t.ix, t.iy);
        ctx.stroke();

        // Arrow head at the end
        drawArrowHead(ctx, cpx, cpy, t.ix, t.iy, edgeColor);
      }

      ctx.globalAlpha = 1;
    }

    // Draw nodes
    for (const node of cache.nodes) {
      const isHovNode    = node.id === activeInnerNode;
      const isNeighbor   = activeInnerNode
        ? (cache.neighbors.get(activeInnerNode)?.has(node.id) ?? false)
        : false;
      const isDimNode    = activeInnerNode ? (!isHovNode && !isNeighbor) : false;

      ctx.globalAlpha  = isDimNode ? 0.2 : 1.0;
      ctx.beginPath();
      ctx.arc(node.ix, node.iy, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle    = isHovNode ? '#ffcc00' : '#e6e9ef';
      ctx.fill();
      ctx.strokeStyle  = '#2b2f36';
      ctx.lineWidth    = 0.8;
      ctx.stroke();
      ctx.globalAlpha  = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Coordinate helpers
  // ---------------------------------------------------------------------------

  /** Convert CSS-pixel mouse position to world space (inside the viewport transform). */
  private _toWorld(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: (cssX - this._viewport.tx) / this._viewport.scale,
      y: (cssY - this._viewport.ty) / this._viewport.scale,
    };
  }

  // ---------------------------------------------------------------------------
  // Hit testing
  // ---------------------------------------------------------------------------

  /** Returns the card whose header is hit by world point, or null. */
  private _hitTestHeader(wx: number, wy: number): CardNode | null {
    for (const card of this._cards) {
      const lx = (card.x ?? 0) - card.w / 2;
      const ty = (card.y ?? 0) - card.h / 2;
      if (wx >= lx && wx <= lx + card.w && wy >= ty && wy <= ty + card.headerH) {
        return card;
      }
    }
    return null;
  }

  /** Returns the card that is hit by world point (including body), or null. */
  private _hitTestCard(wx: number, wy: number): CardNode | null {
    for (const card of this._cards) {
      const lx = (card.x ?? 0) - card.w / 2;
      const ty = (card.y ?? 0) - card.h / 2;
      if (wx >= lx && wx <= lx + card.w && wy >= ty && wy <= ty + card.h) {
        return card;
      }
    }
    return null;
  }

  /** Update hover state for inner nodes. */
  private _updateHover(wx: number, wy: number): void {
    const card = this._hitTestCard(wx, wy);
    if (!card) {
      this._hoveredCardId       = null;
      this._hoveredInnerNodeId  = null;
      return;
    }

    this._hoveredCardId = card.id;

    // Convert to inner-graph local space
    const cardLX = (card.x ?? 0) - card.w / 2;
    const cardTY = (card.y ?? 0) - card.h / 2;
    const innerX = wx - cardLX - PAD;
    const innerY = wy - cardTY - HEADER_H - PAD;

    let hitId: string | null = null;
    for (const node of card.innerGraph.nodes) {
      if (Math.hypot(innerX - node.ix, innerY - node.iy) <= NODE_R + HIT_EXTRA) {
        hitId = node.id;
        break;
      }
    }
    this._hoveredInnerNodeId = hitId;
  }

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------

  private _bindEvents(): void {
    this._canvas.addEventListener('wheel',     this._onWheel,     { passive: false });
    this._canvas.addEventListener('mousedown', this._onMouseDown);
    this._canvas.addEventListener('mousemove', this._onMouseMove);
    this._canvas.addEventListener('mouseup',   this._onMouseUp);
    this._canvas.addEventListener('mouseleave', this._onMouseLeave);
  }

  private _unbindEvents(): void {
    this._canvas.removeEventListener('wheel',     this._onWheel);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    this._canvas.removeEventListener('mousemove', this._onMouseMove);
    this._canvas.removeEventListener('mouseup',   this._onMouseUp);
    this._canvas.removeEventListener('mouseleave', this._onMouseLeave);
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const { offsetX, offsetY, deltaY } = e;

    // deltaY > 0 = scroll down = zoom out
    const factor    = Math.pow(0.95, deltaY / 40);
    const newScale  = Math.max(0.1, Math.min(5, this._viewport.scale * factor));

    // Zoom centered on cursor position
    const worldX = (offsetX - this._viewport.tx) / this._viewport.scale;
    const worldY = (offsetY - this._viewport.ty) / this._viewport.scale;

    this._viewport.scale = newScale;
    this._viewport.tx    = offsetX - worldX * newScale;
    this._viewport.ty    = offsetY - worldY * newScale;
  };

  private _onMouseDown = (e: MouseEvent): void => {
    this._mouseDownX  = e.offsetX;
    this._mouseDownY  = e.offsetY;
    this._dragPrevX   = e.offsetX;
    this._dragPrevY   = e.offsetY;
    this._hasDragged  = false;

    const worldPos   = this._toWorld(e.offsetX, e.offsetY);
    const hitHeader  = this._hitTestHeader(worldPos.x, worldPos.y);

    if (hitHeader) {
      this._isDraggingCard = true;
      this._dragCardNode   = hitHeader;
      hitHeader.fx = hitHeader.x ?? 0;
      hitHeader.fy = hitHeader.y ?? 0;
      if (this._simulation) {
        this._simulation.alphaTarget(0.3).restart();
      }
      this._canvas.style.cursor = 'grabbing';
    } else {
      this._isPanning = true;
      this._canvas.style.cursor = 'grab';
    }
  };

  private _onMouseMove = (e: MouseEvent): void => {
    const dx = e.offsetX - this._mouseDownX;
    const dy = e.offsetY - this._mouseDownY;
    if (Math.hypot(dx, dy) > 3) this._hasDragged = true;

    if (this._isDraggingCard && this._dragCardNode) {
      const worldPos               = this._toWorld(e.offsetX, e.offsetY);
      this._dragCardNode.fx        = worldPos.x;
      this._dragCardNode.fy        = worldPos.y;
    } else if (this._isPanning) {
      this._viewport.tx += e.offsetX - this._dragPrevX;
      this._viewport.ty += e.offsetY - this._dragPrevY;
    } else {
      // Hover detection
      const worldPos = this._toWorld(e.offsetX, e.offsetY);
      this._updateHover(worldPos.x, worldPos.y);

      const hitCard = this._hitTestCard(worldPos.x, worldPos.y);
      if (hitCard) {
        const worldPosHeader = this._hitTestHeader(worldPos.x, worldPos.y);
        this._canvas.style.cursor = worldPosHeader ? 'pointer' : 'default';
      } else {
        this._canvas.style.cursor = 'default';
      }
    }

    this._dragPrevX = e.offsetX;
    this._dragPrevY = e.offsetY;
  };

  private _onMouseUp = (e: MouseEvent): void => {
    // Click (no significant drag)
    if (!this._hasDragged) {
      const worldPos  = this._toWorld(e.offsetX, e.offsetY);
      const hitHeader = this._hitTestHeader(worldPos.x, worldPos.y);

      if (hitHeader) {
        const newId = this._selectedId === hitHeader.id ? null : hitHeader.id;
        this._selectedId = newId;
        this._onSelectMachine(newId);
      } else if (!this._hitTestCard(worldPos.x, worldPos.y)) {
        // Background click — deselect
        this._selectedId = null;
        this._onSelectMachine(null);
      }
    }

    // Release card drag
    if (this._isDraggingCard && this._dragCardNode) {
      this._dragCardNode.fx = null;
      this._dragCardNode.fy = null;
      this._dragCardNode    = null;
      if (this._simulation) {
        this._simulation.alphaTarget(0);
      }
    }

    this._isDraggingCard = false;
    this._isPanning      = false;
    this._canvas.style.cursor = 'default';
  };

  private _onMouseLeave = (): void => {
    // End any in-progress interaction when cursor leaves canvas
    if (this._isDraggingCard && this._dragCardNode) {
      this._dragCardNode.fx = null;
      this._dragCardNode.fy = null;
      this._dragCardNode    = null;
      if (this._simulation) this._simulation.alphaTarget(0);
    }
    this._isDraggingCard     = false;
    this._isPanning          = false;
    this._hoveredCardId      = null;
    this._hoveredInnerNodeId = null;
    this._canvas.style.cursor = 'default';
  };
}
