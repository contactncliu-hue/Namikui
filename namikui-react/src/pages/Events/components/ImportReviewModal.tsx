import { useState } from 'react';
import styles from '../Events.module.css';
import type { Member } from '../../../types';

export interface ImportRow {
  rawText: string;
  memberId: string;
  confidence: number | null;
  include: boolean;
}

interface Props {
  rows: ImportRow[];
  matchedCount: number;
  activeMembers: Member[];
  rawOcrText: string;
  eventName: string;
  onEventNameChange: (v: string) => void;
  eventDate: string;
  onEventDateChange: (v: string) => void;
  isWar: boolean;
  onIsWarChange: (v: boolean) => void;
  onRowChange: (idx: number, field: 'include' | 'memberId', value: any) => void;
  onAddManualRow: () => void;
  onApply: () => void;
  onClose: () => void;
}

export default function ImportReviewModal({
  rows, matchedCount, activeMembers, rawOcrText,
  eventName, onEventNameChange, eventDate, onEventDateChange, isWar, onIsWarChange,
  onRowChange, onAddManualRow, onApply, onClose,
}: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const matched = rows.slice(0, matchedCount);
  const unmatched = rows.slice(matchedCount);

  const memberOptions = (selectedId: string) => (
    <>
      <option value="">— Skip —</option>
      {activeMembers.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </>
  );

  const renderRow = (r: ImportRow, idx: number) => {
    const confClass = r.confidence != null && r.confidence >= 0.85 ? styles.confHigh : styles.confLow;
    const confLabel = r.confidence != null ? `${Math.round(r.confidence * 100)}%` : r.rawText ? 'no match' : 'manual';
    return (
      <div className={styles.importReviewRow} key={idx}>
        <input type="checkbox" checked={r.include} onChange={(e) => onRowChange(idx, 'include', e.target.checked)} />
        <span className={`${styles.importReviewRowRaw} notranslate`} title={r.rawText}>{r.rawText || '(manually added)'}</span>
        <select className="notranslate" value={r.memberId} onChange={(e) => onRowChange(idx, 'memberId', e.target.value)}>
          {memberOptions(r.memberId)}
        </select>
        <span className={`${styles.importReviewRowConf} ${confClass} notranslate`}>{confLabel}</span>
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay} style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modalCard} style={{ maxWidth: 640 }}>
        <h3>Review Import <span className={styles.modalCloseX} onClick={onClose}>✕</span></h3>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--color-gold-bg)', border: '2px solid var(--color-gold)', borderRadius: 4, padding: '10px 12px', marginBottom: 12 }}>
          <input type="text" placeholder="Event Name" value={eventName} onChange={(e) => onEventNameChange(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <input type="date" value={eventDate} onChange={(e) => onEventDateChange(e.target.value)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800 }}>
            <input type="checkbox" checked={isWar} onChange={(e) => onIsWarChange(e.target.checked)} /> WAR EVENT
          </label>
        </div>

        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 12 }}>
          This shows exactly what OCR read from the screenshot(s). Check each matched member, uncheck anything wrong, then apply — a new event will be created with these members marked attended.
        </div>

        <div className={styles.importReviewSectionLabel}>Matched Rows</div>
        {matched.length > 0 ? matched.map((r, i) => renderRow(r, i)) : (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 8 }}>No confidently matched rows.</div>
        )}

        {unmatched.length > 0 && (
          <>
            <div className={styles.importReviewSectionLabel}>Unmatched Rows (pick a member or leave as Skip)</div>
            {unmatched.map((r, i) => renderRow(r, matchedCount + i))}
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <button className={styles.btnAction} style={{ fontSize: 11, padding: '8px 14px' }} onClick={onAddManualRow}>+ ADD ROW MANUALLY</button>
        </div>

        <details style={{ marginTop: 14 }} open={showRaw} onToggle={(e) => setShowRaw((e.target as HTMLDetailsElement).open)}>
          <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Raw OCR output</summary>
          <pre className="notranslate" style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: '#f7f6f0', border: '1px solid var(--color-border-light)', borderRadius: 4, padding: 10, marginTop: 8, maxHeight: 180, overflowY: 'auto', fontFamily: 'monospace' }}>
            {rawOcrText || '(Gemini returned no rows for this image.)'}
          </pre>
        </details>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className={styles.btnAction} onClick={onClose}>Cancel</button>
          <button className={styles.btnGold} onClick={onApply}>✔ APPLY CHECKED ROWS</button>
        </div>
      </div>
    </div>
  );
}
