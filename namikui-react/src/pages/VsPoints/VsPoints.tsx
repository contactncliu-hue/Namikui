import { useEffect, useMemo, useState } from 'react';
import styles from './VsPoints.module.css';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { readRowByKey, writeRowByKey } from '../../lib/appData';
import { activeMembers } from '../Events/eventsUtils';
import { getWeekDate, parseDateString } from './vsUtils';
import WeeklyTable from './components/WeeklyTable';
import RankingCards from './components/RankingCards';
import DateSelectModal from './components/DateSelectModal';
import ArchivesModal from './components/ArchivesModal';
import type { Member, VsArchiveEntry, VsData, VsWeekEntry } from '../../types';

type Tab = 'weekly' | 'ranking';
type RankingSort = 'default' | 'points';

const EMPTY_VS_DATA: VsData = { weeks: [], membersScores: [], cycleDates: [], archives: [] };

// Ensures every active member has a scores row, drops removed members, and
// sorts weeks/scores together by date. Runs on load AND after every edit so
// the page always reflects the current Members roster, not a stale snapshot.
function normalizeVsData(data: VsData, active: Member[]): VsData {
  const next: VsData = {
    ...data,
    weeks: [...data.weeks],
    membersScores: data.membersScores.map((m) => ({ ...m, scores: [...m.scores] })),
  };
  active.forEach((m) => {
    const existing = next.membersScores.find((s) => String(s.id) === String(m.id));
    if (!existing) {
      next.membersScores.push({ id: m.id, name: m.name, scores: next.weeks.map(() => 0) });
    } else {
      existing.name = m.name;
    }
  });
  const activeIds = new Set(active.map((m) => String(m.id)));
  next.membersScores = next.membersScores.filter((s) => activeIds.has(String(s.id)));

  if (next.weeks.length > 1) {
    const combined = next.weeks.map((wk, idx) => ({
      week: wk,
      scoresArr: next.membersScores.map((m) => m.scores[idx] ?? 0),
    }));
    combined.sort((a, b) => parseDateString(getWeekDate(a.week)).getTime() - parseDateString(getWeekDate(b.week)).getTime());
    next.weeks = combined.map((c) => c.week);
    next.membersScores.forEach((m, mIdx) => {
      m.scores = combined.map((c) => c.scoresArr[mIdx]);
    });
  }
  return next;
}

