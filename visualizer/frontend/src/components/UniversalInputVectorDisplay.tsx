/**
 * UniversalInputVectorDisplay - Shows the 256-element universal perceptual input space
 * with highlighting for machine input/output regions and random generation
 */

import React, { useState } from 'react';
import './UniversalInputVectorDisplay.css';

interface VectorRegion {
  offset: number;
  length: number;
  machineId: string;
  machineName: string;
  type: 'input' | 'output';
  color: string;
}

interface UniversalInputVectorDisplayProps {
  currentVector: number[];
  vectorRegions: VectorRegion[];
  onGenerateRandom: (vectorCount: number, inputRegion: { offset: number; length: number }) => void;
  isGenerating: boolean;
}

export const UniversalInputVectorDisplay: React.FC<UniversalInputVectorDisplayProps> = ({
  currentVector,
  vectorRegions,
  onGenerateRandom,
  isGenerating
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [vectorCount, setVectorCount] = useState(100);
  const [inputOffset, setInputOffset] = useState(0);
  const [inputLength, setInputLength] = useState(16);

  const handleGenerate = () => {
    onGenerateRandom(vectorCount, { offset: inputOffset, length: inputLength });
    setShowConfig(false);
  };

  // Group bytes into chunks of 16 for display
  const bytesPerRow = 16;
  const rows = Math.ceil(256 / bytesPerRow);

  // Find which region(s) a byte belongs to
  const getByteRegions = (index: number): VectorRegion[] => {
    return vectorRegions.filter(region =>
      index >= region.offset && index < region.offset + region.length
    );
  };

  // Get background color for a byte based on its regions
  const getByteColor = (index: number): string => {
    const regions = getByteRegions(index);
    if (regions.length === 0) return '#1e293b';

    // Prioritize output regions (they overwrite)
    const outputRegion = regions.find(r => r.type === 'output');
    if (outputRegion) return outputRegion.color + '30'; // With opacity

    return regions[0].color + '20';
  };

  // Get border color for a byte
  const getByteBorder = (index: number): string => {
    const regions = getByteRegions(index);
    if (regions.length === 0) return '#334155';

    const outputRegion = regions.find(r => r.type === 'output');
    if (outputRegion) return outputRegion.color;

    return regions[0].color;
  };

  return (
    <div className="universal-input-vector-display">
      {/* Header */}
      <div className="vector-header">
        <div className="vector-title">
          <span className="vector-icon">🌐</span>
          Universal Perceptual Space (En)
        </div>
        <div className="vector-dimension">256 bytes</div>
      </div>

      {/* Random Generator Control */}
      <div className="random-generator-control">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`generator-toggle ${showConfig ? 'active' : ''}`}
          disabled={isGenerating}
        >
          <span className="generator-icon">🎲</span>
          Random Stream Generator
          {isGenerating && <span className="generating-spinner">⚡</span>}
        </button>

        {showConfig && (
          <div className="generator-config">
            <div className="config-row">
              <label>
                Vector Count
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={vectorCount}
                  onChange={(e) => setVectorCount(Number(e.target.value))}
                  className="config-input"
                />
              </label>
            </div>

            <div className="config-row">
              <label>
                Input Region Offset
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={inputOffset}
                  onChange={(e) => setInputOffset(Math.max(0, Math.min(255, Number(e.target.value))))}
                  className="config-input"
                />
              </label>
            </div>

            <div className="config-row">
              <label>
                Input Region Length
                <input
                  type="number"
                  min="1"
                  max={256 - inputOffset}
                  value={inputLength}
                  onChange={(e) => setInputLength(Math.max(1, Math.min(256 - inputOffset, Number(e.target.value))))}
                  className="config-input"
                />
              </label>
            </div>

            <div className="config-info">
              <span className="info-label">Target Region:</span>
              <span className="info-value">[{inputOffset}:{inputOffset + inputLength}]</span>
            </div>

            <button
              onClick={handleGenerate}
              className="generate-button"
              disabled={isGenerating}
            >
              Generate Stream
            </button>

            <div className="config-note">
              Random values generated in target region. Machine outputs will overwrite at their designated offsets.
            </div>
          </div>
        )}
      </div>

      {/* Vector Display Grid */}
      <div className="vector-grid">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="vector-row">
            {/* Row offset label */}
            <div className="row-label">{(rowIndex * bytesPerRow).toString(16).padStart(2, '0').toUpperCase()}</div>

            {/* Bytes in this row */}
            <div className="row-bytes">
              {Array.from({ length: bytesPerRow }).map((_, colIndex) => {
                const byteIndex = rowIndex * bytesPerRow + colIndex;
                if (byteIndex >= 256) return null;

                const value = currentVector[byteIndex] || 0;
                const regions = getByteRegions(byteIndex);
                const hasValue = value !== 0;

                return (
                  <div
                    key={byteIndex}
                    className={`byte-cell ${hasValue ? 'has-value' : ''}`}
                    style={{
                      backgroundColor: getByteColor(byteIndex),
                      borderColor: getByteBorder(byteIndex)
                    }}
                    title={`[${byteIndex}] = ${value.toFixed(2)}${regions.length > 0 ? '\n' + regions.map(r => `${r.machineName} ${r.type}`).join(', ') : ''}`}
                  >
                    <div className="byte-value">
                      {value.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="vector-legend">
        <div className="legend-title">Region Map</div>
        <div className="legend-items">
          {vectorRegions.length === 0 ? (
            <div className="legend-item empty">
              <span className="legend-box" style={{ borderColor: '#334155', backgroundColor: '#1e293b' }}></span>
              <span className="legend-text">No machine regions defined</span>
            </div>
          ) : (
            vectorRegions.map((region, idx) => (
              <div key={idx} className="legend-item">
                <span
                  className="legend-box"
                  style={{
                    borderColor: region.color,
                    backgroundColor: region.color + '30'
                  }}
                ></span>
                <span className="legend-text">
                  {region.machineName} {region.type === 'output' ? '→' : '←'} [{region.offset}:{region.offset + region.length}]
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
