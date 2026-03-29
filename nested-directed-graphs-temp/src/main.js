import * as d3 from "d3";
import "./style.css";

/** ---------- utilities ---------- */
function hashToUnit(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function assignEdgeBends(links, maxBend = 22) {
  for (const l of links) {
    const key = `${l.source.id}->${l.target.id}`;
    const u = hashToUnit(key);
    l._bend = (u - 0.5) * 2 * maxBend;
  }
}

function quadCurvePath(x1, y1, x2, y2, bend) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;

  const cx = mx + nx * bend;
  const cy = my + ny * bend;

  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

function selfLoopPath(x, y, r = 10) {
  return `M${x},${y} C${x+r},${y-r} ${x+2*r},${y+r} ${x},${y+2*r}`;
}

function buildNeighborIndex(inner) {
  const neighbors = new Map(inner.nodes.map(n => [n.id, new Set()]));
  for (const l of inner.links) {
    neighbors.get(l.source.id).add(l.target.id);
    neighbors.get(l.target.id).add(l.source.id);
  }
  return neighbors;
}

/**
 * Compute a STATIC force layout for an inner graph and return {nodes, links}
 * where links are object references to nodes.
 */
function layoutInnerGraph(inner, innerW, innerH) {
  const nodes = inner.nodes.map(n => ({ ...n }));
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const links = inner.links.map(l => ({
    source: nodeById.get(l.source),
    target: nodeById.get(l.target)
  }));

  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(28).strength(0.7))
    .force("charge", d3.forceManyBody().strength(-80))
    .force("collide", d3.forceCollide(6))
    .force("center", d3.forceCenter(innerW / 2, innerH / 2))
    .stop();

  for (let i = 0; i < 320; i++) sim.tick();

  // clamp into local box
  for (const n of nodes) {
    n.ix = Math.max(6, Math.min(innerW - 6, n.x));
    n.iy = Math.max(6, Math.min(innerH - 6, n.y));
  }

  return { nodes, links };
}

/** Markers must be defined in each inner <svg> */
function ensureInnerArrows(innerSvgSel) {
  const defs = innerSvgSel.select("defs").empty()
    ? innerSvgSel.append("defs")
    : innerSvgSel.select("defs");

  if (defs.select("#arrowSmall").empty()) {
    defs.append("marker")
      .attr("id", "arrowSmall")
      .attr("viewBox", "0 -3 6 6")
      .attr("refX", 6.2).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .attr("markerUnits", "userSpaceOnUse")
      .append("path")
      .attr("d", "M0,-3L6,0L0,3Z")
      .attr("fill", "currentColor");
  }

  if (defs.select("#arrowSmallHi").empty()) {
    defs.append("marker")
      .attr("id", "arrowSmallHi")
      .attr("viewBox", "0 -3 6 6")
      .attr("refX", 6.2).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto")
      .attr("markerUnits", "userSpaceOnUse")
      .append("path")
      .attr("d", "M0,-3L6,0L0,3Z")
      .attr("fill", "#ffcc00");
  }
}

function setupInnerSvg(innerSvgSel, outerId, w, h, pad = 10, headerH = 22) {
  const innerW = w - pad * 2;
  const innerH = h - pad * 2 - headerH;

  const defs = innerSvgSel.select("defs").empty()
    ? innerSvgSel.append("defs")
    : innerSvgSel.select("defs");

  const clipId = `clip-${outerId}`;

  const cp = defs.selectAll(`clipPath#${CSS.escape(clipId)}`)
    .data([null])
    .join("clipPath")
    .attr("id", clipId);

  cp.selectAll("rect")
    .data([null])
    .join("rect")
    .attr("x", pad)
    .attr("y", pad + headerH)
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("rx", 10).attr("ry", 10);

  const g = innerSvgSel.selectAll("g.inner-layer")
    .data([null])
    .join("g")
    .attr("class", "inner-layer")
    .attr("clip-path", `url(#${clipId})`)
    .attr("transform", `translate(${pad},${pad + headerH})`);

  g.attr("__w", innerW).attr("__h", innerH);

  return { g, innerW, innerH };
}

