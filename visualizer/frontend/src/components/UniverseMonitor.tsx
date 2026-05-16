import React, { useState } from 'react';
import { perceptionEngineApi } from '../api';
import { MqttBridgePanel } from './MqttBridgePanel';
import { MqttIngestStream } from './MqttIngestStream';
import { SensorSourcesPanel } from './SensorSourcesPanel';
import { PagingDecisionsTicker } from './PagingDecisionsTicker';

/**
 * UniverseMonitor — composite monitor/control surface for the full
 * PE → RE → CES pipeline.  Stacks three live panels:
 *
 *   • MqttBridgePanel        — broker connection + mapping rules + counters
 *   • SensorSourcesPanel     — live sensor sources with freshness badges
 *   • PagingDecisionsTicker  — governance contracts resolved by CES fires
 *
 * Plus a control row with a single button — Trigger Push — that drives
 * the PE → RE step manually.  Auto-push (via /api/auto/start) is the
 * normal mode; the manual trigger is for ad-hoc verification.
 *
 * The three monitors together let an operator see:
 *   broker telemetry → projection → live state → governance routing
 * in one view — the certified universe contract from inbound bit to
 * outbound on-call page.
 */

const C_BG     = '#0a0a0a';
const C_TEXT   = '#e2e8f0';
const C_DIM    = '#94a3b8';
const C_ACCENT = '#3b82f6';
const C_ACCENT_HOVER = '#60a5fa';
const C_OK     = '#22c55e';
const C_ERROR  = '#ef4444';

export const UniverseMonitor: React.FC = () => {
  const [pushing, setPushing]   = useState(false);
  const [lastPush, setLastPush] = useState<{ when: number; success: boolean; error?: string } | null>(null);

  const triggerPush = async () => {
    if (pushing) return;
    setPushing(true);
    try {
      const r = await perceptionEngineApi.push();
      setLastPush({ when: Date.now(), success: !!r.success, error: r.error });
    } catch (e: any) {
      setLastPush({ when: Date.now(), success: false, error: e?.message ?? String(e) });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div style={{
      background: C_BG, minHeight: '100%', padding: 20,
      display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto',
    }}>
      {/* Title + control row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, color: C_TEXT, fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>
            Universe Monitor
          </h2>
          <div style={{ color: C_DIM, fontSize: 11, marginTop: 4 }}>
            broker telemetry → mapping → perceptual space → CES → governed output
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastPush && (
            <div style={{ fontSize: 10, color: lastPush.success ? C_OK : C_ERROR, fontFamily: 'monospace' }}>
              {lastPush.success ? '✓ push @ ' : '✗ '}
              {lastPush.success
                ? new Date(lastPush.when).toLocaleTimeString()
                : (lastPush.error ?? 'push failed')}
            </div>
          )}
          <button
            onClick={triggerPush}
            disabled={pushing}
            title="POST /api/perception/push — manually drive one PE → RE step"
            style={{
              background: pushing ? '#1e293b' : C_ACCENT, color: pushing ? C_DIM : '#0f172a',
              border: 'none', borderRadius: 6, padding: '8px 16px',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              cursor: pushing ? 'wait' : 'pointer',
              textTransform: 'uppercase',
            }}
            onMouseOver={e => { if (!pushing) (e.target as HTMLButtonElement).style.background = C_ACCENT_HOVER; }}
            onMouseOut={e =>  { if (!pushing) (e.target as HTMLButtonElement).style.background = C_ACCENT; }}
          >
            {pushing ? 'Pushing…' : 'Trigger Push'}
          </button>
        </div>
      </div>

      <MqttBridgePanel />
      <MqttIngestStream />
      <SensorSourcesPanel />
      <PagingDecisionsTicker />
    </div>
  );
};
