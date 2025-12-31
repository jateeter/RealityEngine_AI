import React, { useState } from 'react';
import { api } from '../api';
import { useVisualizerStore } from '../store';

const ManualInputPanel: React.FC = () => {
  const { addActivityEvent } = useVisualizerStore();
  const [vectorInput, setVectorInput] = useState('0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const parseVector = (input: string): number[] | null => {
    try {
      const values = input.split(',').map(s => {
        const num = parseFloat(s.trim());
        if (isNaN(num)) throw new Error('Invalid number');
        return num;
      });
      if (values.length !== 12) {
        throw new Error('Vector must have exactly 12 dimensions');
      }
      return values;
    } catch (error) {
      return null;
    }
  };

  const handleProcessVector = async () => {
    const vector = parseVector(vectorInput);
    if (!vector) {
      addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Invalid vector format. Please enter 12 comma-separated numbers.',
        timestamp: Date.now(),
        severity: 'error'
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await api.processInput(vector);
      const result = response.result || response;
      setLastResult(result);

      addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'vector-processed',
        message: `Manual vector processed → ${result.totalOutputs?.length || 0} outputs`,
        timestamp: Date.now(),
        severity: 'success',
        metadata: { vector, result }
      });

      // Add output events
      if (result.totalOutputs && result.totalOutputs.length > 0) {
        result.totalOutputs.forEach((output: any) => {
          addActivityEvent({
            id: `event-${Date.now()}-${Math.random()}`,
            type: 'output-asserted',
            message: output.metadata?.description || 'Output asserted',
            timestamp: Date.now(),
            severity: 'info',
            metadata: { output }
          });
        });
      }
    } catch (error: any) {
      console.error('Error processing vector:', error);
      addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'error',
        message: 'Failed to process vector: ' + error.message,
        timestamp: Date.now(),
        severity: 'error'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePreset = (presetName: string) => {
    const presets: Record<string, string> = {
      normal: '0.30, 0.25, 0.30, 0.35, 0.05, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5',
      warning: '0.60, 0.50, 0.60, 0.65, 0.35, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5',
      critical: '0.85, 0.80, 0.85, 0.90, 0.70, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5',
      emergency: '0.98, 0.98, 0.98, 0.98, 0.98, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5'
    };
    setVectorInput(presets[presetName] || '');
  };

  return (
    <div
      style={{
        padding: '16px',
        background: '#0f0f0f',
        border: '1px solid #222',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '8px',
          borderBottom: '1px solid #222'
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>
          Manual Input Vector
        </h3>
        <div style={{ fontSize: '11px', color: '#666' }}>12 dimensions</div>
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => handlePreset('normal')}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Normal
        </button>
        <button
          onClick={() => handlePreset('warning')}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Warning
        </button>
        <button
          onClick={() => handlePreset('critical')}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Critical
        </button>
        <button
          onClick={() => handlePreset('emergency')}
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            background: '#991b1b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Emergency
        </button>
      </div>

      {/* Vector input */}
      <textarea
        value={vectorInput}
        onChange={(e) => setVectorInput(e.target.value)}
        placeholder="Enter 12 comma-separated numbers (e.g., 0.5, 0.5, 0.5, ...)"
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '8px',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px',
          fontFamily: 'monospace',
          resize: 'vertical'
        }}
      />

      {/* Process button */}
      <button
        onClick={handleProcessVector}
        disabled={isProcessing}
        style={{
          padding: '10px 16px',
          background: isProcessing ? '#555' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'transform 0.2s',
          opacity: isProcessing ? 0.6 : 1
        }}
        onMouseEnter={(e) => {
          if (!isProcessing) {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {isProcessing ? '⏳ Processing...' : '▶ Process Vector'}
      </button>

      {/* Last result */}
      {lastResult && (
        <div
          style={{
            padding: '12px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          <div style={{ color: '#888', marginBottom: '8px' }}>Last Result:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>
              <span style={{ color: '#666' }}>Sequences checked:</span>{' '}
              <span style={{ color: '#3b82f6' }}>{lastResult.sequencesChecked || 'N/A'}</span>
            </div>
            <div>
              <span style={{ color: '#666' }}>Outputs generated:</span>{' '}
              <span style={{ color: '#22c55e' }}>{lastResult.totalOutputs.length}</span>
            </div>
            {lastResult.totalOutputs.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
                <div style={{ color: '#888', marginBottom: '4px' }}>Outputs:</div>
                {lastResult.totalOutputs.slice(0, 5).map((output: any, idx: number) => (
                  <div key={idx} style={{ color: '#3b82f6', fontSize: '11px', marginLeft: '8px' }}>
                    • {output.metadata?.description || 'Unknown'}
                  </div>
                ))}
                {lastResult.totalOutputs.length > 5 && (
                  <div style={{ color: '#666', fontSize: '11px', marginLeft: '8px' }}>
                    ... and {lastResult.totalOutputs.length - 5} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualInputPanel;
