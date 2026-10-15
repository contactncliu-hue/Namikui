import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from '../Notice.module.css';
import type { CalendarEvent } from '../noticeTypes';
import {
  WEEKDAYS, buildGanttBars, canSee, dateStrOf, dayShiftLabel, formatEventTime, getGanttWindow,
  localZoneName, readTimeMode, serverTodayStr, shiftTime, writeTimeMode,
} from '../ganttUtils';
import type { TimeMode } from '../ganttUtils';

const VISIBLE_DAYS = 10;
const COL_W = 96;
const ASSETS = '/assets/notices';
const FULL_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

interface Props {
  events: CalendarEvent[];
  role: string | null;
  isStaff: boolean;
  onAdd: () => void;
  onEdit: (ev: CalendarEvent) => void;
  onSaveEvent: (ev: CalendarEvent) => void | Promise<void>;
  onDeleteEvent: (id: number) => void | Promise<void>;
}

const byName = (a: CalendarEvent, b: CalendarEvent) => a.name.localeCompare(b.name);

// Dark text on light bars, gold text only on the dark bar colors
const textOn = (hex: string): string => {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return '#3A2519';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 90 ? '#FBF3CD' : '#3A2519';
};

export default function GanttTimeline({ events, role, isStaff, onAdd, onEdit, onSaveEvent, onDeleteEvent }: Props) {
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<TimeMode>(readTimeMode);
  const [permEditId, setPermEditId] = useState<number | 'new' | null>(null);
  const [permDraft, setPermDraft] = useState('');
  const changeMode = (m: TimeMode) => {
    setMode(m);
    writeTimeMode(m);
  };

  const days = useMemo(() => getGanttWindow(offset, VISIBLE_DAYS), [offset]);
  const visible = useMemo(() => events.filter((ev) => canSee(ev.visibility, role)), [events, role]);
  const bars = useMemo(() => buildGanttBars(days, visible), [days, visible]);

  const todayStr = serverTodayStr();
  const todayIdx = days.findIndex((d) => dateStrOf(d) === todayStr);

  const monthSegs = useMemo(() => {
    const out: { label: string; count: number }[] = [];
    days.forEach((d) => {
      const label = FULL_MONTHS[d.getMonth()];
      const last = out[out.length - 1];
      if (last && last.label === label) last.count += 1;
      else out.push({ label, count: 1 });
    });
    return out;
  }, [days]);

  const gridVars = {
    '--gantt-days': VISIBLE_DAYS,
    '--gantt-col-w': `${COL_W}px`,
  } as CSSProperties;

  const allianceEvents = visible.filter((e) => (e.category ?? 'alliance') === 'alliance').sort(byName);
  const warEvents = visible.filter((e) => e.category === 'war').sort(byName);
  const permanentEvents = visible.filter((e) => e.category === 'permanent').sort(byName);
  const timedCount = allianceEvents.length + warEvents.length;

  const startAdd = () => { setPermEditId('new'); setPermDraft(''); };
  const startEdit = (ev: CalendarEvent) => { setPermEditId(ev.id); setPermDraft(ev.name); };
  const cancelPerm = () => { setPermEditId(null); setPermDraft(''); };
  const savePerm = () => {
    const name = permDraft.trim();
    if (!name) return;
    if (permEditId === 'new') {
      void onSaveEvent({
        id: Date.now(), name, category: 'permanent', color: '#D7E6A8', visibility: 'everyone',
        type: 'custom', time: null, endTime: null,
      });
    } else {
      const ev = permanentEvents.find((e) => e.id === permEditId);
      if (ev) void onSaveEvent({ ...ev, name });
    }
    cancelPerm();
  };
  const removePerm = (ev: CalendarEvent) => {
    if (window.confirm(`Remove "${ev.name}"?`)) void onDeleteEvent(ev.id);
  };

  const permInput = (
    <>
      <input
        className={styles.tlInput}
        value={permDraft}
        autoFocus
        placeholder="Permanent event name"
        onChange={(e) => setPermDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') savePerm();
          if (e.key === 'Escape') cancelPerm();
        }}
      />
      <div className={styles.tlPermActions}>
        <button type="button" className={styles.tlMiniBtn} onClick={savePerm}>Save</button>
        <button type="button" className={`${styles.tlMiniBtn} ${styles.tlMiniBtnDanger}`} onClick={cancelPerm}>Cancel</button>
      </div>
    </>
  );

  const renderGroup = (label: string, list: CalendarEvent[]) => (
    <div key={label}>
      <div className={styles.tlGroupHeader}>{label}</div>
      {list.length === 0 && <div className={styles.tlRow} />}
      {list.map((ev) => (
        <div key={ev.id} className={styles.tlRow}>
          {bars
            .filter((b) => b.event.id === ev.id)
            .map((seg) => {
              const leftPct = (seg.startIdx / VISIBLE_DAYS) * 100;
              const widthPct = (seg.span / VISIBLE_DAYS) * 100;
              const refDate = dateStrOf(days[seg.startIdx]);
              const st = ev.time ? shiftTime(ev.time, refDate, 'server', mode) : null;
              const et = ev.endTime ? shiftTime(ev.endTime, refDate, 'server', mode) : null;
              const timeLabel = st
                ? `${formatEventTime(st.time)}${mode === 'local' ? dayShiftLabel(st.dayShift) : ''}${et ? ' – ' + formatEventTime(et.time) : ''} (${mode === 'local' ? 'Local' : 'Server'})`
                : '';
              const subLabel = seg.dateLabel + (timeLabel ? ' · ' + timeLabel : '');
              return (
                <div
                  key={seg.key}
                  className={`${styles.tlBar} ${isStaff ? styles.ganttBarClickable : ''}`}
                  style={{
                    left: `calc(${leftPct}% + 3px)`,
                    width: `calc(${widthPct}% - 6px)`,
                    backgroundColor: ev.color,
                    color: textOn(ev.color),
                  }}
                  onClick={isStaff ? () => onEdit(ev) : undefined}
                >
                  <span className={`${styles.barName} notranslate`}>
                    {seg.isRepeat ? '↻ ' : ''}
                    {ev.name}
                  </span>
                  <span className={`${styles.barDate} notranslate`}>{subLabel}</span>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );

  return (
    <div className={styles.tlCard}>
      <div className={styles.tlBanner}>
        <div className={styles.tlBannerSide} />
        <div className={styles.tlBannerCenter}>
          <h2 className={styles.tlTitle}>EVENT TIMELINE</h2>
          <div className={styles.tlNote}>
            {mode === 'server' ? '24 HR (UTC-2)' : `24h local (${localZoneName()}) · days follow server date`}
          </div>
          <div className={styles.tlModeRow}>
            <button type="button" className={`${styles.tlBtnOrange} ${mode === 'local' ? styles.tlBtnOn : ''}`} onClick={() => changeMode('local')}>
              LOCAL
            </button>
            <button type="button" className={`${styles.tlBtnOrange} ${mode === 'server' ? styles.tlBtnOn : ''}`} onClick={() => changeMode('server')}>
              SERVER
            </button>
          </div>
        </div>
        <div className={styles.tlBannerActions}>
          <button type="button" className={`${styles.tlArrow} ${styles.tlArrowPrev}`} aria-label="Earlier" onClick={() => setOffset((o) => o - 7)} />
          <button type="button" className={styles.tlArrow} aria-label="Later" onClick={() => setOffset((o) => o + 7)} />
          {isStaff && (
            <button type="button" className={styles.tlBtnBrown} onClick={onAdd}>
              ADD EVENT
            </button>
          )}
        </div>
      </div>

      <div className={`${styles.tlFrame} ${styles.tlFrameClip}`}>
        <div className={styles.ganttScroll}>
          <div className={styles.ganttGrid} style={gridVars}>
            <div className={styles.ganttBody}>
              <div className={styles.tlMonthRow}>
                {monthSegs.map((m) => (
                  <div key={m.label} className={styles.tlMonth} style={{ flex: m.count }}>
                    {m.label}
                  </div>
                ))}
              </div>
              <div className={styles.tlDateRow}>
                {days.map((d, idx) => (
                  <div key={idx} className={styles.tlDayCell}>
                    <div className={`${styles.tlFlower} ${idx === todayIdx ? styles.tlFlowerToday : ''} notranslate`}>
                      {d.getDate()}
                    </div>
                    <div className={styles.tlDow}>{WEEKDAYS[d.getDay()]}</div>
                  </div>
                ))}
              </div>

              {timedCount === 0 && (
                <div className={styles.tlEmpty}>
                  {isStaff ? 'No events scheduled yet. Click "ADD EVENT" to create one.' : 'No events scheduled yet.'}
                </div>
              )}
              {renderGroup('Alliance Event', allianceEvents)}
              {renderGroup('War Event', warEvents)}

              {(permanentEvents.length > 0 || isStaff) && (
                <>
                  <div className={styles.tlGroupHeader}>
                    <span>Permanent Event</span>
                    {isStaff && permEditId === null && (
                      <button type="button" className={styles.tlMiniBtn} onClick={startAdd}>
                        + Add
                      </button>
                    )}
                  </div>
                  <div className={styles.tlPermList}>
                    {permanentEvents.map((ev, i) => (
                      <div key={ev.id} className={styles.tlPermanent}>
                        <img
                          className={`${styles.tlCloud} ${i % 2 === 0 ? styles.tlCloudA : styles.tlCloudB}`}
                          src={`${ASSETS}/${i % 2 === 0 ? 'cloud-right' : 'cloud-left'}.png`}
                          alt=""
                        />
                        {permEditId === ev.id ? (
                          permInput
                        ) : (
                          <>
                            <span className={`${styles.tlPermName} notranslate`}>{ev.name}</span>
                            {isStaff && permEditId === null && (
                              <div className={styles.tlPermActions}>
                                <button type="button" className={styles.tlMiniBtn} onClick={() => startEdit(ev)}>Edit</button>
                                <button type="button" className={`${styles.tlMiniBtn} ${styles.tlMiniBtnDanger}`} onClick={() => removePerm(ev)}>Remove</button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {permEditId === 'new' && <div className={styles.tlPermanent}>{permInput}</div>}
                    {permanentEvents.length === 0 && permEditId !== 'new' && (
                      <div className={styles.tlEmpty}>No permanent events yet.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
