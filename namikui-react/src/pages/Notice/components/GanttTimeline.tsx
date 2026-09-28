import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import styles from '../Notice.module.css';
import type { CalendarEvent } from '../noticeTypes';
import {
  MONTHS, WEEKDAYS, buildGanttBars, canSee, dateStrOf, dayShiftLabel, formatEventTime, getGanttWindow,
  localZoneName, readTimeMode, serverTodayStr, shiftTime, writeTimeMode,
} from '../ganttUtils';
import type { TimeMode } from '../ganttUtils';

const VISIBLE_DAYS = 10;
const COL_W = 96;

interface Props {
  events: CalendarEvent[];
  role: string | null;
  isStaff: boolean;
  onAdd: () => void;
  onEdit: (ev: CalendarEvent) => void;
}

const byName = (a: CalendarEvent, b: CalendarEvent) => a.name.localeCompare(b.name);

export default function GanttTimeline({ events, role, isStaff, onAdd, onEdit }: Props) {
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<TimeMode>(readTimeMode);
  const changeMode = (m: TimeMode) => {
    setMode(m);
    writeTimeMode(m);
  };

  const days = useMemo(() => getGanttWindow(offset, VISIBLE_DAYS), [offset]);
  const visible = useMemo(() => events.filter((ev) => canSee(ev.visibility, role)), [events, role]);
  const bars = useMemo(() => buildGanttBars(days, visible), [days, visible]);

  const todayStr = serverTodayStr();
  const todayIdx = days.findIndex((d) => dateStrOf(d) === todayStr);
  const first = days[0];
  const last = days[days.length - 1];
  const rangeLabel = `${MONTHS[first.getMonth()]} ${first.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;

  const gridVars = {
    '--gantt-days': VISIBLE_DAYS,
    '--gantt-col-w': `${COL_W}px`,
  } as CSSProperties;

  const legendItems = useMemo(() => {
    const seen = new Set<string>();
    const out: CalendarEvent[] = [];
    visible.forEach((ev) => {
      if (!seen.has(ev.name)) {
        seen.add(ev.name);
        out.push(ev);
      }
    });
    return out.slice(0, 8);
  }, [visible]);

  const allianceEvents = visible.filter((e) => (e.category ?? 'alliance') === 'alliance').sort(byName);
  const warEvents = visible.filter((e) => e.category === 'war').sort(byName);

  const renderGroup = (label: string, icon: string, list: CalendarEvent[]) => {
    if (list.length === 0) return null;
    return (
      <div key={label}>
        <div className={styles.ganttGroupHeader}>
          {icon} {label}
        </div>
        {list.map((ev) => (
          <div key={ev.id} className={styles.ganttRow}>
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
                    className={`${styles.ganttBar} ${isStaff ? styles.ganttBarClickable : ''}`}
                    style={{
                      left: `calc(${leftPct}% + 3px)`,
                      width: `calc(${widthPct}% - 6px)`,
                      backgroundColor: ev.color,
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
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeaderRow}>
        <h2 className={styles.cardTitle}>📅 EVENT TIMELINE</h2>
        <div className={styles.headerActions}>
          <div className={styles.navGroup}>
            <button className={styles.navBtn} aria-label="Earlier" onClick={() => setOffset((o) => o - 7)}>
              ‹
            </button>
            <button className={styles.navBtn} aria-label="Later" onClick={() => setOffset((o) => o + 7)}>
              ›
            </button>
          </div>
          {isStaff && (
            <button className={`${styles.btnAction} ${styles.btnGold}`} onClick={onAdd}>
              + ADD EVENT
            </button>
          )}
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={`${styles.toolbarText} notranslate`}>{rangeLabel}</span>
        <div className={styles.modeToggle}>
          <button type="button" className={`${styles.modeBtn} ${mode === 'server' ? styles.modeBtnActive : ''}`} onClick={() => changeMode('server')}>
            SERVER
          </button>
          <button type="button" className={`${styles.modeBtn} ${mode === 'local' ? styles.modeBtnActive : ''}`} onClick={() => changeMode('local')}>
            LOCAL
          </button>
        </div>
        <span className={styles.toolbarNote}>
          {mode === 'server' ? '· 24h Server Time (UTC-2)' : `· 24h your local time (${localZoneName()}) · days follow server date`}
        </span>
        <div className={styles.legend}>
          {legendItems.map((ev) => (
            <span key={ev.name} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: ev.color }} />
              <span className="notranslate">{ev.name}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.ganttWrapper}>
        <div className={styles.ganttScroll}>
          <div className={styles.ganttGrid} style={gridVars}>
            <div className={styles.ganttBody}>
              {todayIdx >= 0 && (
                <div
                  className={styles.todayStripe}
                  style={{ left: `${(todayIdx / VISIBLE_DAYS) * 100}%`, width: `${100 / VISIBLE_DAYS}%` }}
                />
              )}
              <div className={styles.ganttHeaderRow}>
                {days.map((d, idx) => {
                  const isToday = idx === todayIdx;
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const cls = [
                    styles.ganttHeaderCell,
                    isToday ? styles.headerToday : isWeekend ? styles.headerWeekend : '',
                  ].join(' ');
                  return (
                    <div key={idx} className={cls}>
                      <div className={styles.dow}>{WEEKDAYS[d.getDay()]}</div>
                      <div className={`${styles.dayNum} notranslate`}>
                        {isToday ? 'Today' : `${MONTHS[d.getMonth()]} ${d.getDate()}`}
                      </div>
                    </div>
                  );
                })}
              </div>
              {visible.length === 0 ? (
                <div className={styles.ganttEmpty}>
                  {isStaff ? 'No events scheduled yet. Click "+ ADD EVENT" to create one.' : 'No events scheduled yet.'}
                </div>
              ) : (
                <>
                  {renderGroup('Alliance Events', '🛡️', allianceEvents)}
                  {renderGroup('War Events', '⚔️', warEvents)}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
