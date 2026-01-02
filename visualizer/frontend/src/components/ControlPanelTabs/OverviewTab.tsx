import React from 'react';
import { Machine } from '../../types';

interface OverviewTabProps {
  machine: Machine | null;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ machine }) => {
  if (!machine) {
    return (
      <div style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>
        No machine selected
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      {/* Machine Name */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold', color: '#e2e8f0' }}>
          {machine.name}
        </h3>
        {machine.isExample && (
          <span
            style={{
              display: 'inline-block',
              background: '#3b82f6',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600'
            }}
          >
            Example Machine
          </span>
        )}
      </div>

      {/* Description */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
          Description
        </div>
        <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
          {machine.description || 'No description available'}
        </div>
      </div>

      {/* Statistics */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Statistics
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Total Sequences
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e2e8f0' }}>
                {machine.sequenceCount}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                Total Vectors
              </div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#e2e8f0' }}>
                {machine.totalVectors}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sequences List */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Sequences ({machine.sequences.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {machine.sequences.map((seq) => (
            <div
              key={seq.id}
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                padding: '12px',
                fontSize: '13px',
                color: '#cbd5e1'
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{seq.name}</div>
              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                {seq.id}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Metadata
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
            <div style={{ color: '#64748b', marginBottom: '4px' }}>Machine ID</div>
            <div style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{machine.id}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>Created</div>
            <div style={{ color: '#cbd5e1' }}>{formatDate(machine.createdAt)}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#64748b', marginBottom: '4px' }}>Last Updated</div>
            <div style={{ color: '#cbd5e1' }}>{formatDate(machine.updatedAt)}</div>
          </div>
          {machine.lastAccessedAt && (
            <div>
              <div style={{ color: '#64748b', marginBottom: '4px' }}>Last Accessed</div>
              <div style={{ color: '#cbd5e1' }}>{formatDate(machine.lastAccessedAt)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
