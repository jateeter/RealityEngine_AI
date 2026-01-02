import React from 'react';
import { useVisualizerStore } from '../store';
import TopNavigationBar from '../components/TopNavigationBar';
import CriticalEventGraphView from '../components/CriticalEventGraphView';
import FloatingControlPanel from '../components/FloatingControlPanel';

interface MachineAdministrationViewProps {
  machineId: string;
  onNavigateBack: () => void;
}

const MachineAdministrationView: React.FC<MachineAdministrationViewProps> = ({
  onNavigateBack
}) => {
  const { currentMachine } = useVisualizerStore();

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <TopNavigationBar
        currentMachine={currentMachine}
        onNavigateBack={onNavigateBack}
      />

      {/* Main Content: Full-Screen Graph View */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <CriticalEventGraphView selectedSequenceId={null} />

        {/* Floating Control Panel */}
        <FloatingControlPanel machine={currentMachine} />
      </div>
    </div>
  );
};

export default MachineAdministrationView;
