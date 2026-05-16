import React, { useEffect, useState } from 'react';
import { perceptionEngineApi } from '../api';

/**
 * MqttMappingsEditor — control surface for the MQTT mapping registry.
 * Loads the current registry via GET /api/perception/mqtt/mappings, lets
 * the operator edit it as a JSON document, validates client-side, and
 * pushes the edited registry back via PUT /api/perception/mqtt/mappings.
 * The PE validates against the same schema parser used at boot, restarts
 * the bridge with the new rules, and returns warnings (e.g. overlap) in
 * the response.
 *
 * Per the design rule, this editor is the authority — topics never embed
 * offsets, so reviewing / editing the projection here is the entire admin
 * surface for the broker-to-perceptual-space contract.
 */

const C_PANEL_BG = 'rgba(15, 23, 42, 0.95)';
const C_BORDER   = '#1e293b';
const C_TEXT     = '#e2e8f0';
const C_DIM      = '#94a3b8';
const C_ACCENT   = '#3b82f6';
const C_OK       = '#22c55e';
const C_AMBER    = '#f59e0b';
const C_RED      = '#ef4444';

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

// Drop the counters block (read-only runtime state) before exposing the
// registry as editable JSON — the operator shouldn't see ephemeral
// state mixed with their config, and the PE rebuilds counters fresh on
// each reload anyway.
function stripCounters(raw: { mappings: any[] }): { mappings: any[] } {
  return {
    mappings: (raw.mappings ?? []).map(m => {
      const { counters: _drop, ...rest } = m;
      return rest;
    }),
  };
}

export const MqttMappingsEditor: React.FC<Props> = ({ onClose, onSaved }) => {
  const [draft, setDraft]       = useState('');
  const [error, setError]       = useState<string | null>(null);
  const [warning, setWarning]   = useState<string[]>([]);
  const [busy, setBusy]         = useState(false);
  const [okMsg, setOkMsg]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await perceptionEngineApi.getMqttMappings();
        if (cancelled) return;
        const cleaned = stripCounters(m);
        setDraft(JSON.stringify(cleaned, null, 2));
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setError(null); setWarning([]); setOkMsg(null); setBusy(true);
    let body: any;
    try { body = JSON.parse(draft); }
    catch (e: any) { setError(`JSON parse error: ${e?.message ?? e}`); setBusy(false); return; }
    if (!body || !Array.isArray(body.mappings) || body.mappings.length === 0) {
      setError('body.mappings must be a non-empty array'); setBusy(false); return;
    }
    try {
      const resp = await perceptionEngineApi.putMqttMappings(body);
      setOkMsg(`reloaded ${resp.mappings} mapping rule(s)`);
      setWarning(resp.warnings ?? []);
      onSaved?.();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? String(e);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: C_PANEL_BG, border: `1px solid ${C_BORDER}`, borderRadius: 6, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: C_TEXT, fontSize: 14, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Edit MQTT Mappings
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={btn(C_DIM)}>Cancel</button>
          <button onClick={save}    disabled={busy} style={btn(C_ACCENT, '#0f172a')}>
            {busy ? 'Saving…' : 'Save & Reload Bridge'}
          </button>
        </div>
      </div>

      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 400, padding: 10,
          background: '#0b1220', color: C_TEXT,
          fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11,
          border: `1px solid ${C_BORDER}`, borderRadius: 4,
          resize: 'vertical',
        }}
      />

      {error && (
        <div style={msg(C_RED)}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {warning.length > 0 && (
        <div style={msg(C_AMBER)}>
          <strong>Warnings:</strong>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
            {warning.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}
      {okMsg && (
        <div style={msg(C_OK)}>
          ✓ {okMsg}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: C_DIM, fontStyle: 'italic' }}>
        Schema: <code style={{ color: C_TEXT }}>{`{ defaults?: {...}, mappings: [ { id, topicFilter, sensorIdTemplate?, region: {offset, length}, extract: {type, pointer?, index?}, normalize: {mode, min?, max?, scale?, offset?, clamp?}, ttlMs?, qos?, pushMode?, debounceMs? } ] }`}</code>
      </div>
    </div>
  );
};

function btn(bg: string, fg: string = '#e2e8f0'): React.CSSProperties {
  return {
    background: bg, color: fg, border: 'none', borderRadius: 4,
    padding: '6px 12px', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    cursor: 'pointer', textTransform: 'uppercase',
  };
}
function msg(color: string): React.CSSProperties {
  return {
    marginTop: 10, padding: 8, fontSize: 11,
    color, background: `${color}15`, border: `1px solid ${color}55`, borderRadius: 4,
  };
}
