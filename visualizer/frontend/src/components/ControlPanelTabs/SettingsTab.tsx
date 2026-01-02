import React from 'react';
import { useVisualizerStore } from '../../store';
import { Machine } from '../../types';

interface SettingsTabProps {
  machine: Machine | null;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ machine }) => {
  const {
    autoRefresh,
    refreshInterval,
    isHeatmapEnabled,
    setAutoRefresh,
    setRefreshInterval,
    toggleHeatmap
  } = useVisualizerStore();

  if (!machine) {
    return (
      <div style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>
        No machine selected
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      {/* Visualization Settings */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Visualization
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          {/* Heatmap Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>
                Activation Heatmap
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Show vector activation visualization
              </div>
            </div>
            <button
              onClick={toggleHeatmap}
              style={{
                background: isHeatmapEnabled ? '#3b82f6' : '#1e293b',
                border: 'none',
                borderRadius: '20px',
                width: '48px',
                height: '26px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: isHeatmapEnabled ? '25px' : '3px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'all 0.3s ease'
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Refresh Settings */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Auto-Refresh
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          {/* Auto-Refresh Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>
                Enable Auto-Refresh
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Automatically refresh graph data
              </div>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{
                background: autoRefresh ? '#3b82f6' : '#1e293b',
                border: 'none',
                borderRadius: '20px',
                width: '48px',
                height: '26px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: autoRefresh ? '25px' : '3px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'all 0.3s ease'
                }}
              />
            </button>
          </div>

          {/* Refresh Interval */}
          {autoRefresh && (
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>
                Refresh Interval
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[1000, 2000, 5000, 10000].map((interval) => (
                  <button
                    key={interval}
                    onClick={() => setRefreshInterval(interval)}
                    style={{
                      background: refreshInterval === interval ? '#3b82f6' : '#1e293b',
                      border: refreshInterval === interval ? 'none' : '1px solid #334155',
                      borderRadius: '6px',
                      color: '#cbd5e1',
                      padding: '10px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {interval / 1000}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Machine Information */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Machine Information
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '16px',
            fontSize: '12px'
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#64748b', marginBottom: '6px' }}>Machine ID</div>
            <div
              style={{
                background: '#1e293b',
                padding: '8px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                color: '#cbd5e1',
                fontSize: '11px',
                wordBreak: 'break-all'
              }}
            >
              {machine.id}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ color: '#64748b', marginBottom: '6px' }}>Sequences</div>
              <div style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: '600' }}>
                {machine.sequenceCount}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', marginBottom: '6px' }}>Vectors</div>
              <div style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: '600' }}>
                {machine.totalVectors}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {!machine.isExample && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#f87171', marginBottom: '12px' }}>
            Danger Zone
          </div>
          <div
            style={{
              background: '#7f1d1d',
              border: '1px solid #991b1b',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fecaca', marginBottom: '8px' }}>
              Delete Machine
            </div>
            <div style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '12px' }}>
              Once you delete a machine, there is no going back. Please be certain.
            </div>
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete "${machine.name}"? This action cannot be undone.`)) {
                  // TODO: Implement delete functionality
                  console.log('Delete machine:', machine.id);
                }
              }}
              style={{
                background: '#991b1b',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '10px 20px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Delete Machine
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsTab;