export function VsPoints() {
  const { currentUser } = useAuth();
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'management';
  const { members, loading, refresh } = useAppData();

  const active = useMemo(() => activeMembers(members), [members]);

  const [rawVsData, setRawVsData] = useState<VsData | null>(null);
  const [vsLoading, setVsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('weekly');
  const [rankingSort, setRankingSort] = useState<RankingSort>('default');
  const [search, setSearch] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState<'weekly' | 'daily'>('weekly');
  const [cycleModalOpen, setCycleModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivesViewOpen, setArchivesViewOpen] = useState(false);

  // Load vsData once (AppDataContext doesn't carry this row, since it's keyed, not fixed-id).
  useEffect(() => {
    (async () => {
      const data = await readRowByKey<VsData>('vsData');
      setRawVsData(data && Array.isArray(data.weeks) ? data : EMPTY_VS_DATA);
      setVsLoading(false);
    })();
  }, []);

  // Re-derive the displayed vsData from the raw row + the live Members roster
  // every time either changes, so a member added/removed elsewhere shows up
  // here immediately instead of only after the next VS Points edit.
  const vsData = useMemo(() => {
    if (rawVsData === null) return EMPTY_VS_DATA;
    return normalizeVsData(rawVsData, active);
  }, [rawVsData, active]);

  const persist = async (updater: (cur: VsData) => VsData): Promise<boolean> => {
    const current = (await readRowByKey<VsData>('vsData')) ?? EMPTY_VS_DATA;
    const next = normalizeVsData(updater(current), active);
    const ok = await writeRowByKey('vsData', next);
    if (!ok) {
      alert('Could not save. Please try again.');
      return false;
    }
    setRawVsData(next);
    return true;
  };

  const cycleIndices = useMemo(() => {
    if (!vsData.cycleDates || vsData.cycleDates.length === 0) return vsData.weeks.map((_, i) => i);
    const set = new Set(vsData.cycleDates);
    return vsData.weeks.map((wk, i) => ({ i, d: getWeekDate(wk) })).filter((w) => set.has(w.d)).map((w) => w.i);
  }, [vsData]);

  const cycleInfoText = useMemo(() => {
    if (!vsData.cycleDates || vsData.cycleDates.length === 0) return 'No cycle dates selected — Ranking tab shows all sessions';
    const sorted = [...vsData.cycleDates].sort((a, b) => parseDateString(a).getTime() - parseDateString(b).getTime());
    const preview = sorted.length > 4 ? `${sorted.slice(0, 4).join(', ')} +${sorted.length - 4} more` : sorted.join(', ');
    return `${sorted.length} date${sorted.length === 1 ? '' : 's'} selected: ${preview}`;
  }, [vsData.cycleDates]);

  const addWeek = async () => {
    if (!isStaff || !newDate) {
      alert('Please select a date.');
      return;
    }
    const parts = newDate.split('-');
    const formatted = `${parts[1]}-${parts[2]}-${parts[0]}`;
    if (vsData.weeks.some((w) => getWeekDate(w) === formatted)) {
      alert('A column for this date already exists.');
      return;
    }
    const entry: VsWeekEntry = { date: formatted, type: newType };
    const ok = await persist((cur) => ({ ...cur, weeks: [...cur.weeks, entry], membersScores: cur.membersScores.map((m) => ({ ...m, scores: [...m.scores, 0] })) }));
    if (ok) setNewDate('');
  };

  const deleteWeek = async (weekIdx: number) => {
    if (!isStaff) return;
    const target = getWeekDate(vsData.weeks[weekIdx]);
    if (!window.confirm(`Remove session date ${target}?`)) return;
    await persist((cur) => {
      const weeks = cur.weeks.filter((_, i) => i !== weekIdx);
      const membersScores = cur.membersScores.map((m) => ({ ...m, scores: m.scores.filter((_, i) => i !== weekIdx) }));
      const cycleDates = (cur.cycleDates || []).filter((d) => d !== target);
      return { ...cur, weeks, membersScores, cycleDates };
    });
  };

  const changeWeekDate = async (weekIdx: number, newDateStr: string) => {
    if (!isStaff) return;
    const currentDate = getWeekDate(vsData.weeks[weekIdx]);
    if (newDateStr === currentDate) return;
    if (vsData.weeks.some((w, i) => i !== weekIdx && getWeekDate(w) === newDateStr)) {
      alert('A column for this date already exists.');
      return;
    }
    await persist((cur) => {
      const weeks = cur.weeks.map((w, i) => (i === weekIdx ? { date: newDateStr, type: typeof w === 'object' ? w.type : 'weekly' } : w));
      const cycleDates = (cur.cycleDates || []).map((d) => (d === currentDate ? newDateStr : d));
      return { ...cur, weeks, cycleDates };
    });
  };

  const toggleWeekType = async (weekIdx: number) => {
    if (!isStaff) return;
    await persist((cur) => {
      const wk = cur.weeks[weekIdx];
      const currentType = typeof wk === 'object' && wk.type ? wk.type : 'weekly';
      const nextType = currentType === 'daily' ? 'weekly' : 'daily';
      const weeks = cur.weeks.map((w, i) => (i === weekIdx ? { date: getWeekDate(w), type: nextType as 'weekly' | 'daily' } : w));
      return { ...cur, weeks };
    });
  };

  const editScore = async (memberId: number, weekIdx: number) => {
    if (!isStaff) return;
    const scoreEntry = vsData.membersScores.find((m) => String(m.id) === String(memberId));
    if (!scoreEntry) return;
    const newVal = window.prompt(`Edit score for ${scoreEntry.name} (${getWeekDate(vsData.weeks[weekIdx])}):`, String(scoreEntry.scores[weekIdx] || 0));
    if (newVal === null) return;
    const parsed = parseFloat(newVal) || 0;
    await persist((cur) => ({
      ...cur,
      membersScores: cur.membersScores.map((m) => (String(m.id) === String(memberId) ? { ...m, scores: m.scores.map((s, i) => (i === weekIdx ? parsed : s)) } : m)),
    }));
  };

  const saveCycleDates = async (selectedDates: string[]) => {
    const ok = await persist((cur) => ({ ...cur, cycleDates: selectedDates }));
    if (ok) setCycleModalOpen(false);
  };

  const archiveSelected = async (selectedDates: string[]) => {
    if (selectedDates.length === 0) {
      alert('Please select at least one date to archive.');
      return;
    }
    if (!window.confirm(`Archive ${selectedDates.length} selected date(s)? Their totals are saved, then removed from the live table.`)) return;
    const ok = await persist((cur) => {
      const selectedSet = new Set(selectedDates);
      const idxs = cur.weeks.map((w, i) => ({ i, d: getWeekDate(w) })).filter((w) => selectedSet.has(w.d)).map((w) => w.i);
      const archivedWeeks = idxs.map((i) => cur.weeks[i]);
      const membersTotals = cur.membersScores.map((m) => ({ id: m.id, name: m.name, total: idxs.reduce((sum, i) => sum + (m.scores[i] || 0), 0) }));
      const idxSet = new Set(idxs);
      const weeks = cur.weeks.filter((_, i) => !idxSet.has(i));
      const membersScores = cur.membersScores.map((m) => ({ ...m, scores: m.scores.filter((_, i) => !idxSet.has(i)) }));
      const archives: VsArchiveEntry[] = [
        ...(cur.archives || []),
        { cycleStartDate: cur.cycleStartDate ?? null, cycleEndDate: new Date().toISOString().split('T')[0], weeks: archivedWeeks, membersTotals },
      ];
      const cycleDates = (cur.cycleDates || []).filter((d) => !selectedSet.has(d));
      return { ...cur, weeks, membersScores, archives, cycleDates };
    });
    if (ok) {
      setArchiveModalOpen(false);
      alert(`Archived ${selectedDates.length} date(s).`);
    }
  };

  const deleteArchiveEntry = async (index: number) => {
    const arc = (vsData.archives || [])[index];
    if (!arc) return;
    if (!window.confirm(`Permanently delete the archived cycle from ${arc.cycleStartDate || '—'} to ${arc.cycleEndDate || '—'}? This cannot be undone.`)) return;
    await persist((cur) => ({ ...cur, archives: (cur.archives || []).filter((_, i) => i !== index) }));
  };

  const isLoading = loading || vsLoading;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>VS Points</h1>
        <div className={`${styles.pageSubtitle} notranslate`}>
          {active.length} members · {vsData.weeks.length} sessions
        </div>
      </div>

      <div className={styles.toolbarCard}>
        <div className={styles.tabToggles}>
          <button className={`${styles.subTab} ${tab === 'weekly' ? styles.subTabActive : ''}`} onClick={() => setTab('weekly')}>
            TABLE
          </button>
          <button className={`${styles.subTab} ${tab === 'ranking' ? styles.subTabActive : ''}`} onClick={() => setTab('ranking')}>
            🏆 RANKING
          </button>
        </div>
        <div className={styles.searchBox}>
          <input type="text" className={styles.searchInput} placeholder="🔍 Search member..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {isStaff && (
          <div className={styles.toolbarRight}>
            <input type="date" className={styles.dateInput} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <select className={styles.dateInput} value={newType} onChange={(e) => setNewType(e.target.value as 'weekly' | 'daily')}>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
            <button className={styles.btnGold} onClick={() => void addWeek()}>
              + ADD DATE
            </button>
          </div>
        )}
      </div>

      <div className={styles.toolbarCard}>
        <div>
          <div className={styles.cycleLabel}>Ranking Cycle</div>
          <div className={`${styles.cycleValue} notranslate`}>{cycleInfoText}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {isStaff && (
            <>
              <button className={styles.btnAction} onClick={() => setCycleModalOpen(true)}>
                📅 SELECT CYCLE DATES
              </button>
              <button className={styles.btnGold} onClick={() => setArchiveModalOpen(true)}>
                📦 ARCHIVE DATES
              </button>
            </>
          )}
          <button className={styles.btnAction} onClick={() => setArchivesViewOpen(true)}>
            🗂 VIEW ARCHIVES ({(vsData.archives || []).length})
          </button>
        </div>
      </div>

      <div className={styles.legendRow}>
        <span>TOP 5:</span>
        <span className={styles.badgeRank + ' ' + styles.r1}>1</span>
        <span className={styles.badgeRank + ' ' + styles.r2}>2</span>
        <span className={styles.badgeRank + ' ' + styles.r3}>3</span>
        <span className={styles.badgeRank + ' ' + styles.r4}>4</span>
        <span className={styles.badgeRank + ' ' + styles.r5}>5</span>
        <span className={styles.hint}>
          {isStaff ? '· Admin/Mgmt: click any table cell (or ranking score) to edit points. Click a date to edit it. Click Weekly/Daily to change session type.' : '· Viewing mode'}
        </span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Loading…</div>
      ) : tab === 'weekly' ? (
        <WeeklyTable
          vsData={vsData}
          members={active}
          isStaff={isStaff}
          search={search}
          onEditScore={(mid, wIdx) => void editScore(mid, wIdx)}
          onDeleteWeek={(idx) => void deleteWeek(idx)}
          onChangeWeekDate={(idx, d) => void changeWeekDate(idx, d)}
          onToggleWeekType={(idx) => void toggleWeekType(idx)}
        />
      ) : (
        <>
          <div className={styles.toolbarCard}>
            <span className={styles.cycleLabel}>Sort Ranking By:</span>
            <div className={styles.tabToggles}>
              <button className={`${styles.subTab} ${rankingSort === 'default' ? styles.subTabActive : ''}`} onClick={() => setRankingSort('default')}>
                DEFAULT
              </button>
              <button className={`${styles.subTab} ${rankingSort === 'points' ? styles.subTabActive : ''}`} onClick={() => setRankingSort('points')}>
                BY POINTS
              </button>
            </div>
          </div>
          <RankingCards
            vsData={vsData}
            members={active}
            cycleIndices={cycleIndices}
            search={search}
            isStaff={isStaff}
            sortMode={rankingSort}
            onEditScore={(mid, wIdx) => void editScore(mid, wIdx)}
          />
        </>
      )}

      <div className={styles.pageFooter}>
      </div>

      {cycleModalOpen && (
        <DateSelectModal
          title="Select Ranking Cycle Dates"
          description="Choose which session dates count toward the current Ranking Cycle. Nothing is deleted; the Table tab keeps showing every session."
          vsData={vsData}
          initiallyChecked={(d) => (vsData.cycleDates || []).includes(d)}
          confirmLabel="✔ SAVE CYCLE DATES"
          onClose={() => setCycleModalOpen(false)}
          onConfirm={saveCycleDates}
        />
      )}
      {archiveModalOpen && (
        <DateSelectModal
          title="Select Dates to Archive"
          description="Choose which session dates to move into the archive. Their totals are saved, then those dates are removed from the live table."
          vsData={vsData}
          initiallyChecked={() => true}
          confirmLabel="📦 ARCHIVE SELECTED"
          onClose={() => setArchiveModalOpen(false)}
          onConfirm={archiveSelected}
        />
      )}
      {archivesViewOpen && (
        <ArchivesModal
          archives={vsData.archives || []}
          isStaff={isStaff}
          onClose={() => setArchivesViewOpen(false)}
          onDeleteEntry={(i) => void deleteArchiveEntry(i)}
        />
      )}
    </div>
  );
}

export default VsPoints;
