import type { SourceConfig } from '../types.js';
import SourceCard from './SourceCard.js';

interface Props {
  sources: SourceConfig[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onToggleAll: (active: boolean) => void;
  onHover: (id: string | null) => void;
  hoveredSourceId: string | null;
}

export default function SourcesPanel({ sources, onAdd, onDelete, onToggle, onToggleAll, onHover, hoveredSourceId }: Props) {
  const total       = sources.length;
  const activeCount = sources.filter(s => s.active).length;
  const allOn       = total > 0 && activeCount === total;
  const allOff      = activeCount === 0;
  const partial     = !allOn && !allOff;

  // Click action: if any source is currently off (or all off), turn everything on.
  // Only switch off when every source is already on.  Disabled when there are no sources.
  const handleAllClick = () => {
    if (total === 0) return;
    onToggleAll(!allOn);
  };

  const checkboxLabel = total === 0
    ? 'No sources'
    : allOn
      ? 'All on — click to disable all'
      : partial
        ? `${activeCount}/${total} active — click to enable all`
        : 'All off — click to enable all';

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
        gap: 8,
      }}>
        {/* Master toggle — tri-state visual indicator */}
        <button
          type="button"
          role="checkbox"
          aria-checked={allOn ? 'true' : partial ? 'mixed' : 'false'}
          aria-label={checkboxLabel}
          title={checkboxLabel}
          onClick={handleAllClick}
          disabled={total === 0}
          style={{
            width: 16, height: 16,
            flexShrink: 0,
            borderRadius: 3,
            border: `1.5px solid ${allOn ? '#3b82f6' : partial ? '#7dd3fc' : '#475569'}`,
            background: allOn ? '#1e3a5f' : 'transparent',
            cursor: total === 0 ? 'not-allowed' : 'pointer',
            opacity: total === 0 ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          {allOn && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5.2L4.2 7.5L8.2 2.5" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {partial && (
            <span style={{
              width: 8, height: 2,
              background: '#7dd3fc',
              borderRadius: 1,
            }} />
          )}
        </button>

        <span style={{
          fontWeight: 700, fontSize: 12, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: 1,
          flex: 1,
        }}>
          Sources ({total})
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
