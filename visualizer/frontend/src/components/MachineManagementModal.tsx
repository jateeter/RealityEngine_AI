import React, { useState, useEffect } from 'react';
import { useVisualizerStore } from '../store';
import { X, FolderOpen, Upload, Download, FileJson, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { MachineGraphView } from './MachineGraphView';

interface MachineJSONFile {
  filename: string;
  name: string;
  description: string;
  version: string;
  metadata: any;
  sequenceCount: number;
}

interface MachineManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'browse' | 'import' | 'export';

const MachineManagementModal: React.FC<MachineManagementModalProps> = ({ isOpen, onClose }) => {
  const {
    machines,
    currentMachine,
    listMachineJSONFiles,
    loadMachineFromJSON,
    importMachineJSON,
    exportMachineToJSON
  } = useVisualizerStore();

  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [jsonFiles, setJsonFiles] = useState<MachineJSONFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MachineJSONFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Import state
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // Export state
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [exportedJson, setExportedJson] = useState<string>('');

  // Load JSON files on mount
  useEffect(() => {
    if (isOpen && activeTab === 'browse') {
      loadJsonFiles();
    }
  }, [isOpen, activeTab]);

  // Auto-select current machine for export
  useEffect(() => {
    if (currentMachine && activeTab === 'export') {
      setSelectedMachineId(currentMachine.id);
    }
  }, [currentMachine, activeTab]);

  const loadJsonFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const files = await listMachineJSONFiles();
      setJsonFiles(files);
    } catch (err: any) {
      setError(`Failed to load JSON files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromJSON = async (file: MachineJSONFile) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Extract filename without extension
      const name = file.filename.replace('.json', '');
      await loadMachineFromJSON(name);

      setSuccess(`Machine "${file.name}" loaded successfully!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(`Failed to load machine: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportJSON = async () => {
    try {
      setLoading(true);
      setImportError(null);
      setSuccess(null);

      // Validate JSON
      JSON.parse(importJson);

      await importMachineJSON(importJson);

      setSuccess('Machine imported successfully!');
      setImportJson('');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setImportError('Invalid JSON format. Please check your syntax.');
      } else {
        setImportError(`Failed to import machine: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedMachineId) {
        setError('Please select a machine to export');
        setLoading(false);
        return;
      }

      const jsonString = await exportMachineToJSON(selectedMachineId, true);
      setExportedJson(jsonString);
      setSuccess('Machine exported successfully!');
    } catch (err: any) {
      setError(`Failed to export machine: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!exportedJson) return;

    const machine = machines.find(m => m.id === selectedMachineId);
    const filename = machine ? `${machine.name}.json` : 'machine.json';

    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    if (!exportedJson) return;

    navigator.clipboard.writeText(exportedJson);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#e2e8f0' }}>
              Machine Management
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#94a3b8' }}>
              Load, import, and export machine definitions
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '24px',
              padding: '4px'
            }}
            title="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #333',
            padding: '0 24px'
          }}
        >
          <button
            onClick={() => {
              setActiveTab('browse');
              setError(null);
              setSuccess(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '16px 24px',
              color: activeTab === 'browse' ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer',
              borderBottom: activeTab === 'browse' ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: activeTab === 'browse' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FolderOpen size={18} />
            Browse Files
          </button>
          <button
            onClick={() => {
              setActiveTab('import');
              setError(null);
              setSuccess(null);
              setImportError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '16px 24px',
              color: activeTab === 'import' ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer',
              borderBottom: activeTab === 'import' ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: activeTab === 'import' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Upload size={18} />
            Import JSON
          </button>
          <button
            onClick={() => {
              setActiveTab('export');
              setError(null);
              setSuccess(null);
              setExportedJson('');
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '16px 24px',
              color: activeTab === 'export' ? '#3b82f6' : '#94a3b8',
              cursor: 'pointer',
              borderBottom: activeTab === 'export' ? '2px solid #3b82f6' : '2px solid transparent',
              fontWeight: activeTab === 'export' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Download size={18} />
            Export JSON
          </button>
        </div>

        {/* Content Area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden'
          }}
        >
          {/* Left Panel - File List or Form */}
          <div
            style={{
              width: '400px',
              borderRight: '1px solid #333',
              padding: '24px',
              overflowY: 'auto'
            }}
          >
            {/* Browse Tab */}
            {activeTab === 'browse' && (
              <div>
                <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#e2e8f0' }}>
                    Server Machine Files
                  </h3>
                  <button
                    onClick={loadJsonFiles}
                    disabled={loading}
                    style={{
                      background: 'none',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: '#3b82f6',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      opacity: loading ? 0.5 : 1
                    }}
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
                  Browse and load machine definitions from the server (examples/machines directory)
                </p>

                {loading && jsonFiles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    <Loader size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: '12px' }}>Loading files...</p>
                  </div>
                )}

                {!loading && jsonFiles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    <FileJson size={48} style={{ opacity: 0.5, margin: '0 auto 12px' }} />
                    <p>No machine JSON files found</p>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {jsonFiles.map((file) => (
                    <div
                      key={file.filename}
                      onClick={() => setSelectedFile(file)}
                      style={{
                        padding: '16px',
                        backgroundColor: selectedFile?.filename === file.filename ? '#1e40af' : '#0a0a0a',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selectedFile?.filename === file.filename ? '#3b82f6' : '#333',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <FileJson size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '4px' }}>
                            {file.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                            {file.description}
                          </div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#64748b' }}>
                            <span>{file.sequenceCount} sequences</span>
                            <span>v{file.version}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedFile && (
                  <button
                    onClick={() => handleLoadFromJSON(selectedFile)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Loading...' : 'Load Machine'}
                  </button>
                )}
              </div>
            )}

            {/* Import Tab */}
            {activeTab === 'import' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e8f0' }}>
                  Import Machine JSON
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
                  Upload a JSON file or paste your machine JSON definition below:
                </p>

                {/* File Upload Button */}
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="file"
                    accept=".json,application/json"
                    id="json-file-upload"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          setImportJson(content);
                          setImportError(null);
                        };
                        reader.onerror = () => {
                          setImportError('Failed to read file');
                        };
                        reader.readAsText(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="json-file-upload"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#334155';
                      e.currentTarget.style.borderColor = '#475569';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#1e293b';
                      e.currentTarget.style.borderColor = '#334155';
                    }}
                  >
                    <Upload size={16} />
                    Choose JSON File from Computer
                  </label>
                </div>

                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder='{"version": "1.0.0", "machine": {...}}'
                  style={{
                    width: '100%',
                    height: '400px',
                    padding: '12px',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    resize: 'vertical'
                  }}
                />

                <button
                  onClick={handleImportJSON}
                  disabled={!importJson || loading}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: !importJson || loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: !importJson || loading ? 0.6 : 1
                  }}
                >
                  {loading ? 'Importing...' : 'Import Machine'}
                </button>

                {importError && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #dc2626',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: '13px',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'flex-start'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{importError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e8f0' }}>
                  Export Machine JSON
                </h3>

                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '13px',
                      color: '#94a3b8'
                    }}
                  >
                    Select Machine
                  </label>
                  <select
                    value={selectedMachineId}
                    onChange={(e) => {
                      setSelectedMachineId(e.target.value);
                      setExportedJson('');
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Choose a machine...</option>
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} ({machine.sequenceCount} sequences)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportJSON}
                  disabled={!selectedMachineId || loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: !selectedMachineId || loading ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: !selectedMachineId || loading ? 0.6 : 1,
                    marginBottom: '16px'
                  }}
                >
                  {loading ? 'Exporting...' : 'Export to JSON'}
                </button>

                {exportedJson && (
                  <div>
                    <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleDownloadJSON}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Download size={16} />
                        Download
                      </button>
                      <button
                        onClick={handleCopyToClipboard}
                        style={{
                          flex: 1,
                          padding: '10px',
                          backgroundColor: '#6366f1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px'
                        }}
                      >
                        Copy
                      </button>
                    </div>

                    <textarea
                      value={exportedJson}
                      readOnly
                      style={{
                        width: '100%',
                        height: '300px',
                        padding: '12px',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Panel - Machine Graph Visualization */}
          <div
            style={{
              flex: 1,
              padding: '24px',
              overflowY: 'auto',
              backgroundColor: '#0a0a0a'
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#e2e8f0' }}>
              Machine Visualization
            </h3>

            {activeTab === 'browse' && selectedFile && (
              <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>
                  {selectedFile.name}
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px' }}>
                  {selectedFile.description}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
                  <div style={{ padding: '6px 12px', backgroundColor: '#0a0a0a', borderRadius: '6px', color: '#94a3b8' }}>
                    <strong style={{ color: '#e2e8f0' }}>{selectedFile.sequenceCount}</strong> sequences
                  </div>
                  <div style={{ padding: '6px 12px', backgroundColor: '#0a0a0a', borderRadius: '6px', color: '#94a3b8' }}>
                    Version <strong style={{ color: '#e2e8f0' }}>{selectedFile.version}</strong>
                  </div>
                  {selectedFile.metadata?.category && (
                    <div style={{ padding: '6px 12px', backgroundColor: '#1e40af', borderRadius: '6px', color: '#93c5fd', textTransform: 'capitalize' }}>
                      {selectedFile.metadata.category}
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentMachine ? (
              <div
                style={{
                  height: activeTab === 'browse' && selectedFile ? 'calc(100% - 140px)' : '100%',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                <MachineGraphView />
              </div>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  border: '1px dashed #333',
                  borderRadius: '8px'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <FileJson size={64} style={{ opacity: 0.3, margin: '0 auto 16px' }} />
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>No machine loaded</p>
                  <p style={{ fontSize: '13px', opacity: 0.7 }}>
                    {activeTab === 'browse' && 'Select a machine file to view its graph'}
                    {activeTab === 'import' && 'Import a machine to view its graph'}
                    {activeTab === 'export' && 'Select a machine to export'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {(error || success) && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #333',
              backgroundColor: error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                color: error ? '#fca5a5' : '#6ee7b7',
                fontSize: '14px'
              }}
            >
              {error ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              <span>{error || success}</span>
            </div>
          </div>
        )}
      </div>

      {/* Add keyframe animation for loader */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default MachineManagementModal;
