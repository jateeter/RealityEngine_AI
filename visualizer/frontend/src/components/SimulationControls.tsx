import React, { useEffect, useState } from 'react';
import { useVisualizerStore } from '../store';

const SimulationControls: React.FC = () => {
  const {
    simulationState,
    simulationProgress,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
    resetSimulation,
    stepSimulation,
    setSimulationSpeed,
    loadSimulation,
    inputVectors
  } = useVisualizerStore();

  const [speed, setSpeed] = useState(1000);
  const [elapsedTime, setElapsedTime] = useState(0);

  const isPlaying = simulationState?.status === 'playing';
  const isPaused = simulationState?.status === 'paused';
  const isStopped = simulationState?.status === 'stopped' || !simulationState;

  // Update elapsed time
  useEffect(() => {
    if (!simulationState?.startTime) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      if (isPlaying) {
        setElapsedTime(Date.now() - simulationState.startTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [simulationState, isPlaying]);

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pauseSimulation();
    } else if (isPaused) {
      await resumeSimulation();
    } else {
      await startSimulation();
    }
  };

  const handleStop = async () => {
    await stopSimulation();
    setElapsedTime(0);
  };

  const handleReset = async () => {
    await resetSimulation();
    setElapsedTime(0);
  };

  const handleStep = async () => {
    await stepSimulation();
  };

  const handleSpeedChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseInt(e.target.value);
    setSpeed(newSpeed);
    await setSimulationSpeed(newSpeed);
  };

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  const getStatusColor = (): string => {
    if (isPlaying) return 'text-green-500';
    if (isPaused) return 'text-yellow-500';
    return 'text-gray-500';
  };

  const getStatusText = (): string => {
    if (isPlaying) return 'Playing';
    if (isPaused) return 'Paused';
    return 'Stopped';
  };

  const currentIndex = simulationState?.currentIndex ?? 0;
  const totalVectors = simulationState?.totalVectors ?? inputVectors.length;
  const progressPercent = totalVectors > 0 ? (currentIndex / totalVectors) * 100 : 0;

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between gap-4">
        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={!inputVectors.length}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <span>❚❚ Pause</span>
            ) : (
              <span>▶ {isPaused ? 'Resume' : 'Play'}</span>
            )}
          </button>

          <button
            onClick={handleStop}
            disabled={isStopped}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Stop"
          >
            ■ Stop
          </button>

          <button
            onClick={handleReset}
            disabled={isStopped && currentIndex === 0}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Reset"
          >
            ↻ Reset
          </button>

          <button
            onClick={handleStep}
            disabled={isPlaying || currentIndex >= totalVectors}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Step Forward"
          >
            ⏭ Step
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-1">
            <span>Vector {currentIndex} / {totalVectors}</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-500 h-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Speed Control */}
        <div className="flex flex-col items-end gap-1 min-w-[200px]">
          <div className="flex items-center gap-2 w-full">
            <label className="text-sm text-gray-400 whitespace-nowrap">Speed:</label>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={speed}
              onChange={handleSpeedChange}
              className="flex-1"
              title="Adjust playback speed"
            />
            <span className="text-sm text-gray-300 w-12 text-right">{formatSpeed(speed)}</span>
          </div>
        </div>

        {/* Status & Time */}
        <div className="flex flex-col items-end text-sm">
          <div className={`font-semibold ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          <div className="text-gray-400">
            {formatTime(elapsedTime)}
          </div>
        </div>
      </div>

      {/* No Vectors Warning */}
      {!inputVectors.length && (
        <div className="mt-3 text-sm text-yellow-400 bg-yellow-900/20 border border-yellow-700 rounded px-3 py-2">
          ⚠ No input vectors loaded. Load simulation data to begin.
        </div>
      )}
    </div>
  );
};

export default SimulationControls;
