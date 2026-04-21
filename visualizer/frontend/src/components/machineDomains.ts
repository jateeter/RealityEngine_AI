/**
 * machineDomains - Classify machines into domains-of-effect.
 *
 * Powers domain-aware layout, coloring, and filtering across visualizer
 * components (interconnection graph, input strip, legend).
 *
 * Classification signals (first match wins):
 *   1. id prefix / name prefix  (e.g. "localai/", "DC", "AI")
 *   2. metadata.domain free-text (substring match against a keyword table)
 *   3. metadata.category         (enum match)
 *   4. metadata.tags             (any match against a keyword table)
 */

export type DomainId = 'healthservices' | 'ai' | 'datacenter' | 'general';

export interface DomainDef {
  id: DomainId;
  label: string;
  short: string;
  // Ring color on node borders + legend swatch
  color: string;
  // Soft fill (hex with alpha suffix) used for cluster hull backgrounds
  fill: string;
  // Where this domain's cluster gravitates (unit coords; 0..1 × width/height)
  anchor: { x: number; y: number };
  description: string;
}

export const DOMAINS: Record<DomainId, DomainDef> = {
  healthservices: {
    id: 'healthservices',
    label: 'Health Services',
    short: 'Health',
    color: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.22)',
    anchor: { x: 0.22, y: 0.28 },
    description: 'Patient care, wellness, elder care, facilities affecting residents',
  },
  ai: {
    id: 'ai',
    label: 'AI Related',
    short: 'AI',
    color: '#a855f7',
    fill: 'rgba(168, 85, 247, 0.24)',
    anchor: { x: 0.78, y: 0.28 },
    description: 'AI model serving, RAG routing, LangGraph bridges, inference infra',
  },
  datacenter: {
    id: 'datacenter',
    label: 'Data Center',
    short: 'DC',
    color: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.22)',
    anchor: { x: 0.22, y: 0.78 },
    description: 'DC monitoring, cooling, power, network, memory, thermal control',
  },
  general: {
    id: 'general',
    label: 'General / Primitives',
    short: 'Gen',
    color: '#94a3b8',
    fill: 'rgba(148, 163, 184, 0.18)',
    anchor: { x: 0.78, y: 0.78 },
    description: 'Digital logic primitives, pattern matching, generic state machines',
  },
};

export const DOMAIN_ORDER: DomainId[] = ['healthservices', 'ai', 'datacenter', 'general'];

// ── Keyword tables (all lowercase; matched against lowercased input) ──────────

const HEALTH_KEYWORDS = [
  'elder-care', 'eldercare', 'patient', 'wellness', 'assisted living',
  'healthcare', 'health services', 'care transition', 'facilitiesmaintenance',
  'facilities-maintenance', 'residential', 'clinical',
];

const AI_KEYWORDS = [
  'localai', 'ai-pipeline', 'ai infrastructure', 'ai model', 'rag',
  'langgraph', 'llm', 'inference', 'corrective-rag', 'agent context',
  'session rag', 'session agent', 'ai capacity', 'ai cooling', 'ai hardware',
  'ai power', 'ai security',
];

const DC_KEYWORDS = [
  'data center', 'data-center', 'datacenter', 'monitoring', 'cooling',
  'thermal', 'network burst', 'network throttle', 'memory pressure',
  'memory alert', 'critical alert', 'dccriticalsynthesizer', 'power efficiency',
];

const GENERAL_KEYWORDS = [
  'digital-logic', 'state-machine', 'pattern-matching', 'flipflop',
  'flip-flop', 'kleene', 'multistep', 'rs flipflop', 'rs2',
];

// ── Shape ────────────────────────────────────────────────────────────────────

export interface ClassifiedMachine {
  domain: DomainId;
  isExternal: boolean; // true for localAIStack-authored bridge machines
  reason: string;      // which signal matched (for debugging / tooltip)
}

