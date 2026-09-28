import { useCallback, useEffect, useState } from 'react';
import { db } from '../../lib/supabase';
import type { AuditEntry, CalendarEvent, NoticeAnnouncement } from './noticeTypes';
import { isExpired } from './ganttUtils';


// Same app_data row ids the original site used
const ID_AUDIT = 3;
const ID_CAL = 11;
const ID_ANN = 12;

// Reads the LATEST row from Supabase, applies the change, writes it back.
// Working from the fresh row (not stale page state) avoids overwriting
// someone else's edit made a moment earlier.
async function mutateRow<T>(id: number, key: string, mutate: (current: T[]) => T[]): Promise<T[] | null> {
  const { data, error } = await db.from('app_data').select('value').eq('id', id).maybeSingle();
  if (error) {
    console.error(`Could not read ${key}:`, error);
    return null;
  }
  const current: T[] = Array.isArray(data?.value) ? data.value : [];
  const next = mutate(current);
  const { error: writeError } = await db
    .from('app_data')
    .upsert({ id, key, value: next }, { onConflict: 'id' });
  if (writeError) {
    console.error(`Could not save ${key}:`, writeError);
    return null;
  }
  return next;
}

interface Options {
  enabled: boolean;
  isStaff: boolean;
  username: string;
  role: string | null;
}

export function useNoticeData({ enabled, isStaff, username, role }: Options) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [announcements, setAnnouncements] = useState<NoticeAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const { data, error } = await db
        .from('app_data')
        .select('key, value')
        .in('key', ['calendarEvents', 'noticeAnnouncements']);
      if (cancelled) return;
      if (error) {
        console.error('Error loading notice data:', error);
        setLoading(false);
        return;
      }
      (data ?? []).forEach((row: any) => {
        if (row.key === 'calendarEvents') {
          const all: CalendarEvent[] = row.value ?? [];
          const live = all.filter((ev) => !isExpired(ev));
          setCalendarEvents(live);
          if (isStaff && live.length !== all.length) {
            mutateRow<CalendarEvent>(ID_CAL, 'calendarEvents', (cur) => cur.filter((ev) => !isExpired(ev)));
          }
        } else if (row.key === 'noticeAnnouncements') {
          setAnnouncements(row.value ?? []);
        }
      });
      setLoading(false);
    }
    load();

    // Live sync: other admins' changes show up without a reload
    const channel = db
      .channel('app_data_notice_page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, (payload: any) => {
        const row = payload.new;
        if (!row || !row.key) return;
        if (row.key === 'calendarEvents') {
          setCalendarEvents(((row.value ?? []) as CalendarEvent[]).filter((ev) => !isExpired(ev)));
        } else if (row.key === 'noticeAnnouncements') {
          setAnnouncements(row.value ?? []);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      db.removeChannel(channel);
    };
  }, [enabled, isStaff]);

  const upsertCalendarEvent = useCallback(async (ev: CalendarEvent): Promise<boolean> => {
    const next = await mutateRow<CalendarEvent>(ID_CAL, 'calendarEvents', (cur) =>
      cur.some((e) => e.id === ev.id) ? cur.map((e) => (e.id === ev.id ? ev : e)) : [...cur, ev]
    );
    if (!next) return false;
    setCalendarEvents(next.filter((e) => !isExpired(e)));
    return true;
  }, []);

  const removeCalendarEvent = useCallback(async (id: number): Promise<boolean> => {
    const next = await mutateRow<CalendarEvent>(ID_CAL, 'calendarEvents', (cur) => cur.filter((e) => e.id !== id));
    if (!next) return false;
    setCalendarEvents(next.filter((e) => !isExpired(e)));
    return true;
  }, []);

  const upsertAnnouncement = useCallback(async (ann: NoticeAnnouncement): Promise<boolean> => {
    const next = await mutateRow<NoticeAnnouncement>(ID_ANN, 'noticeAnnouncements', (cur) =>
      cur.some((a) => a.id === ann.id) ? cur.map((a) => (a.id === ann.id ? ann : a)) : [ann, ...cur]
    );
    if (!next) return false;
    setAnnouncements(next);
    return true;
  }, []);

  const removeAnnouncement = useCallback(async (id: number): Promise<boolean> => {
    const next = await mutateRow<NoticeAnnouncement>(ID_ANN, 'noticeAnnouncements', (cur) =>
      cur.filter((a) => a.id !== id)
    );
    if (!next) return false;
    setAnnouncements(next);
    return true;
  }, []);

  // Adds an entry to the shared audit log (used by the History tab later)
  const logAction = useCallback(
    async (type: string, details: string): Promise<void> => {
      const entry: AuditEntry = {
        timestamp: new Date().toLocaleString(),
        user: username,
        role: role ?? 'unknown',
        type,
        details,
      };
      await mutateRow<AuditEntry>(ID_AUDIT, 'auditLogs', (cur) => [entry, ...cur].slice(0, 50));
    },
    [username, role]
  );

  return {
    calendarEvents,
    announcements,
    loading,
    upsertCalendarEvent,
    removeCalendarEvent,
    upsertAnnouncement,
    removeAnnouncement,
    logAction,
  };
}
