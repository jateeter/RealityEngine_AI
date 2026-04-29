/**
 * Shared color / contrast tokens for visualizations.
 *
 * All graph views (Tobias canvas, MachineInterconnectionGraph,
 * MachineGraphView, CriticalEventGraphView) pull from this single palette
 * so brightness/contrast adjustments happen in one place.
 *
 * The palette assumes a dark page background (#0a0a0a). Values favor the
 * higher-contrast slate-100/200/300 range over Tailwind's dim slate-500/600
 * defaults that were originally scattered across component files.
 *
 * A matching set of CSS custom properties is exposed in styles/viz.css so
 * component CSS files (.viz-legend, panels, etc.) can pick up the same
 * tokens without duplicating hex values.
 */

export const vizTheme = {
  bg: {
    page:           '#0a0a0a',
    panel:          '#0f172a',
    cardIdle:       '#1e293b',   // default card body
    cardConnected:  '#475569',
    cardActive:     '#1e40af',
    cardVectorBg:   '#101318',   // vector-node inner fill (Tobias)
  },

  text: {
    primary:        '#f1f5f9',   // slate-100 (was #e2e8f0)
    secondary:      '#cbd5e1',   // slate-300 (was #94a3b8)
    muted:          '#94a3b8',   // slate-400 (was #64748b)
    emphasis:       '#ffffff',
  },

  accent: {
    input:          '#7dd3fc',   // sky-300 (was #60a5fa)
    output:         '#f9a8d4',   // pink-300
    outputBright:   '#fbcfe8',   // pink-200
    current:        '#93c5fd',   // blue-300
    external:       '#c084fc',   // violet-400 (was #a855f7)
    externalFill:   '#a855f7',
  },

  edge: {
    idle:           '#e2e8f0',   // slate-200 — off-white for dotted connectors
    active:         '#60a5fa',   // blue-400
    bridge:         '#c084fc',   // violet-400 for cross-domain bridge edges
    label:          '#cbd5e1',   // slate-300
    arrowhead:      '#e2e8f0',   // slate-200 — matches idle edge color
  },

  status: {
    activeFill:       '#166534',
    activeStroke:     '#22c55e',
    processingFill:   '#854d0e',
    processingStroke: '#eab308',
    dotActive:        '#4ade80',
    dotProcessing:    '#facc15',
    dotIdle:          '#94a3b8',
  },

  outline: {
    idle:           '#475569',   // slate-600 for quiet borders
    focus:          '#60a5fa',
    hover:          '#facc15',   // yellow-400
  },
} as const;

export type VizTheme = typeof vizTheme;
