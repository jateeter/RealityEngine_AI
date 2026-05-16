import React, { useEffect, useState } from 'react';
import { perceptionEngineApi } from '../api';
import type { PESensorSource } from '../types';

/**
 * SensorSourcesPanel — live view of every sensor source the Perception
 * Engine knows about (including MQTT-driven ones auto-created by the
 * bridge).  Renders a freshness badge per source:
 *   • green: age < 50% of TTL
 *   • amber: age < TTL (still fresh per /api/sources contract)
 *   • red:   age > TTL — stale, contributes zeros to the assembled vector
 *
 * Polls /api/perception/sources every 2s.  Identical contract across all
 * three runtimes (AI / CPP / LSP) — every PE exposes ageMs + stale on
 * sensor sources.
 */

const C_PANEL_BG  = 'rgba(15, 23, 42, 0.95)';
const C_BORDER    = '#1e293b';
const C_TEXT      = '#e2e8f0';
const C_TEXT_DIM  = '#94a3b8';
const C_GREEN     = '#22c55e';
const C_AMBER     = '#f59e0b';
const C_RED       = '#ef4444';

function freshnessBadge(s: PESensorSource): { color: string; label: string } {
  if (s.stale) return { color: C_RED,   label: 'STALE' };
  if (s.ageMs !== undefined && s.ttlMs > 0 && s.ageMs > s.ttlMs / 2) {
    return { color: C_AMBER, label: 'AGING' };
  }
  if (s.lastUpdated === null || s.lastUpdated === 0) {
    return { color: C_TEXT_DIM, label: 'IDLE' };
  }
  return { color: C_GREEN, label: 'FRESH' };
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return '—';
  if (ms < 1000)   return `${ms}ms`;
  if (ms < 60000)  return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function fmtValue(v: number[] | undefined): string {
  if (!v || v.length === 0) return '—';
  return '[' + v.slice(0, 4).map(x => x.toFixed(3)).join(', ') + (v.length > 4 ? '…' : '') + ']';
}

export const SensorSourcesPanel: React.FC = () => {
  const [sources, setSources] = useState<PESensorSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const all = await perceptionEngineApi.getSources();
        if (cancelled) return;
        const sensors = (all as any[]).filter((s): s is PESensorSource => s?.type === 'sensor');
        setSources(sensors);
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      }
    }
    refresh();
    const id = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  return (
    <div style={{ background: C_PANEL_BG, border: `1px solid ${C_BORDER}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: C_TEXT, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Sensor Sources
        </h3>
        <span style={{ fontSize: 10, color: C_TEXT_DIM, fontFamily: 'monospace' }}>
          {sources.length} sensor{sources.length === 1 ? '' : 's'} · freshness derived from ttlMs
        </span>
      </div>
      {error && (
        <div style={{ color: C_RED, fontSize: 12, fontFamily: 'monospace' }}>error: {error}</div>
      )}
      {!error && sources.length === 0 && (
        <div style={{ color: C_TEXT_DIM, fontSize: 12 }}>No sensor sources yet.  When MQTT-driven sensors arrive (or you POST /api/signals manually), they'll appear here with live freshness badges.</div>
      )}
      {sources.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#0b1220' }}>
                <Th>Freshness</Th><Th>Sensor ID</Th><Th>Name</Th>
                <Th>Region</Th><Th align="right">Age</Th><Th align="right">TTL</Th>
                <Th>Last Value</Th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => {
                const f = freshnessBadge(s);
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C_BORDER}` }}>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 3,
                        background: f.color, color: '#0f172a',
                        fontWeight: 700, fontSize: 10, letterSpacing: 0.5,
                      }}>{f.label}</span>
                    </td>
                    <td style={{ padding: '6px 10px', color: C_TEXT, fontFamily: 'monospace' }}>{s.sensorId}</td>
                    <td style={{ padding: '6px 10px', color: C_TEXT_DIM }}>{s.name}</td>
                    <td style={{ padding: '6px 10px', color: C_TEXT_DIM, fontFamily: 'monospace' }}>
                      [{s.region.offset}–{s.region.offset + s.region.length - 1}]
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: C_TEXT_DIM, fontFamily: 'monospace' }}>{fmtMs(s.ageMs)}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: C_TEXT_DIM, fontFamily: 'monospace' }}>{fmtMs(s.ttlMs)}</td>
                    <td style={{ padding: '6px 10px', color: C_TEXT, fontFamily: 'monospace', fontSize: 10 }}>{fmtValue(s.lastValue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
