import React from 'react';
import { useVisualizerStore } from '../store';

/**
 * MqttIngestStream — rolling live feed of recent MQTT ingests pushed via
 * WebSocket from the Perception Engine.  Bypasses the 2s polling cadence
 * of the other monitor panels: every accepted PUBLISH appears here within
 * the WebSocket round-trip.
 *
 * Reads `recentMqttIngests` from the visualizer store, populated by the
 * `mqtt-ingest` event handler on the VB → frontend WS.  Capped to ~120
 * entries (the store ring buffer).  Rows fade older toward the bottom so
 * the operator's eye is naturally drawn to the most recent activity.
 */

const C_PANEL_BG = 'rgba(15, 23, 42, 0.95)';
const C_BORDER   = '#1e293b';
const C_TEXT     = '#e2e8f0';
const C_DIM      = '#94a3b8';
const C_FRESH    = '#22c55e';

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
         '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function fmtValues(v: number[]): string {
  if (v.length === 0) return '—';
  return '[' + v.slice(0, 4).map(x => x.toFixed(3)).join(', ') + (v.length > 4 ? '…' : '') + ']';
}

export const MqttIngestStream: React.FC<{ limit?: number }> = ({ limit = 30 }) => {
  const recentMqttIngests = useVisualizerStore(s => s.recentMqttIngests);
  const rows = recentMqttIngests.slice(0, limit);

  return (
    <div style={{ background: C_PANEL_BG, border: `1px solid ${C_BORDER}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: C_TEXT, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Live MQTT Ingest
        </h3>
        <span style={{ fontSize: 10, color: C_DIM, fontFamily: 'monospace' }}>
          last {rows.length} of {recentMqttIngests.length} · WebSocket
        </span>
      </div>
      {rows.length === 0 && (
        <div style={{ color: C_DIM, fontSize: 12 }}>
          Waiting for MQTT ingest events…  Run the bridge against a live broker to populate this stream.
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: `1px solid ${C_BORDER}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {rows.map((r, i) => {
                // Fade older rows; first row is fully bright, last in window dimmed to ~55%.
                const fade = 1 - (i / Math.max(rows.length - 1, 1)) * 0.45;
                return (
                  <tr key={`${r.timestamp}-${r.sensorId}-${i}`}
                      style={{ borderBottom: `1px solid ${C_BORDER}`, opacity: fade }}>
                    <td style={{ padding: '5px 8px', color: C_DIM, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {fmtTime(r.timestamp)}
                    </td>
                    <td style={{ padding: '5px 8px', color: C_FRESH, fontFamily: 'monospace' }}>
                      {r.sensorId}
                    </td>
                    <td style={{ padding: '5px 8px', color: C_DIM, fontFamily: 'monospace', fontSize: 10 }}>
                      {r.topic}
                    </td>
                    <td style={{ padding: '5px 8px', color: C_DIM, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      [{r.offset}–{r.offset + r.length - 1}]
                    </td>
                    <td style={{ padding: '5px 8px', color: C_TEXT, fontFamily: 'monospace' }}>
                      {fmtValues(r.values)}
                    </td>
                    <td style={{ padding: '5px 8px', color: C_DIM, fontFamily: 'monospace', fontSize: 10 }}>
                      via {r.mappingId}
                    </td>
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
