import { useEffect, useState, useCallback } from 'react';
import { useVisualizerStore } from './store';
import { api } from './api';
import Sidebar from './components/Sidebar';
import SequenceGraph from './components/SequenceGraph';
import InfoPanel from './components/InfoPanel';
import DemoDashboard from './components/DemoDashboard';
import { VectorNode } from './types';

function App() {
  const {
    sequences,
    selectedSequenceId,
    stats,
    isConnected,
    autoRefresh,
    refreshInterval,
    setSequences,
    setSelectedSequence,
    setStats,
    setConnected,
    loadDemo,
    loadDataCenterExample
  } = useVisualizerStore();

  const [selectedNode, setSelectedNode] = useState<VectorNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch sequences and stats in parallel
      const [sequencesData, statsData] = await Promise.all([
        api.getSequences(),
        api.getStats()
      ]);

      setSequences(sequencesData);
      setStats(statsData);
      setConnected(true);

      // Auto-select first sequence if none selected
      if (!selectedSequenceId && sequencesData.length > 0) {
        setSelectedSequence(sequencesData[0].sequenceId);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
      setConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSequenceId, setSequences, setStats, setConnected, setSelectedSequence]);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadData]);

  // Handle sequence selection
  const handleSequenceSelect = useCallback(
    (id: string) => {
      setSelectedSequence(id);
      setSelectedNode(null); // Clear node selection when switching sequences
    },
    [setSelectedSequence]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const sequence = sequences.find((s) => s.sequenceId === selectedSequenceId);
      if (!sequence) return;

      const node = sequence.nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
      }
    },
    [sequences, selectedSequenceId]
  );

  // Handle demo load
  const handleLoadDemo = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadDemo();
      setIsDemoMode(true);
      await loadData(); // Refresh sequences after demo load
    } catch (err: any) {
      console.error('Error loading demo:', err);
      setError(err.message || 'Failed to load demo');
    } finally {
      setIsLoading(false);
    }
  }, [loadDemo, loadData]);

  // Handle data center example load
  const handleLoadDataCenter = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadDataCenterExample();
      setIsDemoMode(true);
      await loadData(); // Refresh sequences after example load
    } catch (err: any) {
      console.error('Error loading data center example:', err);
      setError(err.message || 'Failed to load data center example');
    } finally {
      setIsLoading(false);
    }
  }, [loadDataCenterExample, loadData]);

  // Get selected sequence
  const selectedSequence = sequences.find((s) => s.sequenceId === selectedSequenceId);

  // If in demo mode, render the demo dashboard
  if (isDemoMode) {
    return <DemoDashboard />;
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a0a' }}>
      {/* Sidebar */}
      <Sidebar
        sequences={sequences}
        selectedSequenceId={selectedSequenceId}
        stats={stats}
        onSequenceSelect={handleSequenceSelect}
        onRefresh={loadData}
        onLoadDemo={handleLoadDemo}
        onLoadDataCenter={handleLoadDataCenter}
        isConnected={isConnected}
      />

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Loading overlay */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.9)',
              padding: '20px 40px',
              borderRadius: '8px',
              border: '1px solid #333'
            }}
          >
            <div style={{ fontSize: '16px', color: '#888' }}>Loading...</div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: '#7f1d1d',
              color: '#fecaca',
              padding: '12px 24px',
              borderRadius: '8px',
              border: '1px solid #991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fecaca',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0',
                width: '20px',
                height: '20px'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Sequence name header */}
        {selectedSequence && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              zIndex: 100,
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '12px 20px',
              borderRadius: '8px',
              border: '1px solid #333'
            }}
          >
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
              Sequence
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {selectedSequence.sequenceName}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                marginTop: '4px',
                fontFamily: 'monospace'
              }}
            >
              {selectedSequence.sequenceId}
            </div>
          </div>
        )}

        {/* Sequence graph */}
        {selectedSequence ? (
          <SequenceGraph sequence={selectedSequence} onNodeClick={handleNodeClick} />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '18px'
            }}
          >
            {sequences.length === 0
              ? 'No sequences available'
              : 'Select a sequence from the sidebar'}
          </div>
        )}

        {/* Info panel */}
        <InfoPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      </div>
    </div>
  );
}

export default App;
