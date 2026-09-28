import styles from '../BlackGold.module.css';
import type { BlackGoldEntry } from '../blackGoldTypes';

interface Props {
  entry: BlackGoldEntry;
  canEdit: boolean;
  onCycleSlot: () => void;
  onToggleAttended: () => void;
  onCycleRole: () => void;
  extra?: React.ReactNode;
}

export default function SlotCell({ entry, canEdit, onCycleSlot, onToggleAttended, onCycleRole, extra }: Props) {
  const slotClass = entry.slot === 'A' ? styles.slotBtnA : entry.slot === 'B' ? styles.slotBtnB : styles.slotBtnUnassigned;
  const slotLabel = entry.slot || '·';
  const attendClass = entry.attended ? styles.attendYes : styles.attendNo;
  const attendLabel = entry.attended ? 'Attended' : 'Not Attended';
  let roleClass = styles.roleNone;
  let roleLabel = 'Role: None';
  if (entry.playerRole === 'main') { roleClass = styles.roleMain; roleLabel = 'Main Player'; }
  else if (entry.playerRole === 'sub') { roleClass = styles.roleSub; roleLabel = 'Substitute'; }

  return (
    <td>
      <div className={styles.cellStack}>
        <button className={`${styles.slotBtn} ${slotClass} ${canEdit ? '' : styles.slotBtnReadonly} notranslate`} onClick={canEdit ? onCycleSlot : undefined} disabled={!canEdit}>
          {slotLabel}
        </button>
        <button className={`${styles.attendPill} ${attendClass} ${canEdit ? '' : styles.attendReadonly}`} onClick={canEdit ? onToggleAttended : undefined} disabled={!canEdit}>
          {attendLabel}
        </button>
        <button className={`${styles.rolePill} ${roleClass} ${canEdit ? '' : styles.roleReadonly}`} onClick={canEdit ? onCycleRole : undefined} disabled={!canEdit}>
          {roleLabel}
        </button>
        {extra}
      </div>
    </td>
  );
}
