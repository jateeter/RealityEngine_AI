import { SequenceGraph, EngineStats } from '../types';

interface SidebarProps {
  sequences: SequenceGraph[];
  selectedSequenceId: string | null;
  stats: EngineStats | null;
  onSequenceSelect: (id: string) => void;
  onRefresh: () => void;
  onLoadDemo?: () => void;
  isConnected: boolean;
}

export default function Sidebar({
  sequences,
  selectedSequenceId,
  stats,
  onSequenceSelect,
  onRefresh,
  onLoadDemo,
  isConnected
}: SidebarProps) {
  return (
    <div
      style={{
        width: '300px',
        height: '100%',
        background: '#0f0f0f',
        borderRight: '1px solid #222',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #222',
          background: '#1a1a1a'
        }}
      >
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
          Reality Engine
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#22c55e' : '#ef4444',
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }}
          />
          <span style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #222',
            fontSize: '12px'
          }}
        >
          <div style={{ marginBottom: '8px', color: '#888' }}>Engine Statistics</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ color: '#888' }}>Sequences</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>
                {stats.totalSequences}
              </div>
            </div>
            <div>
              <div style={{ color: '#888' }}>Vectors</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8b5cf6' }}>
                {stats.totalVectors}
              </div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ color: '#888' }}>Active Vectors</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#22c55e' }}>
                {stats.totalActiveVectors}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding: '16px', borderBottom: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {onLoadDemo && (
          <button
            onClick={onLoadDemo}
            style={{
              width: '100%',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
            }}
          >
            🎯 Load Demo
          </button>
        )}
        <button
          onClick={onRefresh}
          style={{
            width: '100%',
            padding: '8px 16px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#3b82f6')}
        >
          Refresh Data
        </button>
      </div>

      {/* Sequences list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ marginBottom: '12px', fontSize: '12px', color: '#888', fontWeight: 'bold' }}>
          SEQUENCES ({sequences.length})
        </div>

        {sequences.length === 0 ? (
          <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', marginTop: '32px' }}>
            No sequences found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sequences.map((sequence) => (
              <div
                key={sequence.sequenceId}
                onClick={() => onSequenceSelect(sequence.sequenceId)}
                style={{
                  padding: '12px',
                  background: selectedSequenceId === sequence.sequenceId ? '#1e3a8a' : '#1a1a1a',
                  border: `1px solid ${selectedSequenceId === sequence.sequenceId ? '#3b82f6' : '#333'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedSequenceId !== sequence.sequenceId) {
                    e.currentTarget.style.background = '#222';
                    e.currentTarget.style.borderColor = '#444';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSequenceId !== sequence.sequenceId) {
                    e.currentTarget.style.background = '#1a1a1a';
                    e.currentTarget.style.borderColor = '#333';
                  }
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                  {sequence.sequenceName}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  ID: {sequence.sequenceId.substring(0, 12)}...
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '6px',
                    marginTop: '8px',
                    fontSize: '11px'
                  }}
                >
                  <div>
                    <span style={{ color: '#888' }}>Vectors:</span>{' '}
                    <span style={{ color: '#8b5cf6' }}>{sequence.stats.totalVectors}</span>
                  </div>
                  <div>
                    <span style={{ color: '#888' }}>Active:</span>{' '}
                    <span style={{ color: '#22c55e' }}>{sequence.stats.activeVectors}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
