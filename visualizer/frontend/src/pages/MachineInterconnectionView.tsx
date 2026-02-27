/**
 * MachineInterconnectionView - Main page for machine interconnection visualization
 *
 * Combines machine graph and perceptual space view to provide a complete view
 * of machine interconnection and reality flow. Simulation is driven uniformly
 * through the store's universal perception API.
 */

import React, { useEffect } from 'react';
import { useVisualizerStore } from '../store';
import { MachineGraphView } from '../components/MachineGraphView';
import { PerceptualSpaceView } from '../components/PerceptualSpaceView';
import './MachineInterconnectionView.css';

export const MachineInterconnectionView: React.FC = () => {
  const { setCurrentView, connectWebSocket, disconnectWebSocket } = useVisualizerStore();

  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  return (
    <div className="machine-interconnection-view">
      <div className="view-header">
        <div className="header-content">
          <div className="header-title">
            <button
              className="back-button"
              onClick={() => setCurrentView('selection')}
              title="Back to Machine Selection"
            >
              ← Back
            </button>
            <h1>Machine Interconnection View</h1>
          </div>
          <p className="view-description">
            Visualize machines as computational nodes connected through a shared 256-dimensional
            perceptual space (En). Watch reality vectors flow through the system as machines
            process inputs and generate outputs.
          </p>
        </div>
      </div>

      <div className="view-layout">
        <div className="left-panel">
          <div className="panel-section">
            <MachineGraphView />
          </div>

          <div className="panel-section">
            <PerceptualSpaceView />
          </div>
        </div>

        <div className="right-panel">
          <div className="panel-section info-panel">
            <h3>Architecture</h3>
            <div className="info-content">
              <h4>Perceptual Space (En)</h4>
              <p>
                The 256-dimensional shared reality representation. All machines view and modify
                portions of this space based on their perceptual mappings.
              </p>

              <h4>Machine Input (Em)</h4>
              <p>
                Each machine extracts a continuous slice of En (defined by offset + length)
                as its input vector. This is the machine's view of reality.
              </p>

              <h4>Machine Output (Ox)</h4>
              <p>
                When a machine produces output, it's merged back into En at the machine's
                output region, updating the shared perception of reality.
              </p>

              <h4>Interconnection</h4>
              <p>
                Machines connect when one's output region overlaps with another's input region,
                creating a data flow through the system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
