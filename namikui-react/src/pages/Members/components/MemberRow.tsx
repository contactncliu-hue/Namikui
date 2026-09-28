import styles from '../Members.module.css';
import type { Member } from '../../../types';
import { parseCpToRaw } from '../memberUtils';

const LEVEL_OPTIONS = [
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 10 }, (_, i) => `i${i + 1}`),
];

interface Props {
  member: Member;
  rank: number;
  rowClass: string;
  canEdit: boolean;
  showDiff: boolean;
  onSetStatus: (status: 'active' | 'inactive' | 'removed') => void;
  onCycleRank: () => void;
  onCycleFaction: () => void;
  onUpdateCp: (val: string) => void;
  onUpdateF1: (val: string) => void;
  onUpdateName: (val: string) => void;
  onUpdateLevel: (val: string) => void;
  onUpdateNote: (val: string) => void;
  onOpenHistory: () => void;
  onRemove: () => void;
}

export default function MemberRow({
  member,
  rank,
  rowClass,
  canEdit,
  showDiff,
  onSetStatus,
  onCycleRank,
  onCycleFaction,
  onUpdateCp,
  onUpdateF1,
  onUpdateName,
  onUpdateLevel,
  onUpdateNote,
  onOpenHistory,
  onRemove,
}: Props) {
  const isAct = member.status === 'active';
  const isInact = member.status === 'inactive';
  const isRem = member.status === 'removed';

  let rankDotClass = '';
  if (member.rank === 'R4') rankDotClass = styles.rankDotR4;
  else if (member.rank === 'R5') rankDotClass = styles.rankDotR5;

  let factionClass = styles.factionF;
  if (member.faction === 'S') factionClass = styles.factionS;
  else if (member.faction === 'R') factionClass = styles.factionR;

  let diffNode: React.ReactNode = <span className={styles.diffMuted}>-</span>;
  if (showDiff && member.f1History && member.f1History.length >= 2) {
    const latestRaw = member.f1Raw || 0;
    const prevEntry = member.f1History[member.f1History.length - 2];
    const prevRaw = parseCpToRaw(prevEntry.val).raw;
    const diffVal = latestRaw - prevRaw;
    if (diffVal > 0) {
      const fmt = diffVal >= 1e9 ? (diffVal / 1e9).toFixed(1) + 'G' : (diffVal / 1e6).toFixed(0) + 'M';
      diffNode = <span className={styles.diffGreen}>↑ +{fmt}</span>;
    } else if (diffVal < 0) {
      const abs = Math.abs(diffVal);
      const fmt = abs >= 1e9 ? (abs / 1e9).toFixed(1) + 'G' : (abs / 1e6).toFixed(0) + 'M';
      diffNode = <span className={styles.diffRed}>↓ -{fmt}</span>;
    }
  }

  const historyCount = member.f1History ? member.f1History.length : 0;

  return (
    <tr className={rowClass}>
      <td className={styles.colRank}>{rank}</td>
      <td className={styles.colName}>
        <div className={styles.nameRow}>
          <div className={styles.statusTabs}>
            <button
              className={`${styles.statusTab} ${isAct ? styles.activeActive : ''}`}
              onClick={() => canEdit && onSetStatus('active')}
              disabled={!canEdit}
              title="Active"
            >
              A
            </button>
            <button
              className={`${styles.statusTab} ${isInact ? styles.activeInactive : ''}`}
              onClick={() => canEdit && onSetStatus('inactive')}
              disabled={!canEdit}
              title="Inactive"
            >
              I
            </button>
            <button
              className={`${styles.statusTab} ${isRem ? styles.activeRemoved : ''}`}
              onClick={() => canEdit && onSetStatus('removed')}
              disabled={!canEdit}
              title="Removed"
            >
              R
            </button>
          </div>
          <div className={styles.nameField}>
            <input
              type="text"
              className={`${styles.editableInput} notranslate`}
              defaultValue={member.name}
              disabled={!canEdit}
              onBlur={(e) => e.target.value !== member.name && onUpdateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder="Member name..."
            />
          </div>
          <div
            className={`${styles.rankDot} ${rankDotClass} ${!canEdit ? styles.rankDotStatic : ''} notranslate`}
            onClick={() => canEdit && onCycleRank()}
            title={canEdit ? 'Click to cycle rank' : undefined}
          >
            {member.rank}
          </div>
        </div>
      </td>
      <td>
        <input
          type="text"
          className={`${styles.editableInput} ${styles.cpInput} notranslate`}
          defaultValue={member.cp || '0'}
          disabled={!canEdit}
          onBlur={(e) => e.target.value !== member.cp && onUpdateCp(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="e.g. 5,390,000,000"
        />
      </td>
      <td>
        <div className={styles.f1Cell}>
          <input
            type="text"
            className={`${styles.editableInput} notranslate`}
            defaultValue={member.f1Cp || '0G'}
            disabled={!canEdit}
            onBlur={(e) => e.target.value !== member.f1Cp && onUpdateF1(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="0G"
          />
          <button className={styles.historyBadge} onClick={onOpenHistory}>
            🕐 History ({historyCount})
          </button>
        </div>
      </td>
      <td>
        <div
          className={`${styles.factionCircle} ${factionClass} ${!canEdit ? styles.factionCircleStatic : ''} notranslate`}
          onClick={() => canEdit && onCycleFaction()}
          title={canEdit ? 'Click to cycle faction (F, S, R)' : undefined}
        >
          {member.faction || 'F'}
        </div>
      </td>
      <td>
        <select
          className={`${styles.editableSelect} notranslate`}
          defaultValue={member.level || '1'}
          disabled={!canEdit}
          onChange={(e) => onUpdateLevel(e.target.value)}
        >
          {LEVEL_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td className="notranslate" style={{ fontWeight: 800, color: 'var(--color-primary-dark)' }}>
        #{rank}
      </td>
      <td className="notranslate">{diffNode}</td>
      <td>
        <input
          type="text"
          className={`${styles.editableInput} notranslate`}
          defaultValue={member.note || ''}
          disabled={!canEdit}
          onBlur={(e) => e.target.value !== member.note && onUpdateNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Add note..."
        />
      </td>
      {canEdit && (
        <td>
          <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={onRemove} title="Delete Member">
            🗑
          </button>
        </td>
      )}
    </tr>
  );
}
