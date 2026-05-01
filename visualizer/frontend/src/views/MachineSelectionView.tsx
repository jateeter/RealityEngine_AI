import React, { useState, useMemo, useEffect } from 'react';
import { useVisualizerStore } from '../store';
import { Machine } from '../types';
import MachineCard from '../components/MachineCard';
import MachineCreateDialog from '../components/MachineCreateDialog';
import MachineEditDialog from '../components/MachineEditDialog';
import MachineManagementModal from '../components/MachineManagementModal';
import './MachineSelectionView.css';

const MachineSelectionView: React.FC = () => {
  const { machines, setMachines, loadMachine, deleteMachine, setCurrentView } = useVisualizerStore();

  const [searchQuery,        setSearchQuery]        = useState('');
  const [filterMode,         setFilterMode]         = useState<'all' | 'examples' | 'custom'>('all');
  const [sortMode,           setSortMode]           = useState<'name' | 'recent' | 'sequences'>('recent');
  const [isLoading,          setIsLoading]          = useState(false);
  const [showCreateDialog,   setShowCreateDialog]   = useState(false);
  const [showEditDialog,     setShowEditDialog]     = useState(false);
  const [showManagementModal,setShowManagementModal]= useState(false);
  const [editingMachine,     setEditingMachine]     = useState<Machine | null>(null);

  useEffect(() => {
    const loadMachines = async () => {
      setIsLoading(true);
      try {
        const { api } = await import('../api');
        setMachines(await api.getMachines());
      } catch (error) {
        console.error('Error loading machines:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadMachines();
  }, [setMachines]);

  const filteredAndSortedMachines = useMemo(() => {
    let filtered = machines;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
      );
    }

    if (filterMode === 'examples') filtered = filtered.filter(m =>  m.isExample);
    if (filterMode === 'custom')   filtered = filtered.filter(m => !m.isExample);

    return [...filtered].sort((a, b) => {
      switch (sortMode) {
        case 'name':      return a.name.localeCompare(b.name);
        case 'recent':    return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0);
        case 'sequences': return b.sequenceCount - a.sequenceCount;
        default:          return 0;
      }
    });
  }, [machines, searchQuery, filterMode, sortMode]);

  const handleSelectMachine = async (machineId: string) => {
    setIsLoading(true);
    try { await loadMachine(machineId); }
    catch (error) { console.error('Error loading machine:', error); }
    finally { setIsLoading(false); }
  };

  const reloadMachines = async () => {
    const { api } = await import('../api');
    setMachines(await api.getMachines());
  };

  return (
    <div className="msv-root">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="msv-header">
        <div className="msv-wordmark">
          <div className="msv-title">
            Reality<span className="msv-title-accent"> Engine</span>
          </div>
          <div className="msv-subtitle">perception · sequence · visualization</div>
        </div>

        <div className="msv-header-actions">
          <input
            type="text"
            className="msv-search"
            placeholder="search machines…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />

          <button className="msv-nav-btn msv-nav-btn-interconnect" onClick={() => setCurrentView('interconnection')}>
            <span className="msv-btn-icon">⚡</span>
            Interconnect
          </button>

          <button className="msv-nav-btn msv-nav-btn-tobias" onClick={() => setCurrentView('tobias')}>
            <span className="msv-btn-icon">🔮</span>
            Tobias
          </button>

          <button className="msv-nav-btn msv-nav-btn-files" onClick={() => setShowManagementModal(true)}>
            <span className="msv-btn-icon">📦</span>
            Files
          </button>

          <button className="msv-nav-btn msv-nav-btn-create" onClick={() => setShowCreateDialog(true)}>
            <span className="msv-btn-icon">+</span>
            New Machine
          </button>
        </div>
      </header>

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="msv-toolbar">
        <div className="msv-filter-group">
          {(['all', 'examples', 'custom'] as const).map(mode => (
            <button
              key={mode}
              className={`msv-filter-btn${filterMode === mode ? ' active' : ''}`}
              onClick={() => setFilterMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="msv-sort-group">
          <span className="msv-sort-label">sort</span>
          <select
            className="msv-sort-select"
            value={sortMode}
            onChange={e => setSortMode(e.target.value as any)}
          >
            <option value="recent">last accessed</option>
            <option value="name">name</option>
            <option value="sequences">sequences</option>
          </select>
        </div>
      </div>

      {/* ── Machine Grid ─────────────────────────────────── */}
      <div className="msv-grid-wrapper">
        {isLoading ? (
          <div className="msv-state">
            <span className="msv-state-text">loading machines…</span>
          </div>
        ) : filteredAndSortedMachines.length === 0 ? (
          <div className="msv-state">
            <span className="msv-state-text">
              {searchQuery || filterMode !== 'all' ? 'no machines found' : 'no machines available'}
            </span>
            <span className="msv-state-hint">
              {searchQuery ? 'try a different search term' : 'create your first machine to get started'}
            </span>
            {filterMode === 'all' && !searchQuery && (
              <button className="msv-state-btn" onClick={() => setShowCreateDialog(true)}>
                + create machine
              </button>
            )}
          </div>
        ) : (
          <div className="msv-grid">
            {filteredAndSortedMachines.map(machine => (
              <MachineCard
                key={machine.id}
                machine={machine}
                onSelect={handleSelectMachine}
                onEdit={m => { setEditingMachine(m); setShowEditDialog(true); }}
                onDelete={async (id) => {
                  setIsLoading(true);
                  try { await deleteMachine(id); }
                  catch (e) { console.error(e); }
                  finally { setIsLoading(false); }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ───────────────────────────────────────── */}
      <MachineCreateDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={reloadMachines}
      />

      <MachineEditDialog
        machine={editingMachine}
        isOpen={showEditDialog}
        onClose={() => { setShowEditDialog(false); setEditingMachine(null); }}
        onSave={reloadMachines}
      />

      <MachineManagementModal
        isOpen={showManagementModal}
        onClose={() => { setShowManagementModal(false); reloadMachines(); }}
      />
    </div>
  );
};

export default MachineSelectionView;
