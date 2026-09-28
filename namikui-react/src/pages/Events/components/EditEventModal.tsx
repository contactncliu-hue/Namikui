import { useState } from 'react';
import styles from '../Events.module.css';
import type { EventDate } from '../../../types';

interface Props {
  event: EventDate;
  onClose: () => void;
  onSave: (fields: { name: string; date: string; isWar: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function EditEventModal({ event, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState(event.name);
  const [date, setDate] = useState(event.date);
  const [isWar, setIsWar] = useState(event.isWar);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ name: name.trim() || event.name, date: date || event.date, isWar });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this event? This removes it for all members.')) return;
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>Edit Event</h3>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Event Name" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label className={styles.warCheckLabel} style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={isWar} onChange={(e) => setIsWar(e.target.checked)} /> WAR EVENT
        </label>
        <div className={styles.modalBtns}>
          <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={() => void handleDelete()} disabled={saving}>
            Delete Event
          </button>
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