interface MinimalMachine {
  id?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

// ── Classification ───────────────────────────────────────────────────────────

const anyKeyword = (haystack: string, keywords: string[]): string | null => {
  const h = haystack.toLowerCase();
  for (const k of keywords) if (h.includes(k)) return k;
  return null;
};

export function classifyMachine(m: MinimalMachine): ClassifiedMachine {
  const id = (m.id ?? '').toLowerCase();
  const name = (m.name ?? '').toLowerCase();
  const meta = m.metadata ?? {};
  const category = (meta.category ?? '').toString().toLowerCase();
  const metaDomain = (meta.domain ?? '').toString().toLowerCase();
  const author = (meta.author ?? '').toString().toLowerCase();
  const tags: string[] = Array.isArray(meta.tags)
    ? meta.tags.map(t => String(t).toLowerCase())
    : [];

  // External bridges — any localAIStack-authored machine or id-prefixed.
  const isExternal =
    id.startsWith('localai/') ||
    name.startsWith('localai/') ||
    author.includes('localaistack');

  // 1) metadata.category enum — explicit override that beats name-prefix heuristics.
  //    Authors use this to reclassify machines whose name prefix is misleading
  //    (e.g. "AI Cooling Regulator" is really a data-center concern).
  if (category === 'elder-care' || category === 'eldercare' || category === 'healthcare')
    return { domain: 'healthservices', isExternal, reason: `category=${category}` };
  if (category === 'ai-pipeline' || category === 'ai-infrastructure' || category === 'ai')
    return { domain: 'ai', isExternal, reason: `category=${category}` };
  if (category === 'monitoring' || category === 'data-center' || category === 'datacenter')
    return { domain: 'datacenter', isExternal, reason: `category=${category}` };
  if (category === 'digital-logic' || category === 'state-machine' || category === 'pattern-matching')
    return { domain: 'general', isExternal, reason: `category=${category}` };

  // 2) Strong id/name prefixes
  if (name.startsWith('dc') || id.startsWith('dc')) {
    return { domain: 'datacenter', isExternal, reason: 'id/name prefix "DC"' };
  }
  if (name.startsWith('ai') || id.startsWith('ai') || id.startsWith('localai/')) {
    return { domain: 'ai', isExternal, reason: 'id/name prefix "AI"/"localai"' };
  }

  // 3) metadata.domain free-text match
  if (metaDomain) {
    if (anyKeyword(metaDomain, HEALTH_KEYWORDS))
      return { domain: 'healthservices', isExternal, reason: `metadata.domain ~ health` };
    if (anyKeyword(metaDomain, AI_KEYWORDS))
      return { domain: 'ai', isExternal, reason: `metadata.domain ~ ai` };
    if (anyKeyword(metaDomain, DC_KEYWORDS))
      return { domain: 'datacenter', isExternal, reason: `metadata.domain ~ datacenter` };
  }

  // 4) tags
  for (const t of tags) {
    if (anyKeyword(t, HEALTH_KEYWORDS))
      return { domain: 'healthservices', isExternal, reason: `tag=${t}` };
    if (anyKeyword(t, AI_KEYWORDS))
      return { domain: 'ai', isExternal, reason: `tag=${t}` };
    if (anyKeyword(t, DC_KEYWORDS))
      return { domain: 'datacenter', isExternal, reason: `tag=${t}` };
    if (anyKeyword(t, GENERAL_KEYWORDS))
      return { domain: 'general', isExternal, reason: `tag=${t}` };
  }

  // 5) description fallback
  const desc = (m.description ?? '').toLowerCase();
  if (anyKeyword(desc, HEALTH_KEYWORDS))
    return { domain: 'healthservices', isExternal, reason: 'description ~ health' };
  if (anyKeyword(desc, AI_KEYWORDS))
    return { domain: 'ai', isExternal, reason: 'description ~ ai' };
  if (anyKeyword(desc, DC_KEYWORDS))
    return { domain: 'datacenter', isExternal, reason: 'description ~ datacenter' };

  return { domain: 'general', isExternal, reason: 'unclassified fallback' };
}

export function domainColor(domain: DomainId): string {
  return DOMAINS[domain].color;
}

export function domainFill(domain: DomainId): string {
  return DOMAINS[domain].fill;
}

export function domainLabel(domain: DomainId): string {
  return DOMAINS[domain].label;
}
