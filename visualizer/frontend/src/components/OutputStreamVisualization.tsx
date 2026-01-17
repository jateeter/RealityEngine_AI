import React, { useEffect, useRef } from 'react';
import { OutputVector } from '../types';

interface OutputStreamVisualizationProps {
  outputVectors: OutputVector[];
  maxVisible?: number;
}

const OutputStreamVisualization: React.FC<OutputStreamVisualizationProps> = ({
  outputVectors
}) => {
  const historyRef = useRef<HTMLDivElement>(null);
  const currentOutput = outputVectors.length > 0 ? outputVectors[outputVectors.length - 1] : null;
  // Keep chronological order (oldest to newest) - will use reverse flex direction
  const history = outputVectors.length > 1 ? outputVectors.slice(0, -1) : [];

  // Auto-scroll history to top when new output arrives (newest items appear at top in reverse flex)
  useEffect(() => {
    if (historyRef.current && outputVectors.length > 0) {
      historyRef.current.scrollTop = 0;
    }
  }, [outputVectors.length]);

  const renderOutputCard = (output: OutputVector, isCurrent: boolean, index?: number) => {
    const age = Date.now() - (output.timestamp || 0);
    const isNew = age < 3000;

    return (
      <div
        key={output.id || index}
        style={{
          padding: '12px',
          background: isCurrent
            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
            : '#334155',
          border: isCurrent ? '2px solid #fbbf24' : '1px solid #475569',
          borderRadius: '8px',
          transition: 'all 0.3s ease',
          position: 'relative',
          boxShadow: isCurrent ? '0 0 20px rgba(245, 158, 11, 0.4)' : 'none',
          animation: isCurrent && isNew ? 'slideIn 0.3s ease-out' : 'none'
        }}
      >
        {/* Output ID */}
        <div style={{
          fontSize: '10px',
          color: isCurrent ? '#fef3c7' : '#94a3b8',
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
            {output.id || `Output ${index !== undefined ? outputVectors.length - index : outputVectors.length}`}
          </span>
          {isCurrent && isNew && (
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
          color: isCurrent ? '#fff' : '#cbd5e1',
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
            color: isCurrent ? '#fde68a' : '#64748b',
            fontStyle: 'italic',
            borderTop: `1px solid ${isCurrent ? '#fbbf24' : '#475569'}`,
            paddingTop: '6px',
            maxHeight: '40px',
            overflow: 'hidden'
          }}>
            {typeof output.metadata === 'string'
              ? output.metadata
              : output.metadata.description || JSON.stringify(output.metadata).slice(0, 50) + '...'}
          </div>
        )}

        {/* Current Indicator */}
        {isCurrent && (
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
  };

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
        marginBottom: '16px',
        paddingBottom: '12px',
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

      {outputVectors.length === 0 ? (
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
        <>
          {/* Current Output Section */}
          <div style={{
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: '700',
              color: '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>CURRENT</span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#f59e0b',
                animation: 'pulse 2s ease-in-out infinite'
              }}></div>
            </div>
            {currentOutput && renderOutputCard(currentOutput, true)}
          </div>

          {/* History Section */}
          {history.length > 0 && (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>HISTORY</span>
                <span style={{
                  fontSize: '9px',
                  color: '#475569',
                  fontWeight: '400',
                  fontFamily: 'monospace'
                }}>
                  {history.length} previous
                </span>
              </div>
              <div
                ref={historyRef}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  gap: '10px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingRight: '4px',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#475569 #1e293b'
                }}
              >
                {history.map((output, index) => renderOutputCard(output, false, index))}
              </div>
            </div>
          )}
        </>
      )}

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

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
};

export default OutputStreamVisualization;
