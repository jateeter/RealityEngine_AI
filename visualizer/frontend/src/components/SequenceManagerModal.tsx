import React, { useState } from 'react';
import './SequenceManagerModal.css';
import { VectorSequenceItem } from '../types';

interface SequenceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Input sequence (FIFO queue)
  inputSequence: VectorSequenceItem[];
  // Output sequence (FIFO queue)
  outputSequence: VectorSequenceItem[];
  // Callbacks
  onGenerateAlgorithmic: (count: number, pattern: string) => void;
  onGenerateRandom: (count: number, region: { offset: number; length: number }) => void;
  onClearInputQueue: () => void;
  onClearOutputQueue: () => void;
  onRemoveInputItem: (id: string) => void;
  onRemoveOutputItem: (id: string) => void;
  onLoadIntoSimulation: () => void;
}

export const SequenceManagerModal: React.FC<SequenceManagerModalProps> = ({
  isOpen,
  onClose,
  inputSequence,
  outputSequence,
  onGenerateAlgorithmic,
  onGenerateRandom,
  onClearInputQueue,
  onClearOutputQueue,
  onRemoveInputItem,
  onRemoveOutputItem,
  onLoadIntoSimulation
}) => {
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'generate'>('input');
  const [generateMode, setGenerateMode] = useState<'algorithmic' | 'random'>('algorithmic');

  // Algorithmic generation params
  const [algPattern, setAlgPattern] = useState('sine-wave');
  const [algCount, setAlgCount] = useState(100);

  // Random generation params
  const [randCount, setRandCount] = useState(100);
  const [randOffset, setRandOffset] = useState(0);
  const [randLength, setRandLength] = useState(16);

  if (!isOpen) return null;

  const formatVector = (vec: number[], maxDisplay: number = 8) => {
    if (vec.length <= maxDisplay) {
      return `[${vec.map(v => v.toFixed(2)).join(', ')}]`;
    }
    const shown = vec.slice(0, maxDisplay).map(v => v.toFixed(2)).join(', ');
    return `[${shown}, ... (${vec.length} total)]`;
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString();
  };

  const getSourceBadge = (source: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      algorithmic: { label: 'Algorithmic', className: 'source-algorithmic' },
      random: { label: 'Random', className: 'source-random' },
      manual: { label: 'Manual', className: 'source-manual' },
      override: { label: 'Override', className: 'source-override' }
    };
    return badges[source] || { label: source, className: 'source-unknown' };
  };

  return (
    <div className="sequence-manager-modal-overlay" onClick={onClose}>
      <div className="sequence-manager-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <span className="modal-icon">📑</span>
            <div className="modal-title-text">
              <h2>Input/Output Sequence Manager</h2>
              <p>Manage FIFO queues for universal perceptual input and machine output vectors</p>
            </div>
          </div>
          <button className="modal-close-button" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs">
          <button
            className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            <span className="tab-icon">📥</span>
            <span className="tab-label">Input Queue</span>
            <span className="tab-badge">{inputSequence.length}</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'output' ? 'active' : ''}`}
            onClick={() => setActiveTab('output')}
          >
            <span className="tab-icon">📤</span>
            <span className="tab-label">Output Queue</span>
            <span className="tab-badge">{outputSequence.length}</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Generate</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Input Queue Tab */}
          {activeTab === 'input' && (
            <div className="tab-content">
              <div className="queue-header">
                <div className="queue-info">
                  <h3>Input Queue (FIFO)</h3>
                  <p>Vectors waiting to be processed by the simulation. First in, first out.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="action-button primary"
                    onClick={() => { onLoadIntoSimulation(); onClose(); }}
                    disabled={inputSequence.length === 0}
                    title="Load all queued vectors into the simulation"
                  >
                    ▶ Load into Simulation
                  </button>
                  <button
                    className="action-button danger"
                    onClick={onClearInputQueue}
                    disabled={inputSequence.length === 0}
                  >
                    🗑️ Clear Queue
                  </button>
                </div>
              </div>

              <div className="queue-list">
                {inputSequence.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p>Input queue is empty</p>
                    <p className="empty-hint">Use the Generate tab to create input vectors</p>
                  </div>
                ) : (
                  inputSequence.map((item, index) => {
                    const sourceInfo = getSourceBadge(item.source);
                    const isNext = index === 0;

                    return (
                      <div key={item.id} className={`queue-item ${isNext ? 'next-item' : ''}`}>
                        <div className="item-header">
                          <span className="item-position">#{index + 1}</span>
                          {isNext && <span className="next-badge">▶ NEXT</span>}
                          <span className={`source-badge ${sourceInfo.className}`}>
                            {sourceInfo.label}
                          </span>
                          <span className="item-timestamp">{formatTimestamp(item.timestamp)}</span>
                          <button
                            className="item-remove"
                            onClick={() => onRemoveInputItem(item.id)}
                            title="Remove from queue"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="item-vector">
                          <span className="vector-label">Vector:</span>
                          <code className="vector-code">{formatVector(item.vector, 10)}</code>
                        </div>
                        {item.metadata && (
                          <div className="item-metadata">
                            <span className="metadata-label">Metadata:</span>
                            <code className="metadata-code">
                              {JSON.stringify(item.metadata)}
                            </code>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Output Queue Tab */}
          {activeTab === 'output' && (
            <div className="tab-content">
              <div className="queue-header">
                <div className="queue-info">
                  <h3>Output Queue (FIFO)</h3>
                  <p>Vectors produced by machines during simulation. Historical record.</p>
                </div>
                <button
                  className="action-button danger"
                  onClick={onClearOutputQueue}
                  disabled={outputSequence.length === 0}
                >
                  🗑️ Clear Queue
                </button>
              </div>

              <div className="queue-list">
                {outputSequence.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p>Output queue is empty</p>
                    <p className="empty-hint">Run simulation to generate outputs</p>
                  </div>
                ) : (
                  outputSequence.map((item, index) => {
                    const sourceInfo = getSourceBadge(item.source);
                    const isLatest = index === outputSequence.length - 1;

                    return (
                      <div key={item.id} className={`queue-item ${isLatest ? 'latest-item' : ''}`}>
                        <div className="item-header">
                          <span className="item-position">#{index + 1}</span>
                          {isLatest && <span className="latest-badge">✨ LATEST</span>}
                          <span className={`source-badge ${sourceInfo.className}`}>
                            {sourceInfo.label}
                          </span>
                          <span className="item-timestamp">{formatTimestamp(item.timestamp)}</span>
                          <button
                            className="item-remove"
                            onClick={() => onRemoveOutputItem(item.id)}
                            title="Remove from queue"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="item-vector">
                          <span className="vector-label">Vector:</span>
                          <code className="vector-code">{formatVector(item.vector, 10)}</code>
                        </div>
                        {item.metadata && (
                          <div className="item-metadata">
                            <span className="metadata-label">Machine:</span>
                            <code className="metadata-code">
                              {item.metadata.machineName || 'Unknown'}
                            </code>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="tab-content">
              <div className="generate-section">
                <h3>Generate Input Vectors</h3>
                <p>Create universal perceptual input vectors using algorithmic patterns or random generation.</p>

                {/* Mode Selection */}
                <div className="mode-selector">
                  <button
                    className={`mode-button ${generateMode === 'algorithmic' ? 'active' : ''}`}
                    onClick={() => setGenerateMode('algorithmic')}
                  >
                    <span className="mode-icon">🔢</span>
                    <span className="mode-label">Algorithmic</span>
                  </button>
                  <button
                    className={`mode-button ${generateMode === 'random' ? 'active' : ''}`}
                    onClick={() => setGenerateMode('random')}
                  >
                    <span className="mode-icon">🎲</span>
                    <span className="mode-label">Random</span>
                  </button>
                </div>

                {/* Algorithmic Generation */}
                {generateMode === 'algorithmic' && (
                  <div className="generation-form">
                    <div className="form-group">
                      <label>Pattern Type</label>
                      <select
                        value={algPattern}
                        onChange={(e) => setAlgPattern(e.target.value)}
                        className="form-select"
                      >
                        <option value="sine-wave">Sine Wave</option>
                        <option value="square-wave">Square Wave</option>
                        <option value="sawtooth">Sawtooth</option>
                        <option value="perlin-noise">Perlin Noise</option>
                        <option value="fibonacci">Fibonacci Sequence</option>
                        <option value="linear-ramp">Linear Ramp</option>
                        <option value="exponential">Exponential</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Vector Count</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={algCount}
                        onChange={(e) => setAlgCount(Number(e.target.value))}
                        className="form-input"
                      />
                    </div>

                    <button
                      className="action-button primary generate-button"
                      onClick={() => onGenerateAlgorithmic(algCount, algPattern)}
                    >
                      ⚙️ Generate Algorithmic Sequence
                    </button>

                    <div className="pattern-preview">
                      <strong>Pattern Description:</strong>
                      {algPattern === 'sine-wave' && <p>Generates smooth sinusoidal waves across vector dimensions</p>}
                      {algPattern === 'square-wave' && <p>Generates binary square wave patterns (0 or 1)</p>}
                      {algPattern === 'sawtooth' && <p>Generates linearly increasing ramp patterns</p>}
                      {algPattern === 'perlin-noise' && <p>Generates smooth, organic noise patterns</p>}
                      {algPattern === 'fibonacci' && <p>Generates sequences following Fibonacci ratios</p>}
                      {algPattern === 'linear-ramp' && <p>Generates linear gradient from 0 to 1</p>}
                      {algPattern === 'exponential' && <p>Generates exponential growth patterns</p>}
                    </div>
                  </div>
                )}

                {/* Random Generation */}
                {generateMode === 'random' && (
                  <div className="generation-form">
                    <div className="form-group">
                      <label>Vector Count</label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={randCount}
                        onChange={(e) => setRandCount(Number(e.target.value))}
                        className="form-input"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Region Offset</label>
                        <input
                          type="number"
                          min="0"
                          max="255"
                          value={randOffset}
                          onChange={(e) => setRandOffset(Number(e.target.value))}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Region Length</label>
                        <input
                          type="number"
                          min="1"
                          max={256 - randOffset}
                          value={randLength}
                          onChange={(e) => setRandLength(Number(e.target.value))}
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="form-info">
                      Target Region: <code>[{randOffset}:{randOffset + randLength}]</code>
                    </div>

                    <button
                      className="action-button primary generate-button"
                      onClick={() => onGenerateRandom(randCount, { offset: randOffset, length: randLength })}
                    >
                      🎲 Generate Random Sequence
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
