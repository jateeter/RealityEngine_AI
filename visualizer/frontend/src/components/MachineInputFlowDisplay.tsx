import React from 'react';
import './MachineInputFlowDisplay.css';

interface MachineInputFlowDisplayProps {
  // Universal perceptual space vector (256 bytes)
  universalVector: number[];
  // Machine's input region mapping
  inputMapping: { offset: number; length: number };
  // Machine's output region mapping
  outputMapping: { offset: number; length: number };
  // Machine's extracted input from En
  machineInput: number[] | null;
  // Machine's output to be merged back to En
  machineOutput: number[] | null;
  // Current active sequence name
  activeSequence: string | null;
  // Machine name
  machineName: string;
}

export const MachineInputFlowDisplay: React.FC<MachineInputFlowDisplayProps> = ({
  universalVector,
  inputMapping,
  outputMapping,
  machineInput,
  machineOutput,
  activeSequence,
  machineName
}) => {
  // Helper to format byte range
  const formatRange = (offset: number, length: number) => {
    return `[${offset}:${offset + length}]`;
  };

  // Helper to format vector display (truncate if too long)
  const formatVector = (vec: number[], maxDisplay: number = 10) => {
    if (vec.length <= maxDisplay) {
      return vec.map(v => v.toFixed(2)).join(', ');
    }
    const shown = vec.slice(0, maxDisplay).map(v => v.toFixed(2)).join(', ');
    return `${shown}, ... (${vec.length} total)`;
  };

  // Check if we have input data
  const hasInput = machineInput !== null;
  const hasOutput = machineOutput !== null;

  // Simulate output merge into En
  const updatedUniversalVector = [...universalVector];
  if (machineOutput) {
    for (let i = 0; i < machineOutput.length; i++) {
      const targetIndex = outputMapping.offset + i;
      if (targetIndex < updatedUniversalVector.length) {
        updatedUniversalVector[targetIndex] = machineOutput[i];
      }
    }
  }

  return (
    <div className="machine-input-flow-display">
      {/* Header */}
      <div className="flow-header">
        <span className="flow-icon">🔄</span>
        <span className="flow-title">Perceptual Input Flow: {machineName}</span>
      </div>

      {/* Step 1: Universal Perceptual Space (En) */}
      <div className="flow-step">
        <div className="step-label">
          <span className="step-number">1</span>
          <span className="step-title">Universal Perceptual Space (En)</span>
        </div>
        <div className="step-content en-display">
          <div className="en-info">
            <span className="en-dimension">256 bytes</span>
            <span className="en-range-highlight">
              Input region: <span className="range-tag input-range">{formatRange(inputMapping.offset, inputMapping.length)}</span>
            </span>
            <span className="en-range-highlight">
              Output region: <span className="range-tag output-range">{formatRange(outputMapping.offset, outputMapping.length)}</span>
            </span>
          </div>
          <div className="en-vector">
            <span className="vector-label">Current En:</span>
            <div className="vector-bytes">
              {universalVector.slice(0, 16).map((val, idx) => (
                <span
                  key={idx}
                  className={`byte-cell ${
                    idx >= inputMapping.offset && idx < inputMapping.offset + inputMapping.length
                      ? 'input-region'
                      : idx >= outputMapping.offset && idx < outputMapping.offset + outputMapping.length
                      ? 'output-region'
                      : ''
                  }`}
                  title={`Byte ${idx}: ${val.toFixed(2)}`}
                >
                  {val.toFixed(1)}
                </span>
              ))}
              <span className="byte-ellipsis">... ({universalVector.length} total)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Arrow down */}
      <div className="flow-arrow">
        <div className="arrow-line"></div>
        <div className="arrow-label">Extract input region {formatRange(inputMapping.offset, inputMapping.length)}</div>
        <div className="arrow-head">▼</div>
      </div>

      {/* Step 2: Machine Input (Extracted from En) */}
      <div className="flow-step">
        <div className="step-label">
          <span className="step-number">2</span>
          <span className="step-title">Machine Input (Extracted from En)</span>
        </div>
        <div className={`step-content machine-input-display ${hasInput ? 'has-data' : 'no-data'}`}>
          {hasInput ? (
            <>
              <div className="input-info">
                <span className="input-dimension">{machineInput.length} bytes</span>
                <span className="input-source">from En {formatRange(inputMapping.offset, inputMapping.length)}</span>
              </div>
              <div className="input-vector">
                <span className="vector-label">Machine sees:</span>
                <div className="vector-values">[{formatVector(machineInput)}]</div>
              </div>
            </>
          ) : (
            <div className="no-data-message">
              <span className="no-data-icon">⏸</span>
              <span>Waiting for input...</span>
            </div>
          )}
        </div>
      </div>

      {/* Arrow down */}
      {hasInput && (
        <>
          <div className="flow-arrow">
            <div className="arrow-line"></div>
            <div className="arrow-label">Process through sequences</div>
            <div className="arrow-head">▼</div>
          </div>

          {/* Step 3: Sequence Processing */}
          <div className="flow-step">
            <div className="step-label">
              <span className="step-number">3</span>
              <span className="step-title">Sequence Processing</span>
            </div>
            <div className="step-content sequence-display">
              {activeSequence ? (
                <div className="active-sequence">
                  <span className="sequence-icon">⚙️</span>
                  <span className="sequence-name">{activeSequence}</span>
                  <span className="sequence-status active">ACTIVE</span>
                </div>
              ) : (
                <div className="no-sequence">
                  <span className="sequence-icon">○</span>
                  <span>No active sequence</span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow down */}
          <div className="flow-arrow">
            <div className="arrow-line"></div>
            <div className="arrow-label">Generate output</div>
            <div className="arrow-head">▼</div>
          </div>

          {/* Step 4: Machine Output */}
          <div className="flow-step">
            <div className="step-label">
              <span className="step-number">4</span>
              <span className="step-title">Machine Output</span>
            </div>
            <div className={`step-content machine-output-display ${hasOutput ? 'has-data' : 'no-data'}`}>
              {hasOutput ? (
                <>
                  <div className="output-info">
                    <span className="output-dimension">{machineOutput.length} bytes</span>
                    <span className="output-destination">→ En {formatRange(outputMapping.offset, outputMapping.length)}</span>
                  </div>
                  <div className="output-vector">
                    <span className="vector-label">Machine outputs:</span>
                    <div className="vector-values">[{formatVector(machineOutput)}]</div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  <span className="no-data-icon">∅</span>
                  <span>No output generated</span>
                </div>
              )}
            </div>
          </div>

          {/* Arrow down */}
          {hasOutput && (
            <>
              <div className="flow-arrow">
                <div className="arrow-line"></div>
                <div className="arrow-label">Merge to En at offset {outputMapping.offset}</div>
                <div className="arrow-head">▼</div>
              </div>

              {/* Step 5: Updated En */}
              <div className="flow-step">
                <div className="step-label">
                  <span className="step-number">5</span>
                  <span className="step-title">Updated Universal Space (En)</span>
                </div>
                <div className="step-content en-updated-display">
                  <div className="en-update-info">
                    <span className="update-icon">✓</span>
                    <span className="update-text">
                      Bytes {formatRange(outputMapping.offset, outputMapping.length)} updated
                    </span>
                  </div>
                  <div className="en-vector">
                    <span className="vector-label">Updated En:</span>
                    <div className="vector-bytes">
                      {updatedUniversalVector.slice(0, 16).map((val, idx) => {
                        const isUpdated = idx >= outputMapping.offset && idx < outputMapping.offset + outputMapping.length;
                        return (
                          <span
                            key={idx}
                            className={`byte-cell ${
                              isUpdated ? 'output-region updated' : ''
                            } ${
                              idx >= inputMapping.offset && idx < inputMapping.offset + inputMapping.length
                                ? 'input-region'
                                : idx >= outputMapping.offset && idx < outputMapping.offset + outputMapping.length
                                ? 'output-region'
                                : ''
                            }`}
                            title={`Byte ${idx}: ${val.toFixed(2)}${isUpdated ? ' (UPDATED)' : ''}`}
                          >
                            {val.toFixed(1)}
                          </span>
                        );
                      })}
                      <span className="byte-ellipsis">... ({updatedUniversalVector.length} total)</span>
                    </div>
                  </div>
                  <div className="en-propagation-note">
                    <span className="note-icon">💡</span>
                    <span>This updated En becomes input to all machines on the next cycle</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
