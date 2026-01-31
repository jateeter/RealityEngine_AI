/**
 * PerceptualSpaceView - Visualization of the 256-dimensional perceptual space
 *
 * Shows active regions, machine I/O mappings, and current values
 */

import React, { useEffect, useState } from 'react';
import './PerceptualSpaceView.css';

interface PerceptualSpaceState {
  isRunning: boolean;
  currentStep: number;
  config: any;
  perceptualSpace: number[];
  machines: Array<{
    id: string;
    name: string;
    perceptualMapping: {
      input: { offset: number; length: number };
      output: { offset: number; length: number };
    };
  }>;
}

interface ActiveRegion {
  offset: number;
  length: number;
  machineId: string;
  type: 'input' | 'output';
}

export const PerceptualSpaceView: React.FC = () => {
  const [state, setState] = useState<PerceptualSpaceState | null>(null);
  const [activeRegions, setActiveRegions] = useState<ActiveRegion[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial state
  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      const response = await fetch('/api/perceptual-simulation/state');
      const result = await response.json();

      if (result.success) {
        setState(result.state);
        setError(null);
      } else {
        setError(result.error || 'Failed to load state');
      }
    } catch (err: any) {
      setError(`Error fetching state: ${err.message}`);
    }
  };

  // Listen for WebSocket updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'perceptual-simulation-stepped') {
        const step = data.step;
        setState(prev => prev ? {
          ...prev,
          currentStep: step.stepNumber,
          perceptualSpace: step.perceptualSpace
        } : null);
        setActiveRegions(step.activeRegions || []);
      } else if (data.type === 'perceptual-simulation-reset') {
        fetchState();
        setActiveRegions([]);
      }
    };

    const ws = (window as any).realityEngineWS;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => {
        ws.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  if (error) {
    return (
      <div className="perceptual-space-view error">
        <h3>Perceptual Space (En)</h3>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="perceptual-space-view loading">
        <h3>Perceptual Space (En)</h3>
        <div>Loading...</div>
      </div>
    );
  }

  // Group the 256-dimensional space into blocks of 16 for visualization
  const blockSize = 16;
  const numBlocks = Math.ceil(state.perceptualSpace.length / blockSize);

  // Helper to check if a dimension is in an active region
  const isInActiveRegion = (index: number): 'input' | 'output' | null => {
    for (const region of activeRegions) {
      if (index >= region.offset && index < region.offset + region.length) {
        return region.type;
      }
    }
    return null;
  };

  // Helper to get machine name for a region
  const getMachineForDimension = (index: number): string | null => {
    if (!state.machines) return null;

    for (const machine of state.machines) {
      const { input, output } = machine.perceptualMapping;
      if (index >= input.offset && index < input.offset + input.length) {
        return `${machine.name} (In)`;
      }
      if (index >= output.offset && index < output.offset + output.length) {
        return `${machine.name} (Out)`;
      }
    }
    return null;
  };

  return (
    <div className="perceptual-space-view">
      <div className="space-header">
        <h3>Perceptual Space (En)</h3>
        <div className="space-info">
          <span>Dimension: {state.perceptualSpace.length}</span>
          {state.isRunning && <span className="running-indicator">Running</span>}
          <span>Step: {state.currentStep}</span>
        </div>
      </div>

      <div className="space-grid">
        {Array.from({ length: numBlocks }).map((_, blockIndex) => {
          const startIdx = blockIndex * blockSize;
          const endIdx = Math.min(startIdx + blockSize, state.perceptualSpace.length);
          const blockValues = state.perceptualSpace.slice(startIdx, endIdx);

          return (
            <div key={blockIndex} className="space-block">
              <div className="block-header">
                <span>[{startIdx}:{endIdx}]</span>
              </div>
              <div className="block-cells">
                {blockValues.map((value, cellIndex) => {
                  const globalIndex = startIdx + cellIndex;
                  const activeType = isInActiveRegion(globalIndex);
                  const machineName = getMachineForDimension(globalIndex);

                  return (
                    <div
                      key={cellIndex}
                      className={`space-cell ${activeType ? `active-${activeType}` : ''}`}
                      title={`[${globalIndex}] = ${value.toFixed(2)}${machineName ? `\n${machineName}` : ''}`}
                    >
                      <div className="cell-index">{globalIndex}</div>
                      <div className="cell-value">{value.toFixed(1)}</div>
                      {machineName && (
                        <div className="cell-machine">{machineName.substring(0, 10)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-legend">
        <div className="legend-item">
          <div className="legend-box active-input"></div>
          <span>Input Region</span>
        </div>
        <div className="legend-item">
          <div className="legend-box active-output"></div>
          <span>Output Region</span>
        </div>
        <div className="legend-item">
          <div className="legend-box"></div>
          <span>Inactive</span>
        </div>
      </div>
    </div>
  );
};
