import React from 'react';
import { useVisualizerStore } from '../store';
import { Machine } from '../types';
import OverviewTab from './ControlPanelTabs/OverviewTab';
import SimulationTab from './ControlPanelTabs/SimulationTab';
import SequencesTab from './ControlPanelTabs/SequencesTab';
import SettingsTab from './ControlPanelTabs/SettingsTab';

interface FloatingControlPanelProps {
  machine: Machine | null;
}

const FloatingControlPanel: React.FC<FloatingControlPanelProps> = ({ machine }) => {
  const {
    isFloatingPanelExpanded,
    floatingPanelActiveTab,
    toggleFloatingPanel,
    setFloatingPanelTab
  } = useVisualizerStore();

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: '📊' },
    { id: 'simulation' as const, label: 'Simulation', icon: '▶' },
    { id: 'sequences' as const, label: 'Sequences', icon: '🔗' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙' }
  ];

  const renderTabContent = () => {
    switch (floatingPanelActiveTab) {
      case 'overview':
        return <OverviewTab machine={machine} />;
      case 'simulation':
        return <SimulationTab machine={machine} />;
      case 'sequences':
        return <SequencesTab machine={machine} />;
      case 'settings':
        return <SettingsTab machine={machine} />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '400px',
        height: isFloatingPanelExpanded ? '500px' : '60px',
        background: 'rgba(15, 15, 15, 0.95)',
        border: '2px solid #3b82f6',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '60px',
          borderBottom: isFloatingPanelExpanded ? '1px solid #1e293b' : 'none',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          flexShrink: 0
        }}
      >
        {/* Tabs */}
        <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFloatingPanelTab(tab.id)}
              style={{
                background: floatingPanelActiveTab === tab.id ? '#3b82f6' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: floatingPanelActiveTab === tab.id ? '#fff' : '#94a3b8',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                opacity: isFloatingPanelExpanded ? 1 : 0,
                pointerEvents: isFloatingPanelExpanded ? 'auto' : 'none'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Collapse/Expand Button */}
        <button
          onClick={toggleFloatingPanel}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '6px',
            color: '#94a3b8',
            padding: '8px 12px',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            marginLeft: '8px'
          }}
          title={isFloatingPanelExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          {isFloatingPanelExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* Tab Content */}
      {isFloatingPanelExpanded && (
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {renderTabContent()}
        </div>
      )}

      {/* Collapsed State Label */}
      {!isFloatingPanelExpanded && (
        <div
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '14px',
            fontWeight: '600',
            color: '#e2e8f0',
            pointerEvents: 'none'
          }}
        >
          {machine ? machine.name : 'Control Panel'}
        </div>
      )}
    </div>
  );
};

export default FloatingControlPanel;
