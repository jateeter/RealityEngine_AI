import React from 'react';
import type { MatchAlgorithm } from '../types.js';

interface Props {
  step: number;
  isAutoRunning: boolean;
  autoIntervalMs: number;
  matchAlgorithm: MatchAlgorithm;
  onPush: () => void;
  onAutoStart: () => void;
  onAutoStop: () => void;
  onReset: () => void;
  onIntervalChange: (ms: number) => void;
  onMatchAlgorithmChange: (algo: MatchAlgorithm) => void;
}

const INTERVAL_OPTIONS = [
  { label: '500ms', value: 500 },
  { label: '1s', value: 1000 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
];

const MATCH_OPTIONS: { label: string; value: MatchAlgorithm; description: string }[] = [
  { label: '≥ GTE', value: 'gte', description: 'Greater-than-or-equal threshold state' },
  { label: '= Equal', value: 'equals', description: 'Strict equality' },
];

const btn: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 4,
  border: '1px solid #334155',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  background: '#1e293b',
  color: '#e2e8f0',
};

export default function Header({
  step, isAutoRunning, autoIntervalMs, matchAlgorithm,
  onPush, onAutoStart, onAutoStop, onReset, onIntervalChange, onMatchAlgorithmChange,
}: Props) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px', background: '#0f172a',
      borderBottom: '1px solid #1e293b', flexShrink: 0,
    }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#7dd3fc' }}>PERCEPTION ENGINE</div>
        <div style={{ fontSize: 11, color: '#64748b' }}>Reality source for Reality Engine</div>
      </div>
      <div style={{ marginLeft: 8, color: '#94a3b8', fontSize: 13 }}>
        Step: <strong style={{ color: '#e2e8f0' }}>{step}</strong>
      </div>

      {/* Match algorithm selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Match
        </span>
        <div style={{ display: 'flex', borderRadius: 4, border: '1px solid #334155', overflow: 'hidden' }}>
          {MATCH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              title={opt.description}
              onClick={() => onMatchAlgorithmChange(opt.value)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                borderRight: '1px solid #334155',
                background: matchAlgorithm === opt.value ? '#1d4ed8' : '#1e293b',
                color: matchAlgorithm === opt.value ? '#bfdbfe' : '#64748b',
                transition: 'background 0.1s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={btn} onClick={onPush}>▶ Push Once</button>

        <select
          value={autoIntervalMs}
          onChange={e => onIntervalChange(Number(e.target.value))}
          style={{ ...btn, padding: '5px 8px' }}
        >
          {INTERVAL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {isAutoRunning ? (
          <button style={{ ...btn, background: '#7f1d1d', borderColor: '#991b1b', color: '#fca5a5' }} onClick={onAutoStop}>
            ■ Stop Auto
          </button>
        ) : (
          <button style={{ ...btn, background: '#14532d', borderColor: '#166534', color: '#86efac' }} onClick={onAutoStart}>
            ⏱ Auto Push
          </button>
        )}

        <button style={{ ...btn, color: '#94a3b8' }} onClick={onReset}>↺ Reset</button>
      </div>
    </div>
  );
}
