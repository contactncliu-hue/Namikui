import { useMemo } from 'react';
import styles from '../Events.module.css';
import type { EventDate, Member } from '../../../types';
import { RANK_GROUP_ORDER, memberRate, rateClass, attendanceWeight } from '../eventsUtils';

interface DayGroup {
  date: string;
  events: EventDate[];
}

interface Props {
  events: EventDate[];
  members: Member[];
  isStaff: boolean;
  collapsedDays: Set<string>;
  onToggleDay: (date: string) => void;
  onToggleAttendance: (memberId: number, eventId: number) => void;
  onCycleVote: (memberId: number, eventId: number) => void;
  onEditEvent: (event: EventDate) => void;
  getAttendanceStatus: (memberId: number, eventId: number) => boolean | 'late';
  getVote: (memberId: number, eventId: number) => 'yes' | 'no' | 'maybe' | null;
}

export default function AttendanceTable({
  events,
  members,
  isStaff,
  collapsedDays,
  onToggleDay,
  onToggleAttendance,
  onCycleVote,
  onEditEvent,
  getAttendanceStatus,
  getVote,
}: Props) {
  const dayGroups = useMemo(() => {
    const groups: DayGroup[] = [];
    [...events].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach((ev) => {
      let g = groups.find((x) => x.date === ev.date);
      if (!g) {
        g = { date: ev.date, events: [] };
        groups.push(g);
      }
      g.events.push(ev);
    });
    return groups;
  }, [events]);

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      const ga = RANK_GROUP_ORDER[a.rank] ?? 99;
      const gb = RANK_GROUP_ORDER[b.rank] ?? 99;
      return ga - gb;
    });
  }, [members]);

  const totalCols = 4 + dayGroups.reduce((s, g) => s + (collapsedDays.has(g.date) ? 1 : g.events.length), 0);

  const memberAttendedCount = (m: Member) =>
    events.reduce((s, ev) => s + attendanceWeight(getAttendanceStatus(m.id, ev.id)), 0);

  const eventTotal = (evs: EventDate[]) =>
    sorted.reduce(
      (s, m) => s + evs.reduce((s2, ev) => s2 + attendanceWeight(getAttendanceStatus(m.id, ev.id)), 0),
      0
    );

  let lastGroupKey: string | null = null;

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th colSpan={4} style={{ borderBottom: 'none' }} />
              {dayGroups.map((g) => {
                const isCollapsed = collapsedDays.has(g.date);
                const colspan = isCollapsed ? 1 : g.events.length;
                return (
                  <th key={g.date} colSpan={colspan} className={styles.dayGroupHeader} onClick={() => onToggleDay(g.date)}>
                    {g.events.length > 1 && <span className={styles.dayCollapseIcon}>{isCollapsed ? '+' : '−'}</span>}{' '}
                    <div className={`${styles.dayGroupDate} notranslate`}>{g.date}</div>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className={styles.colRank}>#</th>
              <th className={styles.colName}>MEMBER</th>
              <th className={styles.colAttended}>ATTENDED</th>
              <th className={styles.colPercentage}>RATE</th>
              {dayGroups.map((g) => {
                const isCollapsed = collapsedDays.has(g.date);
                if (isCollapsed) {
                  return (
                    <th key={g.date} className={`${styles.colEvent} ${styles.dayCollapsedCell}`} onClick={() => onToggleDay(g.date)}>
                      {g.events.length} events
                    </th>
                  );
                }
                return g.events.map((ev) => (
                  <th
                    key={ev.id}
                    className={`${styles.colEvent} ${ev.isWar ? styles.colEventWar : ''}`}
                    onClick={() => isStaff && onEditEvent(ev)}
                    style={{ cursor: isStaff ? 'pointer' : 'default' }}
                  >
                    <div className="notranslate">{ev.name}</div>
                  </th>
                ));
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className={styles.mutedCell}>
                  No members found.
                </td>
              </tr>
            ) : (
              sorted.map((m, idx) => {
                const groupKey = m.rank || 'R1';
                const showGroupBar = groupKey !== lastGroupKey;
                lastGroupKey = groupKey;
                const barClass = (styles as Record<string, string>)['group' + groupKey] || styles.groupR1;
                const attendedCount = memberAttendedCount(m);
                const rate = memberRate(attendedCount, events.length);
                const rc = rateClass(rate);
                return (
                  <>
                    {showGroupBar && (
                      <tr key={`g-${groupKey}-${m.id}`} className={styles.rankGroupBarRow}>
                        <td colSpan={totalCols}>
                          <div className={`${styles.rankGroupBar} ${barClass}`}>{groupKey}</div>
                        </td>
                      </tr>
                    )}
                    <tr key={m.id}>
                      <td className={styles.colRank}>{idx + 1}</td>
                      <td className={`${styles.colName} notranslate`}>{m.name}</td>
                      <td className={`${styles.colAttended} notranslate`}>
                        {attendedCount}/{events.length}
                      </td>
                      <td className={styles.colPercentage}>
                        <div className={styles.progressBarContainer}>
                          <div className={styles.progressBar}>
                            <div
                              className={`${styles.progressBarFill} ${styles['fill' + rc.charAt(0).toUpperCase() + rc.slice(1)]}`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className={`${styles.progressText} ${styles['attended' + rc.charAt(0).toUpperCase() + rc.slice(1)]}`}>
                            {rate.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      {dayGroups.map((g) => {
                        const isCollapsed = collapsedDays.has(g.date);
                        if (isCollapsed) {
                          const dayAttended = g.events.reduce((s, ev) => s + attendanceWeight(getAttendanceStatus(m.id, ev.id)), 0);
                          const dayTotal = g.events.length;
                          let dayClass = styles.dayCollapsedCell;
                          if (dayTotal > 0) {
                            if (dayAttended === dayTotal) dayClass += ' ' + styles.dayFull;
                            else if (dayAttended === 0) dayClass += ' ' + styles.dayZero;
                            else dayClass += ' ' + styles.dayPartial;
                          }
                          return (
                            <td key={g.date} className={`${dayClass} notranslate`} onClick={() => onToggleDay(g.date)}>
                              {dayAttended}/{dayTotal}
                            </td>
                          );
                        }
                        return g.events.map((ev) => {
                          const status = getAttendanceStatus(m.id, ev.id);
                          if (ev.isWar) {
                            const vote = getVote(m.id, ev.id) || 'none';
                            const voteClass = (styles as Record<string, string>)['vote' + vote.charAt(0).toUpperCase() + vote.slice(1)];
                            const voteLabel = vote === 'none' ? '—' : vote.toUpperCase();
                            const attendLabel = status === 'late' ? 'LATE' : status ? 'ATTENDED' : 'NOT ATTENDED';
                            const attendClass = status === 'late' ? styles.pillLate : status ? styles.pillYes : styles.pillNo;
                            return (
                              <td key={ev.id} className={`${styles.colEvent} ${styles.colEventWar}`}>
                                <div className={styles.warCell}>
                                  <button
                                    className={`${styles.attendPill} ${attendClass}`}
                                    onClick={() => isStaff && onToggleAttendance(m.id, ev.id)}
                                    disabled={!isStaff}
                                  >
                                    {attendLabel}
                                  </button>
                                  <button
                                    className={`${styles.warVoteBadge} ${voteClass}`}
                                    onClick={() => isStaff && onCycleVote(m.id, ev.id)}
                                    disabled={!isStaff}
                                  >
                                    {voteLabel}
                                  </button>
                                </div>
                              </td>
                            );
                          }
                          let icon = <span className={styles.crossIcon}>✕</span>;
                          if (status === true) icon = <span className={styles.checkIcon}>✓</span>;
                          else if (status === 'late') icon = <span className={styles.lateIcon}>L</span>;
                          return (
                            <td key={ev.id} className={styles.colEvent}>
                              <span
                                className={styles.checkToggle}
                                onClick={() => isStaff && onToggleAttendance(m.id, ev.id)}
                                style={{ cursor: isStaff ? 'pointer' : 'default' }}
                              >
                                {icon}
                              </span>
                            </td>
                          );
                        });
                      })}
                    </tr>
                  </>
                );
              })
            )}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              {(['ATTENDED', 'NOT ATTENDED'] as const).map((label) => (
                <tr key={label}>
                  <td colSpan={4} style={{ padding: 12, fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)' }}>
                    {label}
                  </td>
                  {dayGroups.map((g) => {
                    const cellGroups = collapsedDays.has(g.date) ? [g.events] : g.events.map((ev) => [ev]);
                    return cellGroups.map((evs, i) => {
                      const att = eventTotal(evs);
                      const val = label === 'ATTENDED' ? att : sorted.length * evs.length - att;
                      return (
                        <td
                          key={`${g.date}-${i}`}
                          className={`${styles.colEvent} notranslate`}
                          style={{ fontWeight: 800, color: label === 'ATTENDED' ? 'green' : 'crimson' }}
                        >
                          {val}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}
              <tr>
                <td colSpan={totalCols} style={{ padding: 12, fontSize: 11, fontWeight: 800, color: 'var(--color-text-muted)' }}>
                  Showing {sorted.length} members
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
