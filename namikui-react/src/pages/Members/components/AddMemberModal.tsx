import { useState } from 'react';
import styles from '../Members.module.css';
import type { Member } from '../../../types';

interface Props {
  onClose: () => void;
  onSave: (fields: { name: string; cp: string; faction: 'F' | 'S' | 'R'; level: string }) => Promise<void>;
}

const LEVEL_OPTIONS = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 10 }, (_, i) => `i${i + 1}`),
];

export default function AddMemberModal({ onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [cp, setCp] = useState('');
  const [faction, setFaction] = useState<'F' | 'S' | 'R'>('F');
  const [level, setLevel] = useState('1');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      alert('Please enter a member name.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), cp: cp.trim() || '0', faction, level });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>Add New Member</h3>
        <label>In-Game Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter fighter name..." />
        <label>Combat Power (CP)</label>
        <input type="text" value={cp} onChange={(e) => setCp(e.target.value)} placeholder="e.g. 5,390,000,000" />
        <label>Initial Faction</label>
        <select value={faction} onChange={(e) => setFaction(e.target.value as 'F' | 'S' | 'R')}>
          <option value="F">F (Blue)</option>
          <option value="S">S (Purple)</option>
          <option value="R">R (Orange)</option>
        </select>
        <label>Level (1-30 or i1-i10)</label>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <div className={styles.modalBtns}>
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={`${styles.btnAction} ${styles.btnGold}`} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
