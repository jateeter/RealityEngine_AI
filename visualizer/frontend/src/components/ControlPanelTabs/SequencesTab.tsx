import React from 'react';
import { useVisualizerStore } from '../../store';
import { Machine } from '../../types';

interface SequencesTabProps {
  machine: Machine | null;
}

const SequencesTab: React.FC<SequencesTabProps> = ({ machine }) => {
  const {
    sequences,
    selectedSequenceId,
    setSelectedSequence,
    expandedSequenceIds,
    toggleSequenceExpansion,
    expandAllSequences,
    collapseAllSequences
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
      {/* Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
            Sequences ({sequences.length})
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={expandAllSequences}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#cbd5e1',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Expand All
          </button>
          <button
            onClick={collapseAllSequences}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#cbd5e1',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Sequences List */}
      {sequences.length === 0 ? (
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
            color: '#64748b'
          }}
        >
          No sequences available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sequences.map((seq) => {
            const isSelected = selectedSequenceId === seq.sequenceId;
            const isExpanded = expandedSequenceIds.has(seq.sequenceId);
            const isActive = seq.stats.activeVectors > 0;

            return (
              <div
                key={seq.sequenceId}
                style={{
                  background: isSelected ? '#1e293b' : '#0f172a',
                  border: isActive ? '2px solid #22c55e' : '1px solid #1e293b',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Sequence Header */}
                <div
                  onClick={() => setSelectedSequence(seq.sequenceId)}
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      {/* Active Indicator */}
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: isActive ? '#22c55e' : '#64748b',
                          boxShadow: isActive ? '0 0 6px rgba(34, 197, 94, 0.6)' : 'none'
                        }}
                      />
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>
                        {seq.sequenceName}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginLeft: '16px' }}>
                      {seq.sequenceId}
                    </div>
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSequenceExpansion(seq.sequenceId);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                </div>

                {/* Sequence Details (Expanded) */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid #1e293b',
                      padding: '16px',
                      background: '#0a0a0a'
                    }}
                  >
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Total Vectors</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#e2e8f0' }}>
                          {seq.stats.totalVectors}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Active Vectors</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: isActive ? '#22c55e' : '#64748b' }}>
                          {seq.stats.activeVectors}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Initial Vectors</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                          {seq.stats.initialVectors}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Output Vectors</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b' }}>
                          {seq.stats.outputVectors}
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    {Object.keys(seq.metadata).length > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
                          Metadata
                        </div>
                        <div
                          style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            padding: '12px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#cbd5e1',
                            maxHeight: '150px',
                            overflowY: 'auto'
                          }}
                        >
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(seq.metadata, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SequencesTab;
