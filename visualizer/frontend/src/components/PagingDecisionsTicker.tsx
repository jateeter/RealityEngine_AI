import React, { useEffect, useState } from 'react';
import { api } from '../api';
import type { PagingDecision } from '../types';

/**
 * PagingDecisionsTicker — live view of who's been paged by the Reality
 * Engine, derived from the Prometheus ces_paging_decisions_total counter
 * via the visualizer backend's /api/viz/paging-decisions endpoint.
 *
 * Why this matters: every fired CES output that matches a triggerConfig
 * rule resolves into a paging decision (ownerTeam + ragStatusCode +
 * processStatus + machineId).  This ticker is the operator window onto
 * the governance contract — the audit trail certified by the CES JSON.
 *
 * Aggregated counter shape — same row may grow over time; we show the top
 * N by count.  Auto-refreshes every 5s.
 */

const C_PANEL_BG    = 'rgba(15, 23, 42, 0.95)';
const C_BORDER      = '#1e293b';
const C_TEXT        = '#e2e8f0';
const C_TEXT_DIM    = '#94a3b8';
const C_GREEN       = '#22c55e';
const C_AMBER       = '#f59e0b';
const C_RED         = '#ef4444';

function ragColor(code: string): string {
  const c = (code ?? '').toLowerCase();
  if (c === 'red')   return C_RED;
  if (c === 'amber') return C_AMBER;
  if (c === 'green') return C_GREEN;
  return C_TEXT_DIM;
}

function shortMachineId(id: string): string {
  // machine ids look like "machine-agx005-aquaculture-dissolved-oxygen-control"
  // — strip the "machine-" prefix and let the operator see the readable tail.
  return id.startsWith('machine-') ? id.slice(8) : id;
}

interface Props {
  /** Max rows to display.  Default 12. */
  limit?: number;
}

export const PagingDecisionsTicker: React.FC<Props> = ({ limit = 12 }) => {
  const [decisions, setDecisions] = useState<PagingDecision[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const resp = await api.getPagingDecisions();
        if (cancelled) return;
        setDecisions(resp.decisions ?? []);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      }
    }
    refresh();
    const id = setInterval(refresh, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div style={{ background: C_PANEL_BG, border: `1px solid ${C_BORDER}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: C_TEXT, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Paging Decisions
        </h3>
        <span style={{ fontSize: 10, color: C_TEXT_DIM, fontFamily: 'monospace' }}>
          ces_paging_decisions_total · top {Math.min(limit, decisions.length)} of {decisions.length}
        </span>
      </div>
      {error && (
        <div style={{ color: C_RED, fontSize: 12, fontFamily: 'monospace' }}>error: {error}</div>
      )}
      {!error && decisions.length === 0 && (
        <div style={{ color: C_TEXT_DIM, fontSize: 12 }}>No paging decisions recorded yet.  Once a CES with a triggerConfig fires, its decision will appear here.</div>
      )}
      {decisions.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#0b1220' }}>
              <Th>RAG</Th><Th>Process</Th><Th>Owner Team</Th><Th>Machine</Th>
              <Th>Runtime</Th><Th align="right">Count</Th>
            </tr>
          </thead>
          <tbody>
            {decisions.slice(0, limit).map((d, i) => (
              <tr key={`${d.ownerTeam}-${d.machineId}-${d.ragStatusCode}-${i}`}
                  style={{ borderBottom: `1px solid ${C_BORDER}` }}>
                <td style={{ padding: '6px 10px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 3,
                    background: ragColor(d.ragStatusCode), color: '#0f172a',
                    fontWeight: 700, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>{d.ragStatusCode || '—'}</span>
                </td>
                <td style={{ padding: '6px 10px', color: C_TEXT_DIM, fontFamily: 'monospace' }}>{d.processStatus || '—'}</td>
                <td style={{ padding: '6px 10px', color: C_TEXT }}>{d.ownerTeam}</td>
                <td style={{ padding: '6px 10px', color: C_TEXT_DIM, fontFamily: 'monospace' }}>{shortMachineId(d.machineId)}</td>
                <td style={{ padding: '6px 10px', color: C_TEXT_DIM, fontFamily: 'monospace', fontSize: 10 }}>{d.runtime}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: C_TEXT, fontFamily: 'monospace' }}>{d.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '6px 10px', textAlign: align, color: C_TEXT_DIM, fontSize: 10,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
      borderBottom: `1px solid ${C_BORDER}`,
    }}>{children}</th>
  );
}
