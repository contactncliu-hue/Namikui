import { useState } from 'react';
import styles from '../VsPoints.module.css';
import type { Member, VsMemberScore } from '../../../types';
import { RANK_GROUP_ORDER, formatDateForDisplay, formatDateForInput, getThreshold, getWeekDate, getWeekType } from '../vsUtils';
import type { VsData } from '../../../types';

interface Props {
  vsData: VsData;
  members: Member[];
  isStaff: boolean;
  search: string;
  onEditScore: (memberId: number, weekIdx: number) => void;
  onDeleteWeek: (weekIdx: number) => void;
  onChangeWeekDate: (weekIdx: number, newDate: string) => void;
  onToggleWeekType: (weekIdx: number) => void;
}

export default function WeeklyTable({ vsData, members, isStaff, search, onEditScore, onDeleteWeek, onChangeWeekDate, onToggleWeekType }: Props) {
  const [editingDateIdx, setEditingDateIdx] = useState<number | null>(null);

  const activeIds = new Set(members.map((m) => String(m.id)));
  const activeScores = vsData.membersScores.filter((m) => activeIds.has(String(m.id)));
  const memberRankById = new Map(members.map((m) => [String(m.id), m.rank || 'R1']));
  const memberOrderIndex = new Map(members.map((m, idx) => [String(m.id), idx]));

  const latestIdx = vsData.weeks.length > 0 ? vsData.weeks.length - 1 : -1;
  let top5: VsMemberScore[] = [];
  if (latestIdx >= 0) {
    top5 = [...activeScores].sort((a, b) => (b.scores[latestIdx] || 0) - (a.scores[latestIdx] || 0)).slice(0, 5);
  }
  const top5Ids = new Set(top5.map((m) => String(m.id)));

  const sorted = [...activeScores].sort((a, b) => {
    const ga = RANK_GROUP_ORDER[memberRankById.get(String(a.id)) || 'R1'] ?? 99;
    const gb = RANK_GROUP_ORDER[memberRankById.get(String(b.id)) || 'R1'] ?? 99;
    if (ga !== gb) return ga - gb;
    const sa = latestIdx >= 0 ? a.scores[latestIdx] || 0 : 0;
    const sb = latestIdx >= 0 ? b.scores[latestIdx] || 0 : 0;
    if (sa !== sb) return sb - sa;
    return (memberOrderIndex.get(String(a.id)) ?? 0) - (memberOrderIndex.get(String(b.id)) ?? 0);
  });

  const filtered = sorted.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const colSpan = 2 + vsData.weeks.length;
  let lastGroupKey: string | null = null;

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colRank}>#</th>
              <th className={styles.thMember}>Member</th>
              {vsData.weeks.map((wk, idx) => {
                const date = getWeekDate(wk);
                const type = getWeekType(wk);
                return (
                  <th key={idx}>
                    {editingDateIdx === idx ? (
                      <input
                        type="date"
                        className={styles.dateInlineInput}
                        defaultValue={formatDateForInput(date)}
                        autoFocus
                        onBlur={(e) => {
                          if (e.target.value) onChangeWeekDate(idx, formatDateForDisplay(e.target.value));
                          setEditingDateIdx(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    ) : (
                      <div
                        className={`${styles.dateLabel} ${isStaff ? styles.dateLabelEditable : ''} notranslate`}
                        onClick={() => isStaff && setEditingDateIdx(idx)}
                        title={isStaff ? 'Click to edit this date' : undefined}
                      >
                        {date}
                      </div>
                    )}
                    <div
                      className={`${styles.weekLabel} ${isStaff ? styles.weekLabelEditable : ''}`}
                      onClick={() => isStaff && onToggleWeekType(idx)}
                      title={isStaff ? 'Click to switch between Weekly and Daily' : undefined}
                    >
                      {type === 'daily' ? 'Daily' : 'Weekly'}
                    </div>
                    {isStaff && (
                      <button className={styles.removeDateBtn} onClick={() => onDeleteWeek(idx)}>
                        ✕
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className={styles.mutedCell}>
                  No members found.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const groupKey = memberRankById.get(String(m.id)) || 'R1';
                const showBar = groupKey !== lastGroupKey;
                lastGroupKey = groupKey;
                const barClass = (styles as Record<string, string>)['tier' + groupKey] || styles.tierR1;
                const medalRank = top5Ids.has(String(m.id)) ? top5.findIndex((t) => String(t.id) === String(m.id)) + 1 : null;
                const badgeClass = medalRank ? (styles as Record<string, string>)['r' + medalRank] : '';
                return (
                  <>
                    {showBar && (
                      <tr key={`g-${groupKey}-${m.id}`} className={styles.tierGroupBarRow}>
                        <td colSpan={colSpan}>
                          <div className={`${styles.tierGroupBar} ${barClass}`}>{groupKey}</div>
                        </td>
                      </tr>
                    )}
                    <tr key={m.id}>
                      <td className={styles.colRank}>{medalRank || '—'}</td>
                      <td className={styles.colMember}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {medalRank && <span className={`${styles.badgeRank} ${badgeClass}`} style={{ width: 20, height: 20, fontSize: 10 }}>{medalRank}</span>}
                          <span className="notranslate">{m.name}</span>
                        </div>
                      </td>
                      {vsData.weeks.map((wk, wIdx) => {
                        const score = m.scores[wIdx] || 0;
                        const isLow = score < getThreshold(getWeekType(wk));
                        return (
                          <td
                            key={wIdx}
                            className={`notranslate ${isStaff ? styles.scoreCell : ''} ${isLow ? styles.scoreCellLow : ''}`}
                            onClick={() => isStaff && onEditScore(m.id, wIdx)}
                          >
                            {score.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
