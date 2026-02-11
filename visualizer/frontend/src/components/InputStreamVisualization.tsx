import React, { useState } from 'react';
import InputSequenceSelector from './InputSequenceSelector';

interface InputStreamVisualizationProps {
  inputVectors: number[][];
  currentIndex: number;
  isPlaying: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: () => void;
  onSpeedChange: (delayMs: number) => void;
  currentSpeed?: number;
}

const InputStreamVisualization: React.FC<InputStreamVisualizationProps> = ({
  inputVectors,
  currentIndex,
  isPlaying,
  isPaused,
  onStart,
  onPause,
  onReset,
  onStep,
  onSpeedChange,
  currentSpeed = 500
}) => {
  const [speed, setSpeed] = useState(currentSpeed);

  // Show next 5 vectors in the queue
  const visibleVectors = inputVectors.slice(currentIndex, currentIndex + 5);
  const hasVectors = inputVectors.length > 0;

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    onSpeedChange(newSpeed);
  };

  return (
    <div style={{
      width: '220px',
      height: '100%',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      borderRight: '2px solid #3b82f6',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxShadow: 'inset -5px 0 15px rgba(59, 130, 246, 0.1)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #3b82f6'
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: '#3b82f6',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '18px' }}>→</span>
          INPUT STREAM
        </div>
        <div style={{
          fontSize: '12px',
          color: '#64748b',
          fontFamily: 'monospace'
        }}>
          {inputVectors.length > 0 ? (
            <>Vector {currentIndex + 1} / {inputVectors.length}</>
          ) : (
            <>No vectors loaded</>
          )}
        </div>
      </div>

      {/* Input Sequence Selector */}
      <InputSequenceSelector />

      {/* Vector Queue */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {visibleVectors.length === 0 ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#475569',
            fontSize: '13px',
            border: '2px dashed #334155',
            borderRadius: '8px',
            background: '#1e293b'
          }}>
            Load vectors to begin
          </div>
        ) : (
          visibleVectors.map((vector, index) => {
            const absoluteIndex = currentIndex + index;
            const isNext = absoluteIndex === currentIndex;
            const isPast = absoluteIndex < currentIndex;

            return (
              <div
                key={absoluteIndex}
                style={{
                  padding: '12px',
                  background: isNext
                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                    : isPast
                      ? '#1e293b'
                      : '#334155',
                  border: isNext ? '2px solid #60a5fa' : '1px solid #475569',
                  borderRadius: '8px',
                  opacity: isPast ? 0.3 : 1,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  boxShadow: isNext ? '0 0 20px rgba(59, 130, 246, 0.4)' : 'none',
                  animation: isNext && isPlaying ? 'pulse 1s ease-in-out infinite' : 'none'
                }}
              >
                {/* Vector Index */}
                <div style={{
                  fontSize: '10px',
                  color: isNext ? '#e0f2fe' : '#94a3b8',
                  marginBottom: '6px',
                  fontWeight: '600',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>V{absoluteIndex + 1}</span>
                  {isNext && isPlaying && (
                    <span style={{
                      fontSize: '16px',
                      animation: 'slideRight 1s ease-in-out infinite'
                    }}>⚡</span>
                  )}
                </div>

                {/* Vector Values */}
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: isNext ? '#fff' : '#cbd5e1',
                  wordBreak: 'break-all',
                  lineHeight: '1.4'
                }}>
                  [{vector.map(v => v.toFixed(2)).join(', ')}]
                </div>

                {/* Next Indicator */}
                {isNext && (
                  <div style={{
                    position: 'absolute',
                    right: '-12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '20px',
                    color: '#3b82f6',
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

      {/* Simulation Controls */}
      <div style={{
        marginTop: '15px',
        paddingTop: '15px',
        borderTop: '2px solid #3b82f6',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '600',
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '4px'
        }}>
          Controls
        </div>

        {/* Start/Pause Button */}
        <button
          onClick={isPlaying ? onPause : onStart}
          disabled={!hasVectors}
          style={{
            padding: '10px 16px',
            background: isPlaying
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
            cursor: hasVectors ? 'pointer' : 'not-allowed',
            opacity: hasVectors ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: hasVectors ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (hasVectors) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasVectors) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>
            {isPlaying ? '⏸' : '▶'}
          </span>
          {isPlaying ? 'Pause' : (isPaused ? 'Resume' : 'Start')}
        </button>

        {/* Reset Button */}
        <button
          onClick={onReset}
          disabled={!hasVectors}
          style={{
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
            cursor: hasVectors ? 'pointer' : 'not-allowed',
            opacity: hasVectors ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: hasVectors ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (hasVectors) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasVectors) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>↻</span>
          Reset
        </button>

        {/* Divider */}
        <div style={{
          height: '1px',
          background: '#475569',
          margin: '8px 0'
        }} />

        {/* Manual Step Button */}
        <button
          onClick={onStep}
          disabled={!hasVectors || isPlaying}
          style={{
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '600',
            cursor: (hasVectors && !isPlaying) ? 'pointer' : 'not-allowed',
            opacity: (hasVectors && !isPlaying) ? 1 : 0.5,
            transition: 'all 0.2s ease',
            boxShadow: (hasVectors && !isPlaying) ? '0 2px 8px rgba(0, 0, 0, 0.3)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          onMouseEnter={(e) => {
            if (hasVectors && !isPlaying) {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (hasVectors && !isPlaying) {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            }
          }}
        >
          <span style={{ fontSize: '16px' }}>⏯</span>
          Step
        </button>

        {/* Speed Control */}
        <div style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #475569'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Speed
            </span>
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#3b82f6',
              fontFamily: 'monospace'
            }}>
              {speed}ms
            </span>
          </div>
          <input
            type="range"
            min="200"
            max="1000"
            step="50"
            value={speed}
            onChange={(e) => handleSpeedChange(Number(e.target.value))}
            disabled={!hasVectors}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: hasVectors
                ? 'linear-gradient(90deg, #22c55e 0%, #f59e0b 50%, #ef4444 100%)'
                : '#334155',
              outline: 'none',
              opacity: hasVectors ? 1 : 0.5,
              cursor: hasVectors ? 'pointer' : 'not-allowed'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: '4px'
          }}>
            <span style={{
              fontSize: '9px',
              color: '#64748b'
            }}>Fast</span>
            <span style={{
              fontSize: '9px',
              color: '#64748b'
            }}>Slow</span>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        @keyframes slideRight {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(3px); }
        }
      `}</style>
    </div>
  );
};

export default InputStreamVisualization;
