import styles from '../BlackGold.module.css';
import type { BlackGoldAssignments, BlackGoldDate } from '../blackGoldTypes';
import type { Member } from '../../../types';
import { RANK_GROUP_COLORS, RANK_GROUP_ORDER, getEntry, parseDateString } from '../blackGoldUtils';
import SlotCell from './SlotCell';

interface Props {
  dates: BlackGoldDate[];
  members: Member[];
  assignments: BlackGoldAssignments;
  canEdit: boolean;
  onEditDate: (dateId: string) => void;
  onRemoveDate: (dateId: string) => void;
  onCycleSlot: (memberId: number, dateId: string) => void;
  onToggleAttended: (memberId: number, dateId: string) => void;
  onCycleRole: (memberId: number, dateId: string) => void;
}

function penaltyWeeksFor(assignments: BlackGoldAssignments, memberId: number, dates: BlackGoldDate[], today: Date): number {
  let weeks = 0;
  dates.forEach((d) => {
    const entry = getEntry(assignments, memberId, d.id);
    if (entry.slot && !entry.attended) {
      const sessionDate = parseDateString(d.date);
      sessionDate.setHours(0, 0, 0, 0);
      const daysSince = Math.floor((today.getTime() - sessionDate.getTime()) / 86400000);
      if (daysSince >= 14) weeks += 2;
    }
  });
  return weeks;
}

function penaltyBadge(entry: ReturnType<typeof getEntry>, sessionDate: Date, today: Date) {
  if (!entry.slot || entry.attended) return null;
  const daysSince = Math.floor((today.getTime() - sessionDate.getTime()) / 86400000);
  if (daysSince < 0) return null;
  if (daysSince >= 14) return <div className={`${styles.penaltyBadge} ${styles.penaltyLocked}`}>PENALTY LOCKED</div>;
  return <div className={`${styles.penaltyBadge} ${styles.penaltyCountdown}`}>{14 - daysSince}D TO PENALTY</div>;
}

export default function AttendanceTable({ dates, members, assignments, canEdit, onEditDate, onRemoveDate, onCycleSlot, onToggleAttended, onCycleRole }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const colSpan = 2 + dates.length;

  const sorted = [...members].sort((a, b) => {
    const ra = RANK_GROUP_ORDER[a.rank] ?? 99;
    const rb = RANK_GROUP_ORDER[b.rank] ?? 99;
    if (ra !== rb) return ra - rb;
    return (b.f1Raw || 0) - (a.f1Raw || 0);
  });

  let lastGroupKey: string | null = null;

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thMember}>Member</th>
              {dates.map((d, idx) => (
                <th key={d.id}>
                  <div className={`${styles.dateLabel} notranslate`} onClick={() => canEdit && onEditDate(d.id)}>
                    {d.date}
                  </div>
                  <div className={styles.weekLabel}>Week {idx + 1}</div>
                  {canEdit && (
                    <button className={styles.removeDateBtn} onClick={() => onRemoveDate(d.id)}>
                      ✕
                    </button>
                  )}
                </th>
              ))}
              <th>Total Penalty</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className={styles.mutedCell}>
                  No members found.
                </td>
              </tr>
            ) : (
              sorted.map((m) => {
                const groupKey = RANK_GROUP_ORDER[m.rank] !== undefined ? m.rank : 'R1';
                const showBar = groupKey !== lastGroupKey;
                lastGroupKey = groupKey;
                const totalWeeks = penaltyWeeksFor(assignments, m.id, dates, today);
                return (
                  <>
                    {showBar && (
                      <tr key={`g-${groupKey}-${m.id}`} className={styles.factionDividerRow} style={{ ['--divider-color' as string]: RANK_GROUP_COLORS[groupKey] || '#5c4127' }}>
                        <td colSpan={colSpan}>{groupKey}</td>
                      </tr>
                    )}
                    <tr key={m.id}>
                      <td className={`${styles.colMember} notranslate`}>{m.name}</td>
                      {dates.map((d) => {
                        const entry = getEntry(assignments, m.id, d.id);
                        const sessionDate = parseDateString(d.date);
                        sessionDate.setHours(0, 0, 0, 0);
                        return (
                          <SlotCell
                            key={d.id}
                            entry={entry}
                            canEdit={canEdit}
                            onCycleSlot={() => onCycleSlot(m.id, d.id)}
                            onToggleAttended={() => onToggleAttended(m.id, d.id)}
                            onCycleRole={() => onCycleRole(m.id, d.id)}
                            extra={penaltyBadge(entry, sessionDate, today)}
                          />
                        );
                      })}
                      <td className={`${styles.colPenalty} notranslate`} style={{ color: totalWeeks > 0 ? 'var(--color-not-attended)' : 'var(--color-text-muted)' }}>
                        {totalWeeks} weeks
                      </td>
                    </tr>
                  </>
                );
              })
            )}
          </tbody>
          {dates.length > 0 && sorted.length > 0 && (
            <tfoot>
              <tr className={styles.tfootRow}>
                <td className={styles.colMember}>A / B COUNT</td>
                {dates.map((d) => {
                  let countA = 0;
                  let countB = 0;
                  sorted.forEach((m) => {
                    const entry = getEntry(assignments, m.id, d.id);
                    if (entry.slot === 'A') countA++;
                    if (entry.slot === 'B') countB++;
                  });
                  return (
                    <td key={d.id} className="notranslate">
                      <span className={styles.abCountA}>A:{countA}</span> · <span className={styles.abCountB}>B:{countB}</span>
                    </td>
                  );
                })}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
