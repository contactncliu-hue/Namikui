import { useState } from 'react';
import styles from '../Notice.module.css';
import type { CalendarEvent, EventCategory, RepeatType, Visibility } from '../noticeTypes';
import { addDays, dayShiftLabel, readTimeMode, serverTodayStr, shiftTime } from '../ganttUtils';
import type { TimeMode } from '../ganttUtils';

const COLORS = ['#2563eb', '#dc2626', '#eab308', '#16a34a', '#ec4899'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  event: CalendarEvent | null; // null = creating a new event
  onClose: () => void;
  onSave: (ev: CalendarEvent) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function CalendarEventModal({ event, onClose, onSave, onDelete }: Props) {
  const today = serverTodayStr();
  const isCustom = !!event && event.type === 'custom';

  const [name, setName] = useState(event?.name ?? '');
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'alliance');
  const [type, setType] = useState<RepeatType>(event?.type ?? 'custom');
  const [startDate, setStartDate] = useState(isCustom ? event?.date ?? today : today);
  const [endDate, setEndDate] = useState(isCustom ? event?.endDate ?? event?.date ?? today : today);
  const [weekday, setWeekday] = useState(String(event?.type === 'weekly' ? event.dayOfWeek ?? 0 : new Date().getDay()));
  const [biWeekday, setBiWeekday] = useState(String(event?.type === 'biweekly' ? event.dayOfWeek ?? 0 : new Date().getDay()));
  const [anchor, setAnchor] = useState(event?.type === 'biweekly' ? event.biweeklyAnchorDate ?? today : today);
  const [dayOfMonth, setDayOfMonth] = useState(event?.type === 'monthly' ? String(event.dayOfMonth ?? '') : '');
  const [time, setTime] = useState(event?.time ?? '');
  const [endTime, setEndTime] = useState(event?.endTime ?? '');
  const [visibility, setVisibility] = useState<Visibility>(event?.visibility ?? 'everyone');
  const [color, setColor] = useState(event?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>(readTimeMode);

  // time/endTime state always holds SERVER time; the inputs just display it in the chosen mode
  const refDate = type === 'custom' && startDate ? startDate : today;
  const shown = (t: string) => shiftTime(t, refDate, 'server', timeMode).time;
  const fromInput = (v: string) => (v ? shiftTime(v, refDate, timeMode, 'server').time : '');
  const toLocal = time ? shiftTime(time, refDate, 'server', 'local') : null;
  const timeHint =
    !time || !toLocal
      ? ''
      : timeMode === 'local'
        ? `Saves as ${time} server time${dayShiftLabel(shiftTime(shown(time), refDate, 'local', 'server').dayShift)}`
        : `Local equivalent: ${toLocal.time}${dayShiftLabel(toLocal.dayShift)}`;

  const handleStartChange = (value: string) => {
    setStartDate(value);
    if (!value) return;
    const max = addDays(value, 6);
    setEndDate((cur) => (cur < value ? value : cur > max ? max : cur));
  };

  const submit = async () => {
    if (!name.trim()) {
      alert('Please enter an event name.');
      return;
    }
    const base: CalendarEvent = {
      id: event?.id ?? Date.now() + Math.floor(Math.random() * 1000),
      name: name.trim(),
      category,
      color,
      visibility,
      type,
      time: time || null,
      endTime: endTime || null,
    };
    let ev: CalendarEvent = base;

    if (type === 'custom') {
      if (!startDate) {
        alert('Please select a start date.');
        return;
      }
      let end = endDate || startDate;
      if (end < startDate) end = startDate;
      const max = addDays(startDate, 6);
      if (end > max) {
        alert('Events can last a maximum of 7 days. The end date has been adjusted.');
        end = max;
      }
      ev = { ...base, date: startDate, endDate: end };
    } else if (type === 'weekly') {
      ev = { ...base, dayOfWeek: parseInt(weekday, 10) };
    } else if (type === 'biweekly') {
      if (!anchor) {
        alert('Please select a starting date for the biweekly event.');
        return;
      }
      ev = { ...base, dayOfWeek: parseInt(biWeekday, 10), biweeklyAnchorDate: anchor };
    } else if (type === 'monthly') {
      const dom = parseInt(dayOfMonth, 10);
      if (!dom || dom < 1 || dom > 31) {
        alert('Please enter a valid day of month (1-31).');
        return;
      }
      ev = { ...base, dayOfMonth: dom };
    }

    setSaving(true);
    try {
      await onSave(ev);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!window.confirm(`Delete calendar event "${event.name}"?`)) return;
    setSaving(true);
    try {
      await onDelete(event.id);
    } finally {
      setSaving(false);
    }
  };

  const dayOptions = DAY_NAMES.map((d, i) => (
    <option key={d} value={i}>
      {d}
    </option>
  ));

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>{event ? 'Edit Calendar Event' : 'Add Calendar Event'}</h3>

        <input type="text" placeholder="Event Name" value={name} onChange={(e) => setName(e.target.value)} />

        <label className={styles.fieldLabel}>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
          <option value="alliance">Alliance Event</option>
          <option value="war">War Event</option>
        </select>

        <label className={styles.fieldLabel}>Repeats</label>
        <select value={type} onChange={(e) => setType(e.target.value as RepeatType)}>
          <option value="custom">One-Time / Date Range</option>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 Weeks</option>
          <option value="monthly">Monthly</option>
        </select>

        {type === 'custom' && (
          <>
            <label className={styles.fieldLabel}>Start Date &amp; End Date (server dates, max 7 days)</label>
            <div className={`${styles.fieldRow} ${styles.fieldRowSpaced}`}>
              <input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)} />
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={startDate ? addDays(startDate, 6) : undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}

        {type === 'weekly' && (
          <>
            <label className={styles.fieldLabel}>Day of Week</label>
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {dayOptions}
            </select>
          </>
        )}

        {type === 'biweekly' && (
          <>
            <label className={styles.fieldLabel}>Day of Week</label>
            <select value={biWeekday} onChange={(e) => setBiWeekday(e.target.value)}>
              {dayOptions}
            </select>
            <label className={styles.fieldLabel}>Starting From</label>
            <input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </>
        )}

        {type === 'monthly' && (
          <>
            <label className={styles.fieldLabel}>Day of Month</label>
            <input
              type="number"
              min={1}
              max={31}
              placeholder="e.g. 15"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </>
        )}

        <label className={styles.fieldLabel}>Start Time &amp; End Time — 24h (optional)</label>
        <div className={styles.modeToggle} style={{ marginBottom: 10 }}>
          <button type="button" className={`${styles.modeBtn} ${timeMode === 'server' ? styles.modeBtnActive : ''}`} onClick={() => setTimeMode('server')}>
            SERVER TIME
          </button>
          <button type="button" className={`${styles.modeBtn} ${timeMode === 'local' ? styles.modeBtnActive : ''}`} onClick={() => setTimeMode('local')}>
            LOCAL TIME
          </button>
        </div>
        <div className={`${styles.fieldRow} ${styles.fieldRowSpaced}`}>
          <input type="time" value={shown(time)} onChange={(e) => setTime(fromInput(e.target.value))} title="Start Time" />
          <input type="time" value={shown(endTime)} onChange={(e) => setEndTime(fromInput(e.target.value))} title="End Time" />
        </div>
        {timeHint && <div className={styles.timeHint}>{timeHint}</div>}

        <label className={styles.fieldLabel}>Visible To</label>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
          <option value="everyone">Everyone</option>
          <option value="alliance">Alliance Members + Staff Only</option>
        </select>

        <label className={styles.fieldLabel}>Color</label>
        <div className={styles.swatchRow}>
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              className={`${styles.swatch} ${c === color ? styles.swatchSelected : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <div className={styles.modalBtns}>
          {event && (
            <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