function renderInnerGraph(g, innerLaidOut, opts = {}) {
  const { maxBend = 22, highlightColor = "#ffcc00", clearOnBackgroundClick = true } = opts;

  assignEdgeBends(innerLaidOut.links, maxBend);
  const neighbors = buildNeighborIndex(innerLaidOut);

  let selectedId = null;
  let hoveredId = null;

  const innerW = +g.attr("__w") || 1;
  const innerH = +g.attr("__h") || 1;

  const bg = g.selectAll("rect.inner-bg")
    .data([null])
    .join("rect")
    .attr("class", "inner-bg")
    .attr("x", 0).attr("y", 0)
    .attr("width", innerW)
    .attr("height", innerH)
    .style("fill", "transparent")
    .style("pointer-events", "all");

  const edgeKey = l => `${l.source.id}->${l.target.id}`;

  const linkSel = g.selectAll("path.inner-link")
    .data(innerLaidOut.links, edgeKey)
    .join("path")
    .attr("class", "inner-link")
    .attr("d", l => {
      const s = l.source, t = l.target;
      return (s.id === t.id)
        ? selfLoopPath(s.ix, s.iy)
        : quadCurvePath(s.ix, s.iy, t.ix, t.iy, l._bend);
    });

  const nodeSel = g.selectAll("circle.inner-node")
    .data(innerLaidOut.nodes, d => d.id)
    .join("circle")
    .attr("class", "inner-node")
    .attr("r", 4.5)
    .attr("cx", d => d.ix)
    .attr("cy", d => d.iy)
    .style("pointer-events", "all");

  function activeId() {
    return hoveredId ?? selectedId;
  }

  function applyStyles() {
    const a = activeId();

    nodeSel
      .classed("is-selected", d => selectedId === d.id)
      .classed("is-hovered", d => hoveredId === d.id)
      .classed("is-neighbor", d => a && neighbors.get(a)?.has(d.id))
      .classed("is-dim", d => a && d.id !== a && !neighbors.get(a)?.has(d.id));

    linkSel
      .classed("is-highlight", l => a && (l.source.id === a || l.target.id === a))
      .classed("is-dim", l => a && !(l.source.id === a || l.target.id === a))
      .attr("marker-end", l => {
        if (!a) return "url(#arrowSmall)";
        return (l.source.id === a || l.target.id === a)
          ? "url(#arrowSmallHi)"
          : "url(#arrowSmall)";
      })
      .style("color", l => (a && (l.source.id === a || l.target.id === a)) ? highlightColor : null);
  }

  nodeSel
    .on("mouseenter", (event, d) => {
      hoveredId = d.id;
      applyStyles();
    })
    .on("mouseleave", () => {
      hoveredId = null;
      applyStyles();
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      selectedId = (selectedId === d.id) ? null : d.id;
      applyStyles();
    });

  if (clearOnBackgroundClick) {
    bg.on("click", () => {
      selectedId = null;
      hoveredId = null;
      applyStyles();
    });
  }

  applyStyles();
}

/** ---------- demo data generation ---------- */
function makeRandomDirectedLinks(nodeIds, count, allowSelf = false) {
  const links = [];
  const n = nodeIds.length;
  for (let i = 0; i < count; i++) {
    const a = nodeIds[(Math.random() * n) | 0];
    let b = nodeIds[(Math.random() * n) | 0];
    if (!allowSelf) {
      let guard = 0;
      while (b === a && guard++ < 10) b = nodeIds[(Math.random() * n) | 0];
    }
    links.push({ source: a, target: b });
  }
  return links;
}

function makeInnerGraph(outerId, nodeCount = 20) {
  const nodes = d3.range(nodeCount).map(i => ({ id: `${outerId}.n${i}` }));

  // Ring + random chords
  const links = [];
  for (let i = 0; i < nodeCount; i++) {
    links.push({ source: nodes[i].id, target: nodes[(i + 1) % nodeCount].id });
  }
  links.push(...makeRandomDirectedLinks(nodes.map(n => n.id), Math.floor(nodeCount * 1.3), false));

  return { nodes, links };
}

function makeOuterGraph(outerCount = 20) {
  const nodes = d3.range(outerCount).map(i => ({
    id: `O${i}`,
    label: `Outer ${i}`,
    w: 220,
    h: 160,
    inner: makeInnerGraph(`O${i}`, 20)
  }));

  const links = makeRandomDirectedLinks(nodes.map(n => n.id), 26, false);
  return { nodes, links };
}

/** ---------- main ---------- */
const svg = d3.select("#viz");
const { width, height } = svg.node().getBoundingClientRect();
svg.attr("viewBox", `0 0 ${width} ${height}`);

const graph = makeOuterGraph(20);
const outerLayer = svg.append("g").attr("class", "outer-layer");

const outerNode = outerLayer.selectAll("g.outer-node")
  .data(graph.nodes, d => d.id)
  .join("g")
  .attr("class", "outer-node");

const fo = outerNode.append("foreignObject")
  .attr("x", d => -d.w / 2)
  .attr("y", d => -d.h / 2)
  .attr("width", d => d.w)
  .attr("height", d => d.h);

const card = fo.append("xhtml:div")
  .attr("class", "card")
  .style("width", d => `${d.w}px`)
  .style("height", d => `${d.h}px`);

card.append("xhtml:div")
  .attr("class", "drag-handle")
  .text(d => d.label ?? d.id);

const innerSvg = card.append("xhtml:svg")
  .attr("class", "inner-svg")
  .attr("width", d => d.w)
  .attr("height", d => d.h);

innerSvg.each(function(dOuter) {
  const s = d3.select(this);
  ensureInnerArrows(s);

  const { g, innerW, innerH } = setupInnerSvg(s, dOuter.id, dOuter.w, dOuter.h, 10, 22);
  dOuter.innerLaidOut = layoutInnerGraph(dOuter.inner, innerW, innerH);

  renderInnerGraph(g, dOuter.innerLaidOut, {
    maxBend: 22,
    highlightColor: "#ffcc00",
    clearOnBackgroundClick: true
  });
});

const sim = d3.forceSimulation(graph.nodes)
  .force("charge", d3.forceManyBody().strength(-380))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collide", d3.forceCollide().radius(d => Math.max(d.w, d.h) * 0.55).iterations(2))
  .on("tick", () => {
    outerNode.attr("transform", d => `translate(${d.x},${d.y})`);
  });

// Drag outer nodes by the header only
outerNode.selectAll(".drag-handle")
  .style("pointer-events", "all")
  .each(function(d) {
    d3.select(this).call(
      d3.drag()
        .on("start", () => {
          sim.alphaTarget(0.2).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", () => {
          sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );
  });

window.addEventListener("resize", () => {
  const { width: w, height: h } = svg.node().getBoundingClientRect();
  svg.attr("viewBox", `0 0 ${w} ${h}`);
  sim.force("center", d3.forceCenter(w / 2, h / 2));
  sim.alpha(0.6).restart();
});
