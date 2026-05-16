import React from 'react';
import { UniverseMonitor } from '../components/UniverseMonitor';
import { useVisualizerStore } from '../store';

/**
 * UniverseView — top-level page that hosts UniverseMonitor.  Adds a back-
 * navigation header so operators can return to the machine selection / admin
 * view from the universe-wide monitor surface.
 */

const C_BG     = '#0a0a0a';
const C_HEADER = '#0f172a';
const C_BORDER = '#1e293b';
const C_TEXT   = '#e2e8f0';
const C_DIM    = '#94a3b8';

const UniverseView: React.FC = () => {
  const { setCurrentView } = useVisualizerStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C_BG, color: C_TEXT }}>
      <div style={{
        height: 60, background: C_HEADER, borderBottom: `2px solid ${C_BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setCurrentView('selection')}
            style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
              color: C_DIM, padding: '8px 12px', cursor: 'pointer',
              fontSize: 14, fontWeight: 500,
            }}
          >← Back</button>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>
            Universe Monitor
          </h1>
        </div>
        <div style={{ color: C_DIM, fontSize: 11 }}>
          live PE / RE / MQTT pipeline · refresh: panels poll on their own cadence
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <UniverseMonitor />
      </div>
    </div>
  );
};

export default UniverseView;
