import React from 'react';
import { OutputVector } from '../types';

interface OutputStreamVisualizationProps {
  outputVectors: OutputVector[];
  maxVisible?: number;
}

const OutputStreamVisualization: React.FC<OutputStreamVisualizationProps> = ({
  outputVectors,
  maxVisible = 10
}) => {
  // Show most recent outputs (reverse chronological)
  const visibleOutputs = outputVectors.slice(-maxVisible).reverse();

  return (
    <div style={{
      width: '220px',
      height: '100%',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderLeft: '2px solid #f59e0b',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxShadow: 'inset 5px 0 15px rgba(245, 158, 11, 0.1)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #f59e0b'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#f59e0b',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          OUTPUT STREAM
          <span style={{ fontSize: '18px' }}>→</span>
        </div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          fontFamily: 'monospace'
        }}>
          {outputVectors.length > 0 ? (
            <>{outputVectors.length} output{outputVectors.length !== 1 ? 's' : ''}</>
          ) : (
            <>No outputs yet</>
          )}
        </div>
      </div>

      {/* Output Queue */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {visibleOutputs.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#475569',
            fontSize: '13px',
            border: '2px dashed #334155',
            borderRadius: '8px',
            background: '#1e293b'
          }}>
            Waiting for outputs...
          </div>
        ) : (
          visibleOutputs.map((output, index) => {
            const isRecent = index === 0; // Most recent output
            const age = Date.now() - (output.timestamp || 0);
            const isNew = age < 3000; // New if less than 3 seconds old

            return (
              <div
                key={output.id || index}
                style={{
                  padding: '12px',
                  background: isRecent
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : '#334155',
                  border: isRecent ? '2px solid #fbbf24' : '1px solid #475569',
                  borderRadius: '8px',
                  opacity: isRecent ? 1 : 0.7,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  boxShadow: isRecent ? '0 0 20px rgba(245, 158, 11, 0.4)' : 'none',
                  animation: isNew ? 'slideIn 0.3s ease-out' : 'none'
                }}
              >
                {/* Output ID */}
                <div style={{
                  fontSize: '10px',
                  color: isRecent ? '#fef3c7' : '#94a3b8',
                  marginBottom: '6px',
                  fontWeight: '600',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{
                    maxWidth: '140px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {output.id || `Output ${outputVectors.length - index}`}
                  </span>
                  {isRecent && isNew && (
                    <span style={{
                      fontSize: '12px',
                      animation: 'sparkle 1s ease-in-out infinite'
                    }}>✨</span>
                  )}
                </div>

                {/* Vector Values */}
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: isRecent ? '#fff' : '#cbd5e1',
                  wordBreak: 'break-all',
                  lineHeight: '1.4',
                  marginBottom: output.metadata ? '8px' : '0'
                }}>
                  [{output.vector.map(v => v.toFixed(2)).join(', ')}]
                </div>

                {/* Metadata */}
                {output.metadata && (
                  <div style={{
                    fontSize: '10px',
                    color: isRecent ? '#fde68a' : '#64748b',
                    fontStyle: 'italic',
                    borderTop: `1px solid ${isRecent ? '#fbbf24' : '#475569'}`,
                    paddingTop: '6px',
                    maxHeight: '40px',
                    overflow: 'hidden'
                  }}>
                    {typeof output.metadata === 'string'
                      ? output.metadata
                      : JSON.stringify(output.metadata).slice(0, 50) + '...'}
                  </div>
                )}

                {/* New Indicator */}
                {isRecent && (
                  <div style={{
                    position: 'absolute',
                    left: '-12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '20px',
                    color: '#f59e0b',
                    animation: 'bounce 1s ease-in-out infinite'
                  }}>
                    →
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(-3px); }
        }
      `}</style>
    </div>
  );
};

export default OutputStreamVisualization;
