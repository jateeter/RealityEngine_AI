import React, { useState, useMemo, useEffect } from 'react';
import { useVisualizerStore } from '../store';
import { Machine } from '../types';
import MachineCard from '../components/MachineCard';
import MachineCreateDialog from '../components/MachineCreateDialog';
import MachineEditDialog from '../components/MachineEditDialog';
import MachineManagementModal from '../components/MachineManagementModal';

const MachineSelectionView: React.FC = () => {
  const {
    machines,
    setMachines,
    loadMachine,
    deleteMachine,
    setCurrentView
  } = useVisualizerStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'examples' | 'custom'>('all');
  const [sortMode, setSortMode] = useState<'name' | 'recent' | 'sequences'>('recent');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);

  // Load machines on mount
  useEffect(() => {
    const loadMachines = async () => {
      setIsLoading(true);
      try {
        const { api } = await import('../api');
        const machinesData = await api.getMachines();
        setMachines(machinesData);
      } catch (error) {
        console.error('Error loading machines:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMachines();
  }, [setMachines]);

  // Filter and sort machines
  const filteredAndSortedMachines = useMemo(() => {
    let filtered = machines;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply filter mode
    if (filterMode === 'examples') {
      filtered = filtered.filter((m) => m.isExample);
    } else if (filterMode === 'custom') {
      filtered = filtered.filter((m) => !m.isExample);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          const aTime = a.lastAccessedAt || 0;
          const bTime = b.lastAccessedAt || 0;
          return bTime - aTime;
        case 'sequences':
          return b.sequenceCount - a.sequenceCount;
        default:
          return 0;
      }
    });

    return sorted;
  }, [machines, searchQuery, filterMode, sortMode]);

  const handleSelectMachine = async (machineId: string) => {
    setIsLoading(true);
    try {
      await loadMachine(machineId);
    } catch (error) {
      console.error('Error loading machine:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMachine = (machine: Machine) => {
    setEditingMachine(machine);
    setShowEditDialog(true);
  };

  const handleDeleteMachine = async (machineId: string) => {
    setIsLoading(true);
    try {
      await deleteMachine(machineId);
    } catch (error) {
      console.error('Error deleting machine:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          height: '60px',
          background: '#0f172a',
          borderBottom: '2px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px'
        }}
      >
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#e2e8f0' }}>
          Reality Engine
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search machines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#e2e8f0',
              padding: '8px 16px',
              fontSize: '14px',
              width: '300px',
              outline: 'none'
            }}
          />

          {/* Interconnection View Button */}
          <button
            onClick={() => setCurrentView('interconnection')}
            style={{
              background: '#10b981',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#059669';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#10b981';
            }}
          >
            <span style={{ fontSize: '18px' }}>⚡</span>
            Interconnection View
          </button>

          {/* Tobias Canvas Button */}
          <button
            onClick={() => setCurrentView('tobias')}
            style={{
              background: '#7c3aed',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#6d28d9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#7c3aed';
            }}
          >
            <span style={{ fontSize: '18px' }}>🔮</span>
            Tobias
          </button>

          {/* Machine Management Button */}
          <button
            onClick={() => setShowManagementModal(true)}
            style={{
              background: '#8b5cf6',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#7c3aed';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#8b5cf6';
            }}
          >
            <span style={{ fontSize: '18px' }}>📦</span>
            Machine Files
          </button>

          {/* Create New Button */}
          <button
            onClick={() => setShowCreateDialog(true)}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2563eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#3b82f6';
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            New Machine
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          height: '50px',
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px'
        }}
      >
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'examples', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              style={{
                background: filterMode === mode ? '#3b82f6' : 'transparent',
                border: filterMode === mode ? 'none' : '1px solid #334155',
                borderRadius: '6px',
                color: filterMode === mode ? '#fff' : '#94a3b8',
                padding: '6px 16px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease'
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>Sort by:</span>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#e2e8f0',
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="recent">Last Accessed</option>
            <option value="name">Name</option>
            <option value="sequences">Sequences</option>
          </select>
        </div>
      </div>

      {/* Machine Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px'
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              fontSize: '16px',
              color: '#64748b'
            }}
          >
            Loading machines...
          </div>
        ) : filteredAndSortedMachines.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '16px'
            }}
          >
            <div style={{ fontSize: '18px', color: '#64748b' }}>
              {searchQuery || filterMode !== 'all'
                ? 'No machines found'
                : 'No machines available'}
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Create Your First Machine
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '24px',
              maxWidth: '1600px',
              margin: '0 auto'
            }}
          >
            {filteredAndSortedMachines.map((machine) => (
              <MachineCard
                key={machine.id}
                machine={machine}
                onSelect={handleSelectMachine}
                onEdit={handleEditMachine}
                onDelete={handleDeleteMachine}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <MachineCreateDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={async () => {
          // Reload machines after creation
          const { api } = await import('../api');
          const machinesData = await api.getMachines();
          setMachines(machinesData);
        }}
      />

      <MachineEditDialog
        machine={editingMachine}
        isOpen={showEditDialog}
        onClose={() => {
          setShowEditDialog(false);
          setEditingMachine(null);
        }}
        onSave={async () => {
          // Reload machines after edit
          const { api } = await import('../api');
          const machinesData = await api.getMachines();
          setMachines(machinesData);
        }}
      />

      <MachineManagementModal
        isOpen={showManagementModal}
        onClose={() => {
          setShowManagementModal(false);
          // Reload machines after management operations
          (async () => {
            const { api } = await import('../api');
            const machinesData = await api.getMachines();
            setMachines(machinesData);
          })();
        }}
      />
    </div>
  );
};

export default MachineSelectionView;
