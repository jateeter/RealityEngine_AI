import React, { useEffect, useState } from 'react';
import { perceptionEngineApi } from '../api';
import type {
  MqttBridgeStatus,
  MqttMappingRule,
  MqttMappingsResponse,
} from '../types';

/**
 * MqttBridgePanel — live monitor surface for the MQTT bridge owned by the
 * Perception Engine.  Polls /api/perception/mqtt/{status,mappings} every
 * 2s.  Renders:
 *   • connection state badge
 *   • bridge-level counters
 *   • per-mapping table (topic → region, counters, lastError)
 *
 * Per the design rule, mappings are the authority for how broker telemetry
 * projects into perceptual space — this panel is the operator window onto
 * that projection.
 */

const C_CONNECTED    = '#10b981';
const C_DISCONNECTED = '#ef4444';
const C_DISABLED     = '#475569';
const C_PANEL_BG     = 'rgba(15, 23, 42, 0.95)';
const C_BORDER       = '#1e293b';
const C_TEXT_DIM     = '#94a3b8';
const C_TEXT         = '#e2e8f0';
const C_ERROR_BG     = 'rgba(239, 68, 68, 0.12)';
const C_OK           = '#22c55e';
const C_REJECT       = '#f87171';

function StatusBadge({ status }: { status: MqttBridgeStatus }) {
  let label: string;
  let color: string;
  if (!status.enabled)      { label = 'DISABLED';     color = C_DISABLED; }
  else if (status.connected){ label = 'CONNECTED';    color = C_CONNECTED; }
  else                      { label = 'DISCONNECTED'; color = C_DISCONNECTED; }
  return (
    <span style={{
      display: 'inline-block',
      background: color,
      color: status.enabled ? '#0f172a' : '#e2e8f0',
      padding: '3px 10px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    }}>{label}</span>
  );
}

function fmt(n?: number): string {
  return (n ?? 0).toLocaleString();
}

function MappingRow({ rule }: { rule: MqttMappingRule }) {
  const c = rule.counters ?? { received: 0, mapped: 0, rejected: 0, stale: 0, lastError: '', lastErrorAtMs: 0, lastMessageAtMs: 0 };
  const hasError = c.lastError && c.lastError.length > 0;
  return (
    <tr style={{ borderBottom: '1px solid #1e293b', background: hasError ? C_ERROR_BG : 'transparent' }}>
      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C_TEXT }}>{rule.id}</td>
      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: C_TEXT_DIM }}>{rule.topicFilter}</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: C_TEXT_DIM, whiteSpace: 'nowrap' }}>
        [{rule.region.offset}–{rule.region.offset + rule.region.length - 1}]
      </td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: C_TEXT_DIM }}>{rule.extract.type}{rule.extract.pointer ? ` ${rule.extract.pointer}` : ''}</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: C_TEXT_DIM }}>{rule.normalize.mode}</td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: C_TEXT }}>{fmt(c.received)}</td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: C_OK }}>{fmt(c.mapped)}</td>
      <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: 11, color: c.rejected > 0 ? C_REJECT : C_TEXT_DIM }}>{fmt(c.rejected)}</td>
      <td style={{ padding: '8px 10px', fontSize: 10, color: C_REJECT, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {hasError ? c.lastError : ''}
      </td>
    </tr>
  );
}

export const MqttBridgePanel: React.FC = () => {
  const [status, setStatus] = useState<MqttBridgeStatus | null>(null);
  const [mappings, setMappings] = useState<MqttMappingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [s, m] = await Promise.all([
          perceptionEngineApi.getMqttStatus(),
          perceptionEngineApi.getMqttMappings(),
        ]);
        if (cancelled) return;
        setStatus(s); setMappings(m); setError(null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? String(e));
      }
    }
    refresh();
    const id = setInterval(refresh, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (error) {
    return (
      <div style={{ padding: 16, background: C_PANEL_BG, color: C_REJECT, fontFamily: 'monospace', fontSize: 12 }}>
        MQTT bridge: {error}
      </div>
    );
  }
  if (!status) {
    return <div style={{ padding: 16, background: C_PANEL_BG, color: C_TEXT_DIM }}>Loading MQTT bridge…</div>;
  }

  return (
    <div style={{ background: C_PANEL_BG, border: `1px solid ${C_BORDER}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: C_TEXT, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          MQTT Bridge
        </h3>
        <StatusBadge status={status} />
        {status.enabled && status.brokerUrl && (
          <span style={{ fontSize: 11, color: C_TEXT_DIM, fontFamily: 'monospace' }}>{status.brokerUrl}</span>
        )}
      </div>

      {status.enabled && (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <Stat label="Mappings"  value={fmt(status.mappings ?? mappings?.mappings?.length)} />
            <Stat label="Received"  value={fmt(status.bridge?.messagesReceived)} />
            <Stat label="Mapped"    value={fmt(status.bridge?.messagesMapped)}   color={C_OK} />
            <Stat label="Rejected"  value={fmt(status.bridge?.messagesRejected)} color={status.bridge?.messagesRejected ? C_REJECT : C_TEXT_DIM} />
            <Stat label="Unmatched" value={fmt(status.bridge?.messagesUnmatched)} />
            <Stat label="Pushes"    value={fmt(status.bridge?.pushesTriggered)} />
          </div>

          {mappings && mappings.mappings?.length > 0 && (
            <div style={{ overflowX: 'auto', border: `1px solid ${C_BORDER}`, borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: '#0b1220' }}>
                    <Th>Mapping</Th><Th>Topic Filter</Th><Th>Region</Th>
                    <Th>Extract</Th><Th>Normalize</Th>
                    <Th align="right">Received</Th><Th align="right">Mapped</Th><Th align="right">Rejected</Th>
                    <Th>Last Error</Th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.mappings.map(m => <MappingRow key={m.id} rule={m} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {!status.enabled && (
        <div style={{ color: C_TEXT_DIM, fontSize: 12, lineHeight: 1.5 }}>
          MQTT ingest is disabled.  Set <code style={{ color: C_TEXT, fontFamily: 'monospace' }}>MQTT_BROKER_URL</code> +
          {' '}<code style={{ color: C_TEXT, fontFamily: 'monospace' }}>MQTT_MAPPINGS_FILE</code> on the Perception Engine
          and restart the service to enable the bridge.
        </div>
      )}
    </div>
  );
};

function Stat({ label, value, color = C_TEXT }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 10, color: C_TEXT_DIM, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, color, fontFamily: 'monospace', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{
      padding: '6px 10px', textAlign: align, color: C_TEXT_DIM, fontSize: 10,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
      borderBottom: `1px solid ${C_BORDER}`,
    }}>{children}</th>
  );
}
