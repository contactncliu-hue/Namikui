import { useEffect, useState } from 'react';
import { db } from './supabase';

// app_data row ids (same ids the original site used)
export const ROW = {
  eventDates: 1,
  members: 2,
  auditLogs: 3,
  chatMessages: 8,
  polls: 9,
  notices: 14,
  dataSnapshots: 15,
} as const;

export interface AuditEntry {
  timestamp: string;
  user: string;
  role: string;
  type: string;
  details: string;
}

export async function readRow<T>(id: number): Promise<T[] | null> {
  const { data, error } = await db.from('app_data').select('value').eq('id', id).maybeSingle();
  if (error) {
    console.error(`Could not read app_data row ${id}:`, error);
    return null;
  }
  return Array.isArray(data?.value) ? (data.value as T[]) : [];
}

export async function writeRow(id: number, key: string, value: unknown): Promise<boolean> {
  const { error } = await db.from('app_data').upsert({ id, key, value }, { onConflict: 'id' });
  if (error) {
    console.error(`Could not save ${key}:`, error);
    return false;
  }
  return true;
}

// Reads the LATEST row, applies the change, writes it back.
// Working from the fresh row means two people editing at once can't wipe each other's changes.
export async function mutateRow<T>(id: number, key: string, mutate: (current: T[]) => T[]): Promise<T[] | null> {
  const current = await readRow<T>(id);
  if (current === null) return null;
  const next = mutate(current);
  const ok = await writeRow(id, key, next);
  return ok ? next : null;
}

export async function logAudit(user: string, role: string | null, type: string, details: string): Promise<void> {
  const entry: AuditEntry = {
    timestamp: new Date().toLocaleString(),
    user,
    role: role ?? 'unknown',
    type,
    details,
  };
  await mutateRow<AuditEntry>(ROW.auditLogs, 'auditLogs', (cur) => [entry, ...cur].slice(0, 50));
}

// Loads one app_data row and keeps it live via Realtime.
export function useAppRow<T>(id: number, enabled: boolean) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    readRow<T>(id).then((value) => {
      if (cancelled) return;
      if (value) setRows(value);
      setLoading(false);
    });

    const channel = db
      .channel(`app_row_${id}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_data', filter: `id=eq.${id}` },
        (payload: any) => {
          const row = payload.new;
          if (row && Array.isArray(row.value)) setRows(row.value as T[]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      db.removeChannel(channel);
    };
  }, [id, enabled]);

  return { rows, setRows, loading };
}

// --- Key-based access, for rows whose id isn't fixed (attendance, eventVotes) ---
const rowIdCache: Record<string, number> = {};

async function getNextFreeRowId(): Promise<number> {
  const { data } = await db.from('app_data').select('id');
  const maxId = (data ?? []).reduce((mx: number, r: any) => Math.max(mx, r.id), 0);
  return maxId + 1;
}

async function findRowIdByKey(key: string): Promise<number | null> {
  if (rowIdCache[key] !== undefined) return rowIdCache[key];
  const { data, error } = await db.from('app_data').select('id').eq('key', key).maybeSingle();
  if (error || !data) return null;
  rowIdCache[key] = data.id;
  return data.id;
}

export async function readRowByKey<T>(key: string): Promise<T | null> {
  const id = await findRowIdByKey(key);
  if (id === null) return null;
  const { data, error } = await db.from('app_data').select('value').eq('id', id).maybeSingle();
  if (error) {
    console.error(`Could not read ${key}:`, error);
    return null;
  }
  return (data?.value ?? null) as T;
}

export async function writeRowByKey(key: string, value: unknown): Promise<boolean> {
  let id = await findRowIdByKey(key);
  if (id === null) {
    id = await getNextFreeRowId();
    rowIdCache[key] = id;
  }
  const { error } = await db.from('app_data').upsert({ id, key, value }, { onConflict: 'id' });
  if (error) {
    console.error(`Could not save ${key}:`, error);
    return false;
  }
  return true;
}

// Reads the LATEST value under this key, applies the change, writes it back.
export async function mutateRowByKey<T>(key: string, defaultValue: T, mutate: (current: T) => T): Promise<T | null> {
  const current = (await readRowByKey<T>(key)) ?? defaultValue;
  const next = mutate(current);
  const ok = await writeRowByKey(key, next);
  return ok ? next : null;
}
