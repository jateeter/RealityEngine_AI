import React, { useEffect, useRef } from 'react';
import { useVisualizerStore } from '../store';
import SimulationControls from './SimulationControls';
import InputTimeline from './InputTimeline';
import SequenceGraph from './SequenceGraph';
import ActivityFeed from './ActivityFeed';
import HeatmapOverlay from './HeatmapOverlay';
import ManualInputPanel from './ManualInputPanel';

const DemoDashboard: React.FC = () => {
  const {
    sequences,
    selectedSequenceId,
    simulationState,
    inputVectors,
    connectWebSocket,
    disconnectWebSocket,
    refreshSimulationState,
    isConnected
  } = useVisualizerStore();

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  // Poll simulation state when playing
  useEffect(() => {
    if (simulationState?.status === 'playing') {
      // Poll every 500ms during playback
      pollIntervalRef.current = setInterval(() => {
        refreshSimulationState();
      }, 500);
    } else {
      // Clear interval when not playing
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [simulationState?.status, refreshSimulationState]);

  const selectedSequence = sequences.find(s => s.sequenceId === selectedSequenceId);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Simulation Controls (Top Bar) */}
      <SimulationControls />

      {/* Input Timeline (Horizontal Strip) */}
      <InputTimeline height={100} />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sequence Graph (Left/Center) */}
        <div className="flex-1 relative">
          {selectedSequence ? (
            <>
              <SequenceGraph sequence={selectedSequence} />
              <HeatmapOverlay />
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-900">
              <div className="text-center space-y-4 max-w-md p-8">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold text-white">Welcome to Reality Engine Demo</h2>
                <p className="text-gray-400">
                  This demonstration showcases 30 independent sequences with 100 input vectors.
                </p>
                <div className="space-y-2 pt-4">
                  {!inputVectors.length && (
                    <div className="text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-700 rounded px-4 py-3">
                      ⚠ No simulation data loaded. Use the Load Demo button to begin.
                    </div>
                  )}
                  {sequences.length > 0 && (
                    <div className="text-sm text-blue-400 bg-blue-900/20 border border-blue-700 rounded px-4 py-3">
                      ℹ Select a sequence from the sidebar to visualize its graph
                    </div>
                  )}
                  {!isConnected && (
                    <div className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded px-4 py-3">
                      ⚠ WebSocket disconnected. Real-time updates unavailable.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-96 flex flex-col overflow-hidden">
          {/* Manual Input Panel */}
          <div className="p-4 border-b border-gray-700">
            <ManualInputPanel />
          </div>

          {/* Activity Feed */}
          <div className="flex-1 overflow-hidden">
            <ActivityFeed />
          </div>
        </div>
      </div>

      {/* Footer Stats Bar */}
      <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-gray-500">Sequences:</span>
            <span className="text-white ml-2 font-semibold">{sequences.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Input Vectors:</span>
            <span className="text-white ml-2 font-semibold">{inputVectors.length}</span>
          </div>
          {simulationState && (
            <div>
              <span className="text-gray-500">Progress:</span>
              <span className="text-white ml-2 font-semibold">
                {simulationState.currentIndex} / {simulationState.totalVectors}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoDashboard;
