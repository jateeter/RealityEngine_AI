import React, { useState, useEffect } from 'react';
import { useVisualizerStore } from '../store';
import CriticalEventGraphView from './CriticalEventGraphView';
import InputStreamVisualization from './InputStreamVisualization';
import OutputStreamVisualization from './OutputStreamVisualization';
import { MachineInterconnectionGraph } from './MachineInterconnectionGraph';
import { UniversalInputVectorDisplay } from './UniversalInputVectorDisplay';
import { MachineInputFlowDisplay } from './MachineInputFlowDisplay';
import { GlobalCurrentVectorDisplay } from './GlobalCurrentVectorDisplay';
import { SequenceManagerModal } from './SequenceManagerModal';
import { PerceptualLogViewer } from './PerceptualLogViewer';
import { api } from '../api';

interface MachineContainerViewProps {
  selectedSequenceId: string | null;
}

const MachineContainerView: React.FC<MachineContainerViewProps> = ({ selectedSequenceId }) => {
  const {
    inputVectors,
    currentOutputVectors,
    simulationState,
    currentMachine,
    highlightedOutputId,
    machines,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    stepSimulation,
    setSimulationSpeed,
    inputQueue,
    outputQueue,
    generateAlgorithmicSequence,
    generateRandomSequence,
    clearInputQueue,
    clearOutputQueue,
    removeFromInputQueue,
    removeFromOutputQueue
  } = useVisualizerStore();

  // View toggle state - default to 'graph'
  const [viewMode, setViewMode] = useState<'graph' | 'sequences'>('graph');
  const [allMachines, setAllMachines] = useState(machines);

  // Universal Perceptual Space state
  const [currentUniversalVector, setCurrentUniversalVector] = useState<number[]>(new Array(256).fill(0));
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);

  // Machine-specific input/output state
  const [machineInput, setMachineInput] = useState<number[] | null>(null);
  const [machineOutput, setMachineOutput] = useState<number[] | null>(null);
  const [activeSequenceName, setActiveSequenceName] = useState<string | null>(null);

  // Sequence manager modal state
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false);

  // Log viewer modal state
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

  // Fetch all machines for interconnection graph
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const machinesData = await api.getMachines();
        setAllMachines(machinesData);
      } catch (error) {
        console.error('Error fetching machines:', error);
        setAllMachines(machines);
      }
    };

    fetchMachines();
  }, [machines]);

  // Listen for perceptual space updates via WebSocket
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'perceptual-simulation-stepped') {
          const step = data.step;
          if (step && step.perceptualSpace) {
            setCurrentUniversalVector(step.perceptualSpace);

            // Extract machine-specific input and output for current machine
            if (currentMachine && currentMachine.perceptualMapping) {
              const { input } = currentMachine.perceptualMapping;

              // Extract machine input from universal vector
              const extractedInput = step.perceptualSpace.slice(input.offset, input.offset + input.length);
              setMachineInput(extractedInput);

              // Get machine output from step data if available
              if (step.machineOutputs && step.machineOutputs[currentMachine.id]) {
                setMachineOutput(step.machineOutputs[currentMachine.id]);
              }

              // Set active sequence if available
              if (step.activeSequences && step.activeSequences[currentMachine.id]) {
                setActiveSequenceName(step.activeSequences[currentMachine.id]);
              }
            }
          }
        } else if (data.type === 'perceptual-simulation-reset') {
          setCurrentUniversalVector(new Array(256).fill(0));
          setMachineInput(null);
          setMachineOutput(null);
          setActiveSequenceName(null);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    const ws = (window as any).realityEngineWS;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => ws.removeEventListener('message', handleMessage);
    }
  }, [currentMachine]);

  // Determine current input vector index and state
  const currentIndex = simulationState?.currentIndex ?? 0;
  const isPlaying = simulationState?.status === 'playing';
  const isPaused = simulationState?.status === 'paused';

  // Filter outputs to show only those from current machine's sequences
  const machineSequenceIds = currentMachine?.sequenceIds || [];
  const filteredOutputs = currentOutputVectors.filter(output => {
    // Check if output has sequenceId in metadata
    if (output.metadata && typeof output.metadata === 'object' && 'sequenceId' in output.metadata) {
      return machineSequenceIds.includes(output.metadata.sequenceId as string);
    }
    // If no sequenceId metadata, include all outputs (backward compatibility)
    return true;
  });

  // Control handlers
  const handleStart = async () => {
    if (isPaused) {
      await resumeSimulation();
    } else {
      await startSimulation();
    }
  };

  const handlePause = async () => {
    await pauseSimulation();
  };

  const handleReset = async () => {
    await resetSimulation();
  };

  const handleStep = async () => {
    await stepSimulation();
  };

  const handleSpeedChange = async (delayMs: number) => {
    await setSimulationSpeed(delayMs);
  };

  // Handler for generating random universal perceptual space vectors
  const handleGenerateUniversalRandom = async (
    vectorCount: number,
    inputRegion: { offset: number; length: number }
  ) => {
    try {
      setIsGeneratingRandom(true);

      // Generate random universal vectors (256 bytes each)
      const randomVectors: number[][] = [];
      for (let i = 0; i < vectorCount; i++) {
        const vector = new Array(256).fill(0);
        // Fill only the specified input region with random values
        for (let j = inputRegion.offset; j < Math.min(inputRegion.offset + inputRegion.length, 256); j++) {
          vector[j] = Math.random();
        }
        randomVectors.push(vector);
      }

      // Configure the perceptual simulator with these vectors
      await api.configurePerceptualSimulation({
        inputSequence: randomVectors,
        inputRegion: inputRegion,
        stepDelayMs: 1000,
        maxSteps: vectorCount
      });

      // Set the first vector as current
      if (randomVectors.length > 0) {
        setCurrentUniversalVector(randomVectors[0]);
      }

      console.log(`Generated ${vectorCount} random universal vectors in region [${inputRegion.offset}:${inputRegion.offset + inputRegion.length}]`);
    } catch (error) {
      console.error('Error generating random universal vectors:', error);
    } finally {
      setIsGeneratingRandom(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0a0a',
      position: 'relative'
    }}>
      {/* Global Current Vector Display - Top */}
      <div style={{ padding: '10px 10px 0 10px' }}>
        <GlobalCurrentVectorDisplay
          currentVector={currentUniversalVector}
          currentStep={simulationState?.currentIndex || 0}
          totalSteps={inputVectors.length}
          isPlaying={isPlaying}
          onOpenSequenceManager={() => setIsSequenceModalOpen(true)}
          onOpenLogViewer={() => setIsLogViewerOpen(true)}
        />
      </div>

      {/* Main Content Row */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden'
      }}>
        {/* Input Stream - Left Side */}
        <InputStreamVisualization
        inputVectors={inputVectors}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        isPaused={isPaused}
        onStart={handleStart}
        onPause={handlePause}
        onReset={handleReset}
        onStep={handleStep}
        onSpeedChange={handleSpeedChange}
        currentSpeed={500}
      />

      {/* Machine Container - Center */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: '#0f0f0f',
        border: '3px solid #475569',
        borderRadius: '12px',
        margin: '10px',
        boxShadow: '0 0 30px rgba(59, 130, 246, 0.15), inset 0 0 50px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Machine Header */}
        <div style={{
          padding: '15px 20px',
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderBottom: '2px solid #475569',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#e2e8f0',
              marginBottom: '4px'
            }}>
              {currentMachine?.name || 'Critical Event Sequence Machine'}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {viewMode === 'graph' ? 'Machine Interconnections' : 'Internal State Visualization'}
            </div>
          </div>

          {/* View Toggle Buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginRight: '20px'
          }}>
            <button
              onClick={() => setViewMode('graph')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'graph' ? '#3b82f6' : '#334155',
                border: 'none',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: viewMode === 'graph' ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (viewMode !== 'graph') {
                  e.currentTarget.style.background = '#3f4a5c';
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== 'graph') {
                  e.currentTarget.style.background = '#334155';
                }
              }}
            >
              🔗 Interconnections
            </button>

            <button
              onClick={() => setViewMode('sequences')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'sequences' ? '#3b82f6' : '#334155',
                border: 'none',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: viewMode === 'sequences' ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (viewMode !== 'sequences') {
                  e.currentTarget.style.background = '#3f4a5c';
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== 'sequences') {
                  e.currentTarget.style.background = '#334155';
                }
              }}
            >
              📊 Sequences
            </button>
          </div>

          {/* Status Indicator */}
          {simulationState && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                fontSize: '11px',
                color: '#94a3b8',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {simulationState.status}
              </div>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: simulationState.status === 'playing'
                  ? '#22c55e'
                  : simulationState.status === 'paused'
                    ? '#f59e0b'
                    : '#64748b',
                boxShadow: simulationState.status === 'playing'
                  ? '0 0 10px rgba(34, 197, 94, 0.6)'
                  : 'none',
                animation: simulationState.status === 'playing'
                  ? 'pulse 1.5s ease-in-out infinite'
                  : 'none'
              }} />
            </div>
          )}
        </div>

        {/* Critical Event Graph - Machine Internals */}
        <div style={{
          flex: 1,
          position: 'relative',
          background: 'radial-gradient(circle at center, #0f0f0f 0%, #000 100%)',
          overflow: 'hidden'
        }}>
          {/* Decorative grid pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            pointerEvents: 'none',
            zIndex: 0
          }} />

          {/* Graph View */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '20px',
            overflowY: 'auto'
          }}>
            {viewMode === 'graph' ? (
              <>
                {/* Machine Interconnection Graph */}
                {currentMachine && (
                  <div style={{ flex: 1, minHeight: '500px' }}>
                    <MachineInterconnectionGraph
                      currentMachineId={currentMachine.id}
                      machines={allMachines}
                    />
                  </div>
                )}

                {/* Machine Input Flow Display */}
                {currentMachine && currentMachine.perceptualMapping && (
                  <MachineInputFlowDisplay
                    universalVector={currentUniversalVector}
                    inputMapping={currentMachine.perceptualMapping.input}
                    outputMapping={currentMachine.perceptualMapping.output}
                    machineInput={machineInput}
                    machineOutput={machineOutput}
                    activeSequence={activeSequenceName}
                    machineName={currentMachine.name}
                  />
                )}

                {/* Universal Input Vector Display */}
                <UniversalInputVectorDisplay
                  currentVector={currentUniversalVector}
                  vectorRegions={allMachines
                    .filter(m => m.perceptualMapping)
                    .flatMap(m => [
                      {
                        offset: m.perceptualMapping!.input.offset,
                        length: m.perceptualMapping!.input.length,
                        machineId: m.id,
                        machineName: m.name,
                        type: 'input' as const,
                        color: '#3b82f6'
                      },
                      {
                        offset: m.perceptualMapping!.output.offset,
                        length: m.perceptualMapping!.output.length,
                        machineId: m.id,
                        machineName: m.name,
                        type: 'output' as const,
                        color: '#f472b6'
                      }
                    ])}
                  onGenerateRandom={handleGenerateUniversalRandom}
                  isGenerating={isGeneratingRandom}
                />
              </>
            ) : (
              <CriticalEventGraphView selectedSequenceId={selectedSequenceId} />
            )}
          </div>
        </div>
      </div>

        {/* Output Stream - Right Side */}
        <OutputStreamVisualization
          outputVectors={filteredOutputs}
          maxVisible={10}
          highlightedOutputId={highlightedOutputId}
        />
      </div>

      {/* Sequence Manager Modal */}
      <SequenceManagerModal
        isOpen={isSequenceModalOpen}
        onClose={() => setIsSequenceModalOpen(false)}
        inputSequence={inputQueue}
        outputSequence={outputQueue}
        onGenerateAlgorithmic={(count, pattern) => {
          generateAlgorithmicSequence(pattern, count);
        }}
        onGenerateRandom={(count, region) => {
          generateRandomSequence(count, region);
        }}
        onClearInputQueue={() => {
          clearInputQueue();
        }}
        onClearOutputQueue={() => {
          clearOutputQueue();
        }}
        onRemoveInputItem={(id) => {
          removeFromInputQueue(id);
        }}
        onRemoveOutputItem={(id) => {
          removeFromOutputQueue(id);
        }}
      />

      {/* Perceptual Log Viewer */}
      <PerceptualLogViewer
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
      />

      {/* Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.9); }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MachineContainerView;
