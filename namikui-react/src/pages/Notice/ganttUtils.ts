import type { CalendarEvent, GanttBar, Visibility } from './noticeTypes';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Local-time YYYY-MM-DD (avoids the off-by-one-day bug toISOString() causes in some timezones)
export function dateStrOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00');
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStrOf(d);
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / msPerDay);
}

export function formatEventTime(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function canSee(visibility: Visibility | undefined, role: string | null): boolean {
  if (!visibility || visibility === 'everyone') return true;
  return role === 'admin' || role === 'management' || role === 'alliance';
}

export function getGanttWindow(offset: number, count: number): Date[] {
  const start = parseDate(serverTodayStr());
  start.setDate(start.getDate() + offset);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// One-time events disappear 7 days after they end. Repeating events never expire.
export function isExpired(ev: CalendarEvent): boolean {
  if (ev.type !== 'custom' || !ev.date) return false;
  const today = parseDate(serverTodayStr());
  const end = parseDate(ev.endDate || ev.date);
  return daysBetween(end, today) > 7;
}

export function buildGanttBars(windowDays: Date[], events: CalendarEvent[]): GanttBar[] {
  const winStart = windowDays[0];
  const winEnd = windowDays[windowDays.length - 1];
  const bars: GanttBar[] = [];
  const label = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

  const pushRepeat = (ev: CalendarEvent, d: Date, idx: number) => {
    bars.push({
      event: ev,
      startIdx: idx,
      span: 1,
      dateLabel: label(d),
      isRepeat: true,
      key: `${ev.id}-${dateStrOf(d)}`,
    });
  };

  events.forEach((ev) => {
    if (ev.type === 'custom' && ev.date) {
      const evStart = parseDate(ev.date);
      const evEnd = parseDate(ev.endDate || ev.date);
      if (evEnd < winStart || evStart > winEnd) return;
      const clipStart = evStart < winStart ? winStart : evStart;
      const clipEnd = evEnd > winEnd ? winEnd : evEnd;
      const isRange = !!ev.endDate && ev.endDate !== ev.date;
      bars.push({
        event: ev,
        startIdx: daysBetween(winStart, clipStart),
        span: daysBetween(clipStart, clipEnd) + 1,
        dateLabel: isRange ? `${label(evStart)} – ${label(evEnd)}` : label(evStart),
        isRepeat: false,
        key: `${ev.id}-${ev.date}`,
      });
    } else if (ev.type === 'weekly') {
      windowDays.forEach((d, idx) => {
        if (d.getDay() === ev.dayOfWeek) pushRepeat(ev, d, idx);
      });
    } else if (ev.type === 'biweekly') {
      const anchor = parseDate(ev.biweeklyAnchorDate || dateStrOf(new Date()));
      windowDays.forEach((d, idx) => {
        if (d.getDay() !== ev.dayOfWeek) return;
        const diff = daysBetween(anchor, d);
        if (((diff % 14) + 14) % 14 === 0) pushRepeat(ev, d, idx);
      });
    } else if (ev.type === 'monthly') {
      windowDays.forEach((d, idx) => {
        if (d.getDate() === ev.dayOfMonth) pushRepeat(ev, d, idx);
      });
    }
  });

  return bars;
}

// ---- Server time ----
// Game reset is 10:00 China time (UTC+8) = 02:00 UTC = server midnight, so the server clock is UTC-2.
export const SERVER_OFFSET_MIN = -120;
export type TimeMode = 'server' | 'local';
const pad2 = (n: number) => String(n).padStart(2, '0');

export function serverTodayStr(): string {
  const s = new Date(Date.now() + SERVER_OFFSET_MIN * 60000);
  return `${s.getUTCFullYear()}-${pad2(s.getUTCMonth() + 1)}-${pad2(s.getUTCDate())}`;
}

// Converts an HH:MM time between server and local time. dayShift = how many days the result
// lands before/after the reference date (e.g. server 23:00 can be local 01:00 the next day).
export function shiftTime(t: string, dateStr: string, from: TimeMode, to: TimeMode): { time: string; dayShift: number } {
  if (!t || from === to) return { time: t, dayShift: 0 };
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  const baseDay = Date.UTC(y, mo - 1, d);
  if (from === 'server') {
    const utc = Date.UTC(y, mo - 1, d, h, mi) - SERVER_OFFSET_MIN * 60000;
    const l = new Date(utc);
    return {
      time: `${pad2(l.getHours())}:${pad2(l.getMinutes())}`,
      dayShift: Math.round((Date.UTC(l.getFullYear(), l.getMonth(), l.getDate()) - baseDay) / 86400000),
    };
  }
  const utc = new Date(y, mo - 1, d, h, mi).getTime();
  const sv = new Date(utc + SERVER_OFFSET_MIN * 60000);
  return {
    time: `${pad2(sv.getUTCHours())}:${pad2(sv.getUTCMinutes())}`,
    dayShift: Math.round((Date.UTC(sv.getUTCFullYear(), sv.getUTCMonth(), sv.getUTCDate()) - baseDay) / 86400000),
  };
}

export function dayShiftLabel(n: number): string {
  return n === 0 ? '' : ` (${n > 0 ? '+' : '−'}${Math.abs(n)}d)`;
}

export function readTimeMode(): TimeMode {
  try { return localStorage.getItem('noticeTimeMode') === 'local' ? 'local' : 'server'; } catch { return 'server'; }
}
export function writeTimeMode(m: TimeMode): void {
  try { localStorage.setItem('noticeTimeMode', m); } catch { /* ignore */ }
}
export function localZoneName(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'local'; }
}
