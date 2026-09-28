import { useEffect, useState } from 'react';
import styles from './BlackGold.module.css';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { readRowByKey, writeRowByKey } from '../../lib/appData';
import { activeMembers } from '../Events/eventsUtils';
import { sortDates, getEntry, parseDateString } from './blackGoldUtils';
import ABTable from './components/ABTable';
import AttendanceTable from './components/AttendanceTable';
import CalendarTab from './components/CalendarTab';
import type { BlackGoldAssignments, BlackGoldDate, BlackGoldEntry } from './blackGoldTypes';

type Tab = 'ab' | 'attendance' | 'calendar';

export function BlackGold() {
  const { currentUser } = useAuth();
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'management';
  const { members, loading } = useAppData();
  const active = activeMembers(members);

  const [dates, setDates] = useState<BlackGoldDate[]>([]);
  const [assignments, setAssignments] = useState<BlackGoldAssignments>({});
  const [bgLoading, setBgLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('ab');
  const [search, setSearch] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    (async () => {
      const [d, a] = await Promise.all([
        readRowByKey<BlackGoldDate[]>('blackGoldDates'),
        readRowByKey<BlackGoldAssignments>('blackGoldAssignments'),
      ]);
      setDates(d && Array.isArray(d) ? sortDates(d) : []);
      setAssignments(a && typeof a === 'object' ? a : {});
      setBgLoading(false);
    })();
  }, []);

  const persistDates = async (next: BlackGoldDate[]): Promise<boolean> => {
    const sorted = sortDates(next);
    const ok = await writeRowByKey('blackGoldDates', sorted);
    if (!ok) {
      alert('Could not save. Please try again.');
      return false;
    }
    setDates(sorted);
    return true;
  };

  const persistAssignments = async (updater: (cur: BlackGoldAssignments) => BlackGoldAssignments): Promise<boolean> => {
    const current = (await readRowByKey<BlackGoldAssignments>('blackGoldAssignments')) ?? {};
    const next = updater(current);
    const ok = await writeRowByKey('blackGoldAssignments', next);
    if (!ok) {
      alert('Could not save. Please try again.');
      return false;
    }
    setAssignments(next);
    return true;
  };

  const updateEntry = (memberId: number, dateId: string, patch: Partial<BlackGoldEntry>) => {
    void persistAssignments((cur) => {
      const memberKey = String(memberId);
      const current = cur[memberKey]?.[dateId] ?? { slot: null, attended: false, playerRole: null };
      return { ...cur, [memberKey]: { ...(cur[memberKey] || {}), [dateId]: { ...current, ...patch } } };
    });
  };

  const cycleSlot = (memberId: number, dateId: string) => {
    if (!isStaff) return;
    const entry = getEntry(assignments, memberId, dateId);
    const next = entry.slot === null ? 'A' : entry.slot === 'A' ? 'B' : null;
    updateEntry(memberId, dateId, { slot: next });
  };

  const toggleAttended = (memberId: number, dateId: string) => {
    if (!isStaff) return;
    const entry = getEntry(assignments, memberId, dateId);
    updateEntry(memberId, dateId, { attended: !entry.attended });
  };

  const cycleRole = (memberId: number, dateId: string) => {
    if (!isStaff) return;
    const entry = getEntry(assignments, memberId, dateId);
    const next = entry.playerRole === null ? 'main' : entry.playerRole === 'main' ? 'sub' : null;
    updateEntry(memberId, dateId, { playerRole: next });
  };

  const editDate = async (dateId: string) => {
    if (!isStaff) return;
    const d = dates.find((x) => x.id === dateId);
    if (!d) return;
    const newVal = window.prompt('Edit date (Format: MM-DD-YYYY):', d.date);
    if (newVal === null) return;
    const trimmed = newVal.trim();
    if (!trimmed) {
      alert('Date cannot be empty.');
      return;
    }
    let formatted = trimmed;
    const parts = trimmed.split('-');
    if (parts.length === 3 && parts[0].length === 4) formatted = `${parts[1]}-${parts[2]}-${parts[0]}`;
    if (dates.some((x) => x.id !== dateId && x.date === formatted)) {
      alert('Another session with this date already exists.');
      return;
    }
    await persistDates(dates.map((x) => (x.id === dateId ? { ...x, date: formatted } : x)));
  };

  const removeDate = async (dateId: string) => {
    if (!isStaff) return;
    const d = dates.find((x) => x.id === dateId);
    if (!window.confirm(`Remove session "${d ? d.date : ''}"? This also clears all slots, attendance, and role markers for it.`)) return;
    await persistDates(dates.filter((x) => x.id !== dateId));
    await persistAssignments((cur) => {
      const next: BlackGoldAssignments = {};
      Object.keys(cur).forEach((memberKey) => {
        const memberEntries = { ...cur[memberKey] };
        delete memberEntries[dateId];
        next[memberKey] = memberEntries;
      });
      return next;
    });
  };

  const addDate = async () => {
    if (!isStaff || !newDate) {
      alert('Please select a date.');
      return;
    }
    const parts = newDate.split('-');
    const formatted = `${parts[1]}-${parts[2]}-${parts[0]}`;
    if (dates.some((d) => d.date === formatted)) {
      alert('This date is already added.');
      return;
    }
    const ok = await persistDates([...dates, { id: 'd' + Date.now(), date: formatted }]);
    if (ok) setNewDate('');
  };

  const filtered = active.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const isLoading = loading || bgLoading;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Black Gold</h1>
        <div className={`${styles.pageSubtitle} notranslate`}>
          {active.length} members · {dates.length} sessions
        </div>
      </div>

      <div className={styles.toolbarCard}>
        <div className={styles.tabSwitch}>
          <button className={`${styles.tabBtn} ${tab === 'ab' ? styles.tabBtnActive : ''}`} onClick={() => setTab('ab')}>
            A / B SLOTS
          </button>
          <button className={`${styles.tabBtn} ${tab === 'attendance' ? styles.tabBtnActive : ''}`} onClick={() => setTab('attendance')}>
            ATTENDANCE
          </button>
          <button className={`${styles.tabBtn} ${tab === 'calendar' ? styles.tabBtnActive : ''}`} onClick={() => setTab('calendar')}>
            CALENDAR
          </button>
        </div>
        {(tab === 'ab' || tab === 'attendance') && (
          <div className={styles.searchBox}>
            <input type="text" className={styles.searchInput} placeholder="🔍 Search member..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}
        {isStaff && (
          <div className={styles.toolbarRight}>
            <input type="date" className={styles.dateInput} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            <button className={styles.btnGold} onClick={() => void addDate()}>
              + ADD DATE
            </button>
          </div>
        )}
      </div>

      {(tab === 'ab' || tab === 'attendance') && (
        <div className={styles.legendRow}>
          <div className={styles.legendItem}>
            <span className={`${styles.slotBadge} ${styles.slotBadgeA}`}>A</span> Slot A
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.slotBadge} ${styles.slotBadgeB}`}>B</span> Slot B
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.slotBadge} ${styles.slotBadgeUnassigned}`} /> Unassigned
          </div>
          <div className={styles.legendItem}>
            <span className={styles.statusBadge} style={{ background: '#fce8e6', color: '#d9381e', border: '1px solid #d9381e' }}>
              Not Attended
            </span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.statusBadge} style={{ background: '#e6f4ea', color: '#1f9d55', border: '1px solid #1f9d55' }}>
              Attended
            </span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.statusBadge} style={{ background: '#ffb000', color: '#3d2c00', border: '1px solid #c98c00' }}>
              Main Player
            </span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.statusBadge} style={{ background: '#c8e0dd', color: '#1e3a38', border: '1px solid #95b8b5' }}>
              Substitute
            </span>
          </div>
          {isStaff && (
            <span className={styles.legendHint}>
              {tab === 'attendance'
                ? '· Members are grouped by rank (color bar per group). Missing an assigned slot starts a 14-day countdown. After 14 days with no Attended mark, a 2-week penalty locks in.'
                : '· Unassigned slots count as 0 penalty. Penalties count only for passed weeks where a member was assigned and did not attend. Click any date header to edit it.'}
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Loading…</div>
      ) : tab === 'ab' ? (
        <ABTable
          dates={dates}
          members={filtered}
          assignments={assignments}
          canEdit={isStaff}
          onEditDate={(id) => void editDate(id)}
          onRemoveDate={(id) => void removeDate(id)}
          onCycleSlot={cycleSlot}
          onToggleAttended={toggleAttended}
          onCycleRole={cycleRole}
        />
      ) : tab === 'attendance' ? (
        <AttendanceTable
          dates={dates}
          members={filtered}
          assignments={assignments}
          canEdit={isStaff}
          onEditDate={(id) => void editDate(id)}
          onRemoveDate={(id) => void removeDate(id)}
          onCycleSlot={cycleSlot}
          onToggleAttended={toggleAttended}
          onCycleRole={cycleRole}
        />
      ) : (
        <CalendarTab
          dates={dates}
          members={active}
          assignments={assignments}
          canEdit={isStaff}
          onEditDate={(id) => void editDate(id)}
          onRemoveDate={(id) => void removeDate(id)}
        />
      )}

      <div className={styles.pageFooter}>
        <span className="notranslate">
          {filtered.length}/{active.length} members shown
        </span>
      </div>
    </div>
  );
}

export default BlackGold;
