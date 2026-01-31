/**
 * PerceptualSimulationControls - Control panel for perceptual space simulation
 *
 * Allows configuring and running simulations through the perceptual space
 */

import React, { useState } from 'react';
import './PerceptualSimulationControls.css';

export const PerceptualSimulationControls: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isConfigured, setIsConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [inputSequence, setInputSequence] = useState('[[1, 0, 0], [0, 1, 0], [0, 0, 1]]');
  const [inputOffset, setInputOffset] = useState('0');
  const [inputLength, setInputLength] = useState('3');
  const [stepDelayMs, setStepDelayMs] = useState('1000');
  const [maxSteps, setMaxSteps] = useState('');

  // Listen for WebSocket updates
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'perceptual-simulation-stepped') {
        setCurrentStep(data.step.stepNumber);
      } else if (data.type === 'perceptual-simulation-reset') {
        setCurrentStep(0);
        setIsRunning(false);
      }
    };

    const ws = (window as any).realityEngineWS;
    if (ws) {
      ws.addEventListener('message', handleMessage);
      return () => {
        ws.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  const showError = (message: string) => {
    setError(message);
    setSuccess(null);
    setTimeout(() => setError(null), 5000);
  };

  const showSuccess = (message: string) => {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleConfigure = async () => {
    try {
      // Parse input sequence
      let parsedSequence;
      try {
        parsedSequence = JSON.parse(inputSequence);
      } catch (e) {
        showError('Invalid input sequence JSON');
        return;
      }

      const config = {
        inputSequence: parsedSequence,
        inputRegion: {
          offset: parseInt(inputOffset, 10),
          length: parseInt(inputLength, 10)
        },
        stepDelayMs: parseInt(stepDelayMs, 10),
        maxSteps: maxSteps ? parseInt(maxSteps, 10) : undefined
      };

      const response = await fetch('/api/perceptual-simulation/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (result.success) {
        setIsConfigured(true);
        showSuccess('Simulation configured successfully');
      } else {
        showError(result.error || 'Failed to configure simulation');
      }
    } catch (err: any) {
      showError(`Error configuring simulation: ${err.message}`);
    }
  };

  const handleStart = async () => {
    try {
      const response = await fetch('/api/perceptual-simulation/start', {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setIsRunning(true);
        showSuccess('Simulation started');
      } else {
        showError(result.error || 'Failed to start simulation');
      }
    } catch (err: any) {
      showError(`Error starting simulation: ${err.message}`);
    }
  };

  const handleStop = async () => {
    try {
      const response = await fetch('/api/perceptual-simulation/stop', {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setIsRunning(false);
        showSuccess('Simulation stopped');
      } else {
        showError(result.error || 'Failed to stop simulation');
      }
    } catch (err: any) {
      showError(`Error stopping simulation: ${err.message}`);
    }
  };

  const handleStep = async () => {
    try {
      const response = await fetch('/api/perceptual-simulation/step', {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        if (result.step) {
          setCurrentStep(result.step.stepNumber);
          showSuccess('Stepped simulation');
        } else {
          showSuccess('Simulation complete');
        }
      } else {
        showError(result.error || 'Failed to step simulation');
      }
    } catch (err: any) {
      showError(`Error stepping simulation: ${err.message}`);
    }
  };

  const handleReset = async () => {
    try {
      const response = await fetch('/api/perceptual-simulation/reset', {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success) {
        setCurrentStep(0);
        setIsRunning(false);
        showSuccess('Simulation reset');
      } else {
        showError(result.error || 'Failed to reset simulation');
      }
    } catch (err: any) {
      showError(`Error resetting simulation: ${err.message}`);
    }
  };

  const loadExample1 = () => {
    // Multi-Step Machine example
    setInputSequence(JSON.stringify([
      [1, 0, 0], // State A
      [0, 1, 0], // State B
      [0, 0, 1]  // Output X
    ], null, 2));
    setInputOffset('0');
    setInputLength('3');
    setStepDelayMs('1500');
    setMaxSteps('3');
  };

  const loadExample2 = () => {
    // Full interconnected example
    setInputSequence(JSON.stringify([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
      [0, 1, 1]
    ], null, 2));
    setInputOffset('0');
    setInputLength('3');
    setStepDelayMs('2000');
    setMaxSteps('');
  };

  return (
    <div className="perceptual-simulation-controls">
      <h3>Perceptual Space Simulation</h3>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message success">{success}</div>}

      <div className="status-bar">
        <div className={`status-indicator ${isRunning ? 'running' : isConfigured ? 'ready' : 'idle'}`}>
          {isRunning ? 'Running' : isConfigured ? 'Ready' : 'Not Configured'}
        </div>
        <div className="step-counter">Step: {currentStep}</div>
      </div>

      <div className="controls-section">
        <h4>Configuration</h4>

        <div className="form-group">
          <label>Input Sequence (JSON array of vectors)</label>
          <textarea
            value={inputSequence}
            onChange={(e) => setInputSequence(e.target.value)}
            placeholder="[[1, 0, 0], [0, 1, 0]]"
            rows={6}
            disabled={isRunning}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Input Offset</label>
            <input
              type="number"
              value={inputOffset}
              onChange={(e) => setInputOffset(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="form-group">
            <label>Input Length</label>
            <input
              type="number"
              value={inputLength}
              onChange={(e) => setInputLength(e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Step Delay (ms)</label>
            <input
              type="number"
              value={stepDelayMs}
              onChange={(e) => setStepDelayMs(e.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="form-group">
            <label>Max Steps (optional)</label>
            <input
              type="number"
              value={maxSteps}
              onChange={(e) => setMaxSteps(e.target.value)}
              placeholder="Unlimited"
              disabled={isRunning}
            />
          </div>
        </div>

        <div className="button-group">
          <button onClick={loadExample1} disabled={isRunning} className="btn-secondary">
            Example 1
          </button>
          <button onClick={loadExample2} disabled={isRunning} className="btn-secondary">
            Example 2
          </button>
          <button onClick={handleConfigure} disabled={isRunning} className="btn-primary">
            Configure
          </button>
        </div>
      </div>

      <div className="controls-section">
        <h4>Simulation Controls</h4>

        <div className="button-group">
          <button
            onClick={handleStart}
            disabled={!isConfigured || isRunning}
            className="btn-success"
          >
            ▶ Start
          </button>

          <button
            onClick={handleStop}
            disabled={!isRunning}
            className="btn-warning"
          >
            ⏸ Stop
          </button>

          <button
            onClick={handleStep}
            disabled={!isConfigured || isRunning}
            className="btn-primary"
          >
            ⏭ Step
          </button>

          <button
            onClick={handleReset}
            disabled={isRunning}
            className="btn-danger"
          >
            ⏹ Reset
          </button>
        </div>
      </div>

      <div className="help-section">
        <h4>How to use</h4>
        <ol>
          <li>Load an example or configure your own input sequence</li>
          <li>Set the input region offset and length</li>
          <li>Click "Configure" to prepare the simulation</li>
          <li>Use "Start" to run automatically, or "Step" to advance manually</li>
          <li>Watch the machine graph and perceptual space update in real-time</li>
        </ol>
      </div>
    </div>
  );
};
