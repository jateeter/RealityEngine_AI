import React from 'react';
import { useVisualizerStore } from '../../store';
import { Machine } from '../../types';

interface SimulationTabProps {
  machine: Machine | null;
}

const SimulationTab: React.FC<SimulationTabProps> = ({ machine }) => {
  const {
    simulationState,
    inputVectors,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
    resetSimulation,
    stepSimulation,
    setSimulationSpeed
  } = useVisualizerStore();

  if (!machine) {
    return (
      <div style={{ padding: '20px', color: '#64748b', textAlign: 'center' }}>
        No machine selected
      </div>
    );
  }

  const isPlaying = simulationState?.status === 'playing';
  const isPaused = simulationState?.status === 'paused';
  const isStopped = simulationState?.status === 'stopped';
  const hasVectors = inputVectors.length > 0;

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      {/* Simulation Status */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Status
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: isPlaying ? '#22c55e' : isPaused ? '#f59e0b' : '#64748b',
              boxShadow: isPlaying ? '0 0 8px rgba(34, 197, 94, 0.6)' : 'none'
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', textTransform: 'capitalize' }}>
              {simulationState?.status || 'Stopped'}
            </div>
            {simulationState && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Vector {simulationState.currentIndex} / {simulationState.totalVectors}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playback Controls */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Controls
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Play/Pause Button */}
          {!isPlaying ? (
            <button
              onClick={() => isPaused ? resumeSimulation() : startSimulation()}
              disabled={!hasVectors}
              style={{
                background: '#22c55e',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: hasVectors ? 'pointer' : 'not-allowed',
                opacity: hasVectors ? 1 : 0.5,
                transition: 'all 0.2s ease'
              }}
            >
              {isPaused ? '▶ Resume' : '▶ Play'}
            </button>
          ) : (
            <button
              onClick={pauseSimulation}
              style={{
                background: '#f59e0b',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '12px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ⏸ Pause
            </button>
          )}

          {/* Stop Button */}
          <button
            onClick={stopSimulation}
            disabled={isStopped}
            style={{
              background: '#dc2626',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '12px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isStopped ? 'not-allowed' : 'pointer',
              opacity: isStopped ? 0.5 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            ⏹ Stop
          </button>

          {/* Step Button */}
          <button
            onClick={stepSimulation}
            disabled={isPlaying || !hasVectors}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '12px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: (!isPlaying && hasVectors) ? 'pointer' : 'not-allowed',
              opacity: (!isPlaying && hasVectors) ? 1 : 0.5,
              transition: 'all 0.2s ease'
            }}
          >
            ⏭ Step
          </button>

          {/* Reset Button */}
          <button
            onClick={resetSimulation}
            disabled={!hasVectors}
            style={{
              background: '#64748b',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '12px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: hasVectors ? 'pointer' : 'not-allowed',
              opacity: hasVectors ? 1 : 0.5,
              transition: 'all 0.2s ease'
            }}
          >
            ↻ Reset
          </button>
        </div>
      </div>

      {/* Speed Control */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
          Playback Speed
        </div>
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[100, 500, 1000, 2000].map((speed) => (
              <button
                key={speed}
                onClick={() => setSimulationSpeed(speed)}
                style={{
                  flex: 1,
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#cbd5e1',
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {speed}ms
              </button>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
            Delay between vectors
          </div>
        </div>
      </div>

      {/* Progress Info */}
      {hasVectors && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
            Input Vectors
          </div>
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              padding: '16px'
            }}
          >
            <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>
              Total: <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{inputVectors.length}</span> vectors
            </div>
            {simulationState && (
              <>
                <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '12px' }}>
                  Current: <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{simulationState.currentIndex}</span> / {simulationState.totalVectors}
                </div>
                {/* Progress Bar */}
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: '#1e293b',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: `${(simulationState.currentIndex / simulationState.totalVectors) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationTab;
