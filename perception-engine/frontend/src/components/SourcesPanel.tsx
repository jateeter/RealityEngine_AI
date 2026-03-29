import type { SourceConfig } from '../types.js';
import SourceCard from './SourceCard.js';

interface Props {
  sources: SourceConfig[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onHover: (id: string | null) => void;
  hoveredSourceId: string | null;
}

export default function SourcesPanel({ sources, onAdd, onDelete, onToggle, onHover, hoveredSourceId }: Props) {
  return (
    <div style={{
      width: 280, flexShrink: 0,
      borderRight: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#0a0f1e',
    }}>
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
          Sources ({sources.length})
        </span>
        <button
          onClick={onAdd}
          style={{
            padding: '3px 10px', borderRadius: 4, border: '1px solid #3b82f6',
            background: '#1e3a5f', color: '#7dd3fc', fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {sources.length === 0 && (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
            No sources yet.<br />Click + Add to create one.
          </div>
        )}
        {sources.map(src => (
          <SourceCard
            key={src.id}
            source={src}
            onDelete={onDelete}
            onToggle={onToggle}
            onHover={onHover}
            hovered={hoveredSourceId === src.id}
          />
        ))}
      </div>
    </div>
  );
}
