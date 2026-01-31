import React, { useEffect, useState } from 'react';
import { OutputVector } from '../types';

interface InputOutputPanelProps {
  inputVector: number[] | null;
  outputVectors: OutputVector[];
  currentIndex: number;
  side: 'left' | 'right';
}

/**
 * InputOutputPanel - Displays current input vector or active outputs
 *
 * Props:
 * - inputVector: Current input vector being processed (for left panel)
 * - outputVectors: Active output vectors (for right panel)
 * - currentIndex: Index of current input vector
 * - side: 'left' for input, 'right' for output
 */
export const InputOutputPanel: React.FC<InputOutputPanelProps> = ({
  inputVector,
  outputVectors,
  currentIndex,
  side
}) => {
  const [flashOutputs, setFlashOutputs] = useState(false);

  // Flash animation when new outputs appear
  useEffect(() => {
    if (side === 'right' && outputVectors.length > 0) {
      setFlashOutputs(true);
      const timer = setTimeout(() => setFlashOutputs(false), 500);
      return () => clearTimeout(timer);
    }
  }, [outputVectors.length, side]);

  const isInputPanel = side === 'left';

  return (
    <div
      style={{
        position: 'fixed',
        [side]: '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '220px',
        height: '500px',
        background: 'rgba(15, 23, 42, 0.95)',
        border: `2px solid ${isInputPanel ? '#3b82f6' : '#a855f7'}`,
        borderRadius: '12px',
        boxShadow: `0 8px 24px ${isInputPanel ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
        padding: '16px',
        zIndex: 100,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: `2px solid ${isInputPanel ? '#3b82f6' : '#a855f7'}`
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#94a3b8',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}
        >
          {isInputPanel ? 'CURRENT INPUT' : 'ACTIVE OUTPUTS'}
        </div>
        {isInputPanel && inputVector && (
          <div
            style={{
              fontSize: '10px',
              color: '#64748b',
              marginTop: '4px'
            }}
          >
            Vector #{currentIndex}
          </div>
        )}
        {!isInputPanel && (
          <div
            style={{
              display: 'inline-block',
              background: flashOutputs ? '#22c55e' : '#a855f7',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '600',
              transition: 'background 0.3s ease',
              marginTop: '4px'
            }}
          >
            {outputVectors.length} {outputVectors.length === 1 ? 'output' : 'outputs'}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {isInputPanel ? (
          // Input Vector Display
          inputVector ? (
            <div
              style={{
                background: '#1e293b',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 0 16px rgba(59, 130, 246, 0.3)'
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px'
                }}
              >
                {inputVector.map((value, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: value > 0.5 ? '#22c55e' : value > 0 ? '#f59e0b' : '#64748b',
                      color: '#fff',
                      padding: '8px 4px',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    {value.toFixed(2)}
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '10px',
                  color: '#94a3b8',
                  textAlign: 'center'
                }}
              >
                {inputVector.length}D vector
              </div>
            </div>
          ) : (
            <div
              style={{
                color: '#64748b',
                fontSize: '12px',
                textAlign: 'center',
                marginTop: '40px'
              }}
            >
              No input vector loaded
            </div>
          )
        ) : (
          // Output Vectors Display
          outputVectors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {outputVectors.map((output, idx) => (
                <div
                  key={output.id}
                  style={{
                    background: flashOutputs && idx === 0 ? 'rgba(34, 197, 94, 0.2)' : '#1e293b',
                    border: `2px solid ${flashOutputs && idx === 0 ? '#22c55e' : '#a855f7'}`,
                    borderRadius: '8px',
                    padding: '10px',
                    transition: 'all 0.5s ease',
                    animation: flashOutputs && idx === 0 ? 'pulse 0.5s ease-in-out' : 'none'
                  }}
                >
                  {/* Output Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '10px',
                        color: '#94a3b8',
                        fontWeight: '600'
                      }}
                    >
                      Output #{idx + 1}
                    </div>
                    {output.metadata && typeof output.metadata === 'object' && output.metadata.description && (
                      <div
                        style={{
                          fontSize: '9px',
                          color: '#64748b',
                          maxWidth: '100px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={output.metadata.description}
                      >
                        {output.metadata.description}
                      </div>
                    )}
                  </div>

                  {/* Output Vector Values */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      justifyContent: 'center'
                    }}
                  >
                    {output.vector.slice(0, 6).map((value, valIdx) => (
                      <div
                        key={valIdx}
                        style={{
                          background: value > 0.5 ? '#a855f7' : value > 0 ? '#8b5cf6' : '#475569',
                          color: '#fff',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          minWidth: '28px',
                          textAlign: 'center'
                        }}
                      >
                        {value}
                      </div>
                    ))}
                    {output.vector.length > 6 && (
                      <div
                        style={{
                          color: '#94a3b8',
                          fontSize: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 4px'
                        }}
                      >
                        +{output.vector.length - 6}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '9px',
                      color: '#64748b',
                      textAlign: 'right'
                    }}
                  >
                    {new Date(output.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                color: '#64748b',
                fontSize: '12px',
                textAlign: 'center',
                marginTop: '40px'
              }}
            >
              No outputs generated
            </div>
          )
        )}
      </div>

      {/* Connection Indicator */}
      <div
        style={{
          position: 'absolute',
          [isInputPanel ? 'right' : 'left']: '-24px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '24px',
          height: '2px',
          background: isInputPanel ? '#3b82f6' : '#a855f7',
          boxShadow: `0 0 8px ${isInputPanel ? 'rgba(59, 130, 246, 0.5)' : 'rgba(168, 85, 247, 0.5)'}`
        }}
      />
    </div>
  );
};

export default InputOutputPanel;
