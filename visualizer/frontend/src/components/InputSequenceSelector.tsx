import React, { useState, useEffect } from 'react';
import { useVisualizerStore } from '../store';

interface InputSequence {
  name: string;
  pattern: string;
  description: string;
  vectors: number[][];
  metadata?: Record<string, any>;
}

const InputSequenceSelector: React.FC = () => {
  const {
    currentMachine,
    loadSimulation,
    simulationState
  } = useVisualizerStore();

  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Get available input sequences from machine metadata
  const inputSequences: InputSequence[] = currentMachine?.metadata?.inputSequences || [];

  // Auto-select comprehensive validation if available
  useEffect(() => {
    if (inputSequences.length > 0 && !selectedSequence) {
      const validationSeq = inputSequences.find(seq =>
        seq.name.toLowerCase().includes('validation') ||
        seq.name.toLowerCase().includes('comprehensive')
      );
      if (validationSeq) {
        setSelectedSequence(validationSeq.name);
      } else {
        setSelectedSequence(inputSequences[0].name);
      }
    }
  }, [inputSequences, selectedSequence]);

  if (!inputSequences || inputSequences.length === 0) {
    return null; // Don't show if no sequences available
  }

  const handleLoadSequence = async () => {
    const sequence = inputSequences.find(seq => seq.name === selectedSequence);
    if (!sequence) return;

    // Load the sequence vectors using loadSimulation
    await loadSimulation(sequence.vectors, {
      autoPlayDelayMs: 1500,
      loop: false
    });
  };

  const currentSequence = inputSequences.find(seq => seq.name === selectedSequence);
  const isRunning = simulationState?.status === 'playing';

  return (
    <div
      style={{
        background: '#1e293b',
        border: '2px solid #334155',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '12px'
      }}
    >
      {/* Header with Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '16px',
              color: '#94a3b8',
              transition: 'transform 0.2s ease',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}
          >
            ▶
          </span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0' }}>
            Input Sequence Selector
          </span>
        </div>
        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            background: '#0f172a',
            padding: '3px 8px',
            borderRadius: '4px'
          }}
        >
          {inputSequences.length} sequence{inputSequences.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
          {/* Dropdown */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                color: '#94a3b8',
                marginBottom: '6px',
                fontWeight: '500'
              }}
            >
              Select Input Sequence:
            </label>
            <select
              value={selectedSequence}
              onChange={(e) => setSelectedSequence(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                color: '#e2e8f0',
                padding: '8px 12px',
                fontSize: '13px',
                cursor: 'pointer',
                outline: 'none'
              }}
              disabled={isRunning}
            >
              {inputSequences.map((seq) => (
                <option key={seq.name} value={seq.name}>
                  {seq.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sequence Details */}
          {currentSequence && (
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '12px'
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                  Pattern:
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginLeft: '6px',
                    fontFamily: 'monospace'
                  }}
                >
                  {currentSequence.pattern}
                </span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                  Description:
                </span>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginTop: '4px',
                    lineHeight: '1.5'
                  }}
                >
                  {currentSequence.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b'
                  }}
                >
                  <span style={{ fontWeight: '600' }}>Vectors:</span>
                  <span style={{ color: '#3b82f6', marginLeft: '4px', fontWeight: '600' }}>
                    {currentSequence.vectors.length}
                  </span>
                </div>
                {currentSequence.metadata?.totalSteps && (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    <span style={{ fontWeight: '600' }}>Steps:</span>
                    <span style={{ color: '#3b82f6', marginLeft: '4px', fontWeight: '600' }}>
                      {currentSequence.metadata.totalSteps}
                    </span>
                  </div>
                )}
                {currentSequence.metadata?.expectedOutputs && (
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    <span style={{ fontWeight: '600' }}>Expected Outputs:</span>
                    <span style={{ color: '#10b981', marginLeft: '4px', fontWeight: '600' }}>
                      {currentSequence.metadata.expectedOutputs}
                    </span>
                  </div>
                )}
              </div>

              {/* Validation Badges */}
              {currentSequence.metadata?.validationType === 'comprehensive' && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {currentSequence.metadata.validatesEventActivation && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#059669',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}
                    >
                      ✓ Event Activation
                    </span>
                  )}
                  {currentSequence.metadata.validatesOutputGeneration && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#059669',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}
                    >
                      ✓ Output Generation
                    </span>
                  )}
                  {currentSequence.metadata.validatesVisualization && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#059669',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}
                    >
                      ✓ Visualization
                    </span>
                  )}
                  {currentSequence.metadata.validatesRepeatedOperations && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#059669',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}
                    >
                      ✓ Repeated Ops
                    </span>
                  )}
                  {currentSequence.metadata.validatesStateTransitions && (
                    <span
                      style={{
                        fontSize: '10px',
                        background: '#059669',
                        color: '#fff',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}
                    >
                      ✓ State Transitions
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Load Button */}
          <button
            onClick={handleLoadSequence}
            disabled={isRunning || !selectedSequence}
            style={{
              width: '100%',
              background: isRunning || !selectedSequence ? '#475569' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isRunning || !selectedSequence ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isRunning || !selectedSequence ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isRunning && selectedSequence) {
                e.currentTarget.style.background = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning && selectedSequence) {
                e.currentTarget.style.background = '#3b82f6';
              }
            }}
          >
            {isRunning ? 'Simulation Running...' : 'Load Sequence'}
          </button>

          {/* Help Text */}
          <div
            style={{
              marginTop: '10px',
              fontSize: '11px',
              color: '#64748b',
              lineHeight: '1.5'
            }}
          >
            💡 Select a predefined input sequence and click "Load Sequence" to load the vectors.
            Then use the simulation controls to step through or play the sequence.
          </div>
        </div>
      )}
    </div>
  );
};

export default InputSequenceSelector;
