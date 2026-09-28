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
  const start = new Date();
  start.setHours(0, 0, 0, 0);
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
  const today = parseDate(dateStrOf(new Date()));
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
