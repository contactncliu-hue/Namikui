import { useState } from 'react';
import styles from '../VsPoints.module.css';
import type { VsData } from '../../../types';
import { getWeekDate, getWeekType } from '../vsUtils';

interface Props {
  title: string;
  description: string;
  vsData: VsData;
  initiallyChecked: (date: string) => boolean;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (selectedDates: string[]) => Promise<void>;
}

export default function DateSelectModal({ title, description, vsData, initiallyChecked, confirmLabel, onClose, onConfirm }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    vsData.weeks.forEach((wk) => {
      const d = getWeekDate(wk);
      init[d] = initiallyChecked(d);
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const setAll = (val: boolean) => {
    const next: Record<string, boolean> = {};
    vsData.weeks.forEach((wk) => {
      next[getWeekDate(wk)] = val;
    });
    setChecked(next);
  };

  const confirm = async () => {
    const selected = Object.keys(checked).filter((d) => checked[d]);
    setSaving(true);
    try {
      await onConfirm(selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>
          {title}
          <button className={styles.closeX} onClick={onClose}>
            ✕
          </button>
        </h3>
        <div className={styles.modalDesc}>{description}</div>
        <div className={styles.selectToolbar}>
          <button onClick={() => setAll(true)}>Select all</button>
          <button onClick={() => setAll(false)}>Select none</button>
        </div>
        <div className={styles.selectRows}>
          {vsData.weeks.map((wk, idx) => {
            const date = getWeekDate(wk);
            const type = getWeekType(wk) === 'daily' ? 'Daily' : 'Weekly';
            return (
              <label key={idx} className={styles.selectRow}>
                <input type="checkbox" checked={!!checked[date]} onChange={(e) => setChecked((c) => ({ ...c, [date]: e.target.checked }))} />
                <span className="notranslate">{date}</span>
                <span className={styles.selectRowType}>· {type}</span>
              </label>
            );
          })}
        </div>
        <div className={styles.modalBtns}>
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.btnGold} onClick={() => void confirm()} disabled={saving}>
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
