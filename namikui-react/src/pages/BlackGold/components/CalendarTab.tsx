import styles from '../BlackGold.module.css';
import type { BlackGoldAssignments, BlackGoldDate } from '../blackGoldTypes';
import type { Member } from '../../../types';
import { getEntry } from '../blackGoldUtils';

interface Props {
  dates: BlackGoldDate[];
  members: Member[];
  assignments: BlackGoldAssignments;
  canEdit: boolean;
  onEditDate: (dateId: string) => void;
  onRemoveDate: (dateId: string) => void;
}

export default function CalendarTab({ dates, members, assignments, canEdit, onEditDate, onRemoveDate }: Props) {
  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thMember}>Session Date</th>
              <th>Week</th>
              <th>A Count</th>
              <th>B Count</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.mutedCell}>
                  No sessions yet. {canEdit ? 'Pick a date above and click + ADD DATE.' : ''}
                </td>
              </tr>
            ) : (
              dates.map((d, idx) => {
                let countA = 0;
                let countB = 0;
                members.forEach((m) => {
                  const entry = getEntry(assignments, m.id, d.id);
                  if (entry.slot === 'A') countA++;
                  if (entry.slot === 'B') countB++;
                });
                return (
                  <tr key={d.id}>
                    <td className={`${styles.colMember} notranslate`} style={{ cursor: canEdit ? 'pointer' : 'default' }} onClick={() => canEdit && onEditDate(d.id)}>
                      {d.date}
                    </td>
                    <td>Week {idx + 1}</td>
                    <td className="notranslate">
                      <span className={styles.abCountA}>{countA}</span>
                    </td>
                    <td className="notranslate">
                      <span className={styles.abCountB}>{countB}</span>
                    </td>
                    <td>
                      {canEdit ? (
                        <button className={styles.removeDateBtn} style={{ fontSize: 11 }} onClick={() => onRemoveDate(d.id)}>
                          ✕ Remove
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
