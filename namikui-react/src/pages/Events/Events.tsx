import { useMemo, useState } from 'react';
import styles from './Events.module.css';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { ROW, mutateRow, mutateRowByKey } from '../../lib/appData';
import { activeMembers, rateClass } from './eventsUtils';
import AttendanceTable from './components/AttendanceTable';
import RankingList from './components/RankingList';
import WarTable from './components/WarTable';
import EditEventModal from './components/EditEventModal';
import ImportReviewModal, { ImportRow } from './components/ImportReviewModal';
import { fileToBase64, callEventsOcrWithRetry, findBestMemberMatch, sleep } from './importUtils';
import type { AttendanceMap, EventDate, EventVotesMap, Member } from '../../types';

type Tab = 'attendance' | 'ranking' | 'war';

interface Snapshot {
  id: number;
  timestamp: string;
  user: string;
  eventDates: EventDate[];
  members: Member[];
  attendance: AttendanceMap;
  eventVotes: EventVotesMap;
}
const MAX_SNAPSHOTS = 15;

export function Events() {
  const { currentUser } = useAuth();
  const username = currentUser.username ?? 'Unknown';
  const role = currentUser.role;
  const isStaff = role === 'admin' || role === 'management';

  const { eventDates, members, attendanceMap, eventVotesMap, loading, refresh, getAttendanceStatus } = useAppData();

  const [tab, setTab] = useState<Tab>('attendance');
  const [search, setSearch] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [rankingSort, setRankingSort] = useState<'default' | 'rank'>('default');
  const [warSort, setWarSort] = useState<'default' | 'rank'>('default');
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const [editingEvent, setEditingEvent] = useState<EventDate | null>(null);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newIsWar, setNewIsWar] = useState(false);

  // --- Screenshot import state ---
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('📥 IMPORT WAR EVENT');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRows, setReviewRows] = useState<ImportRow[]>([]);
  const [reviewMatchedCount, setReviewMatchedCount] = useState(0);
  const [reviewRawText, setReviewRawText] = useState('');
  const [reviewName, setReviewName] = useState('');
  const [reviewDate, setReviewDate] = useState('');
  const [reviewIsWar, setReviewIsWar] = useState(true);

  const active = activeMembers(members);
  const filtered = active.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  const getVote = (memberId: number, eventId: number): 'yes' | 'no' | 'maybe' | null => {
    const m = eventVotesMap[memberId];
    return m ? m[eventId] ?? null : null;
  };

  const toggleDay = (date: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // Snapshot of the four event-related rows, captured before every save so any
  // bad write can be rolled back from the History tab.
  const captureSnapshot = async () => {
    const snapshot: Snapshot = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp: new Date().toLocaleString(),
      user: username,
      eventDates,
      members,
      attendance: attendanceMap,
      eventVotes: eventVotesMap,
    };
    await mutateRow<Snapshot>(ROW.dataSnapshots, 'dataSnapshots', (cur) => [snapshot, ...cur].slice(0, MAX_SNAPSHOTS));
  };

  const addEvent = async () => {
    if (!isStaff) return;
    if (!newName.trim() || !newDate) {
      alert('Please enter an event name and date.');
      return;
    }
    await captureSnapshot();
    const newEvent: EventDate = { id: Date.now(), name: newName.trim(), date: newDate, isWar: newIsWar };
    const ok = await mutateRow<EventDate>(ROW.eventDates, 'eventDates', (cur) => [...cur, newEvent]);
    if (!ok) {
      alert('Could not add the event. Please try again.');
      return;
    }
    setNewName('');
    setNewDate('');
    setNewIsWar(false);
    await refresh();
  };

  const saveEvent = async (fields: { name: string; date: string; isWar: boolean }) => {
    if (!editingEvent) return;
    await captureSnapshot();
    const ok = await mutateRow<EventDate>(ROW.eventDates, 'eventDates', (cur) =>
      cur.map((ev) => (ev.id === editingEvent.id ? { ...ev, ...fields } : ev))
    );
    if (!ok) {
      alert('Could not save the event. Please try again.');
      return;
    }
    setEditingEvent(null);
    await refresh();
  };

  const deleteEvent = async () => {
    if (!editingEvent) return;
    const deletedId = editingEvent.id;
    await captureSnapshot();
    const okEvents = await mutateRow<EventDate>(ROW.eventDates, 'eventDates', (cur) => cur.filter((ev) => ev.id !== deletedId));

    const okAttendance = await mutateRowByKey<AttendanceMap>('attendance', {}, (cur) => {
      const next: AttendanceMap = { ...cur };
      Object.keys(next).forEach((mid) => {
        const m = { ...next[Number(mid)] };
        delete m[deletedId];
        if (Object.keys(m).length === 0) delete next[Number(mid)];
        else next[Number(mid)] = m;
      });
      return next;
    });
    const okVotes = await mutateRowByKey<EventVotesMap>('eventVotes', {}, (cur) => {
      const next: EventVotesMap = { ...cur };
      Object.keys(next).forEach((mid) => {
        const m = { ...next[Number(mid)] };
        delete m[deletedId];
        if (Object.keys(m).length === 0) delete next[Number(mid)];
        else next[Number(mid)] = m;
      });
      return next;
    });

    if (!okEvents || !okAttendance || !okVotes) {
      alert('The delete only partly completed. Please refresh and check the event list.');
    }
    setEditingEvent(null);
    await refresh();
  };

  const toggleAttendance = async (memberId: number, eventId: number) => {
    if (!isStaff) return;
    await captureSnapshot();
    const ok = await mutateRowByKey<AttendanceMap>('attendance', {}, (cur) => {
      const next: AttendanceMap = { ...cur, [memberId]: { ...(cur[memberId] || {}) } };
      const curVal = next[memberId][eventId];
      if (!curVal) next[memberId][eventId] = true;
      else if (curVal === true) next[memberId][eventId] = 'late';
      else {
        delete next[memberId][eventId];
        if (Object.keys(next[memberId]).length === 0) delete next[memberId];
      }
      return next;
    });
    if (!ok) {
      alert('Could not save attendance. Please try again.');
      return;
    }
    await refresh();
  };

  const cycleVote = async (memberId: number, eventId: number) => {
    if (!isStaff) return;
    await captureSnapshot();
    const order: Array<'yes' | 'maybe' | 'no' | null> = [null, 'yes', 'maybe', 'no'];
    const ok = await mutateRowByKey<EventVotesMap>('eventVotes', {}, (cur) => {
      const next: EventVotesMap = { ...cur, [memberId]: { ...(cur[memberId] || {}) } };
      const curVote = next[memberId][eventId] || null;
      const idx = order.indexOf(curVote);
      const nextVote = order[(idx + 1) % order.length];
      if (nextVote === null) {
        delete next[memberId][eventId];
        if (Object.keys(next[memberId]).length === 0) delete next[memberId];
      } else {
        next[memberId][eventId] = nextVote;
      }
      return next;
    });
    if (!ok) {
      alert('Could not save the vote. Please try again.');
      return;
    }
    await refresh();
  };

  // --- Screenshot import: OCR → fuzzy match → review modal → apply ---
  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isStaff) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setImporting(true);

    const allNames: string[] = [];
    const rawParts: string[] = [];
    const failed: { name: string; reason: string }[] = [];
    let firstEventName = '';

    const SPACING_MS = 7000;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setImportStatus(`READING ${i + 1}/${files.length}…`);
      try {
        const imageBase64 = await fileToBase64(file);
        const result = await callEventsOcrWithRetry(imageBase64, file.type || 'image/png', file.name, setImportStatus);
        if (result.member_names?.length) allNames.push(...result.member_names);
        if (!firstEventName && result.war_event) firstEventName = result.war_event;
        rawParts.push(`--- ${file.name} ---\n${result.raw || JSON.stringify(result, null, 2)}`);
      } catch (err: any) {
        failed.push({ name: file.name, reason: err.message || String(err) });
        rawParts.push(`--- ${file.name} ---\n(FAILED: ${err.message || err})`);
      }
      if (i < files.length - 1) {
        setImportStatus('PAUSING…');
        await sleep(SPACING_MS);
      }
    }

    if (failed.length > 0) {
      alert(`${failed.length} screenshot(s) failed:\n\n${failed.map((f) => `${f.name}: ${f.reason}`).join('\n\n')}`);
    }

    const matched: ImportRow[] = [];
    const unmatched: ImportRow[] = [];
    const claimed = new Set<string>();
    allNames.forEach((name) => {
      const { member, score } = findBestMemberMatch(name, active);
      if (member && score >= 0.55 && !claimed.has(String(member.id))) {
        claimed.add(String(member.id));
        matched.push({ rawText: name, memberId: String(member.id), confidence: score, include: true });
      } else {
        unmatched.push({ rawText: name, memberId: member ? String(member.id) : '', confidence: member ? score : null, include: false });
      }
    });

    setReviewRows([...matched, ...unmatched]);
    setReviewMatchedCount(matched.length);
    setReviewRawText(rawParts.join('\n\n'));
    setReviewName(firstEventName || 'Imported War Event');
    setReviewDate(new Date().toISOString().split('T')[0]);
    setReviewIsWar(true);
    setReviewOpen(true);

    setImporting(false);
    setImportStatus('📥 IMPORT WAR EVENT');
    e.target.value = '';
  };

  const applyImport = async () => {
    if (!isStaff) return;
    await captureSnapshot();
    const newEvent: EventDate = { id: Date.now(), name: reviewName.trim() || 'Imported War Event', date: reviewDate, isWar: reviewIsWar };
    const okEvents = await mutateRow<EventDate>(ROW.eventDates, 'eventDates', (cur) => [...cur, newEvent]);
    if (!okEvents) {
      alert('Could not add the event. Please try again.');
      return;
    }

    let appliedCount = 0;
    const okAttendance = await mutateRowByKey<AttendanceMap>('attendance', {}, (cur) => {
      const next: AttendanceMap = { ...cur };
      reviewRows.forEach((r) => {
        if (!r.include || !r.memberId) return;
        const mid = Number(r.memberId);
        next[mid] = { ...(next[mid] || {}), [newEvent.id]: true };
        appliedCount++;
      });
      return next;
    });
    if (!okAttendance) {
      alert('Event added but attendance import partly failed.');
    }

    await refresh();
    setReviewOpen(false);
    alert(`Created "${newEvent.name}" and marked ${appliedCount} member(s) attended.`);
  };

  const totalAttendedSum = active.reduce((s, m) => s + eventDates.filter((ev) => getAttendanceStatus(m.id, ev.id)).length, 0);
  const totalRatesSum = active.reduce((s, m) => {
    const count = eventDates.filter((ev) => getAttendanceStatus(m.id, ev.id)).length;
    return s + (eventDates.length ? (count / eventDates.length) * 100 : 0);
  }, 0);
  const avgAttendance = active.length ? (totalAttendedSum / active.length).toFixed(1) : '0.0';
  const avgRate = active.length ? totalRatesSum / active.length : 0;
  const avgRateClass = rateClass(avgRate);

  const warEvents = useMemo(() => eventDates.filter((e) => e.isWar), [eventDates]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Event Attendance</h1>
        <div className={`${styles.pageSubtitle} notranslate`}>
          {active.length} members · {eventDates.length} sessions
        </div>
      </div>

      <section className={styles.controlsCard}>
        <div className={styles.btnGroup}>
          <button className={`${styles.btnToggle} ${tab === 'attendance' ? styles.btnToggleActive : ''}`} onClick={() => setTab('attendance')}>
            ATTENDANCE
          </button>
          <button className={`${styles.btnToggle} ${tab === 'ranking' ? styles.btnToggleActive : ''}`} onClick={() => setTab('ranking')}>
            RANKING
          </button>
          <button className={`${styles.btnToggle} ${tab === 'war' ? styles.btnToggleActive : ''}`} onClick={() => setTab('war')}>
            ⚠ WAR
          </button>
        </div>
        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="🔍 Search member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.controlsRight}>
          <button className={`${styles.btnDiff} ${showDiff ? styles.btnDiffActive : ''}`} onClick={() => setShowDiff((v) => !v)}>
            ± DIFF
          </button>
          {isStaff && (
            <div className={styles.adminInline}>
              <input
                type="text"
                className={`${styles.adminInput} ${styles.adminInputText}`}
                placeholder="Event Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input type="date" className={styles.adminInput} value={newDate} onChange={(e) => setNewDate(e.target.value)} />

              <label className={styles.warCheckLabel}>
                <input type="checkbox" checked={newIsWar} onChange={(e) => setNewIsWar(e.target.checked)} /> WAR EVENT
              </label>
              <button className={`${styles.btnAction} ${styles.btnGold}`} onClick={() => void addEvent()}>
                + ADD EVENT
              </button>
              <button
                className={`${styles.btnAction} ${styles.btnGold}`}
                onClick={() => document.getElementById('warImportInput')?.click()}
                disabled={importing}
              >
                {importing ? importStatus : '📥 IMPORT WAR EVENT'}
              </button>
              <input
                id="warImportInput"
                type="file"
                accept="image/*"
                multiple
                style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
                onChange={handleImportFiles}
              />
            </div>
          )}
        </div>
      </section>

      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Members</div>
          <div className={`${styles.kpiValue} notranslate`}>{active.length}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Avg Attendance</div>
          <div className={`${styles.kpiValue} notranslate`}>{avgAttendance}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Avg Rate</div>
          <div className={`${styles.kpiValue} notranslate ${styles['attended' + avgRateClass.charAt(0).toUpperCase() + avgRateClass.slice(1)]}`}>
            {avgRate.toFixed(1)}%
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Pct Base</div>
          <div className={`${styles.kpiValue} ${styles.kpiGold} notranslate`}>{eventDates.length} events</div>
        </div>
      </section>

      <div className={styles.legendBar}>
        <span className={styles.legendPill}>
          <span className={`${styles.badgeRank} ${styles.r1}`}>1</span> 1st
        </span>
        <span className={styles.legendPill}>
          <span className={`${styles.badgeRank} ${styles.r2}`}>2</span> 2nd
        </span>
        <span className={styles.legendPill}>
          <span className={`${styles.badgeRank} ${styles.r3}`}>3</span> 3rd
        </span>
        <span className={styles.legendPill}>
          <span className={`${styles.badgeRank} ${styles.r4}`}>4</span> 4th
        </span>
        <span className={styles.legendPill}>
          <span className={`${styles.badgeRank} ${styles.r5}`}>5</span> 5th
        </span>
        {isStaff && (
          <span className={styles.hint}>
            · Admin/Mgmt: click any cell to toggle attendance. Click a date header to edit a session. Click the square button above a
            day with multiple events to collapse/expand it.
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Loading…</div>
      ) : tab === 'attendance' ? (
        <AttendanceTable
          events={eventDates}
          members={filtered}
          isStaff={isStaff}
          collapsedDays={collapsedDays}
          onToggleDay={toggleDay}
          onToggleAttendance={(mid, eid) => void toggleAttendance(mid, eid)}
          onCycleVote={(mid, eid) => void cycleVote(mid, eid)}
          onEditEvent={setEditingEvent}
          getAttendanceStatus={getAttendanceStatus}
          getVote={getVote}
        />
      ) : tab === 'ranking' ? (
        <>
          <div className={styles.sortModeBar}>
            <span className={styles.sortModeLabel}>Sort Ranking By:</span>
            <div className={styles.btnGroup}>
              <button
                className={`${styles.btnToggle} ${rankingSort === 'default' ? styles.btnToggleActive : ''}`}
                onClick={() => setRankingSort('default')}
              >
                DEFAULT
              </button>
              <button
                className={`${styles.btnToggle} ${rankingSort === 'rank' ? styles.btnToggleActive : ''}`}
                onClick={() => setRankingSort('rank')}
              >
                BY RANK
              </button>
            </div>
          </div>
          <RankingList events={eventDates} members={active} sortMode={rankingSort} getAttendanceStatus={getAttendanceStatus} />
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 600, padding: '0 4px' }}>
            War-only participation. Members who voted Yes/Maybe (or didn't vote) and did not attend are flagged.
          </p>
          <div className={styles.sortModeBar}>
            <span className={styles.sortModeLabel}>Sort War Ranking By:</span>
            <div className={styles.btnGroup}>
              <button
                className={`${styles.btnToggle} ${warSort === 'default' ? styles.btnToggleActive : ''}`}
                onClick={() => setWarSort('default')}
              >
                DEFAULT
              </button>
              <button
                className={`${styles.btnToggle} ${warSort === 'rank' ? styles.btnToggleActive : ''}`}
                onClick={() => setWarSort('rank')}
              >
                BY RANK
              </button>
            </div>
          </div>
          <WarTable warEvents={warEvents} members={active} sortMode={warSort} getAttendanceStatus={getAttendanceStatus} getVote={getVote} />
        </>
      )}

      <div className={styles.pageFooter}>
        <span className="notranslate">{filtered.length} members shown</span>
      </div>

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}

      {reviewOpen && (
        <ImportReviewModal
          rows={reviewRows}
          matchedCount={reviewMatchedCount}
          activeMembers={active}
          rawOcrText={reviewRawText}
          eventName={reviewName}
          onEventNameChange={setReviewName}
          eventDate={reviewDate}
          onEventDateChange={setReviewDate}
          isWar={reviewIsWar}
          onIsWarChange={setReviewIsWar}
          onRowChange={(idx, field, value) => {
            setReviewRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
          }}
          onAddManualRow={() => setReviewRows((prev) => [...prev, { rawText: '', memberId: '', confidence: null, include: true }])}
          onApply={() => void applyImport()}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

export default Events;
