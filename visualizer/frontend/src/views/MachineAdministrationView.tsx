import React, { useEffect } from 'react';
import { useVisualizerStore } from '../store';
import TopNavigationBar from '../components/TopNavigationBar';
import MachineContainerView from '../components/MachineContainerView';
import FloatingControlPanel from '../components/FloatingControlPanel';

interface MachineAdministrationViewProps {
  machineId: string;
  onNavigateBack: () => void;
}

const MachineAdministrationView: React.FC<MachineAdministrationViewProps> = ({
  onNavigateBack
}) => {
  const { currentMachine, connectWebSocket, disconnectWebSocket } = useVisualizerStore();

  // Connect WebSocket when component mounts for real-time updates
  useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, [connectWebSocket, disconnectWebSocket]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <TopNavigationBar
        currentMachine={currentMachine}
        onNavigateBack={onNavigateBack}
      />

      {/* Main Content: Machine View with Input/Output Streams */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MachineContainerView selectedSequenceId={null} />

        {/* Floating Control Panel */}
        <FloatingControlPanel machine={currentMachine} />
      </div>
    </div>
  );
};

export default MachineAdministrationView;
