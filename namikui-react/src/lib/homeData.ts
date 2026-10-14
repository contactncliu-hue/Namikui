import { useCallback, useEffect, useState } from 'react';
import { db } from './supabase';
import { mutateRowByKey, readRowByKey } from './appData';

export interface Alliance {
  id: number;
  name: string;
  tag: string;
  leader: string;
  founded: string;
  icon: string;
  gamePower: string;
  stateRank: string;
  trend: string;
  change: string;
  combat: string;
  members: string;
  isMain?: boolean;
}

export interface HomeInfo {
  peerRank: string;
  peerScore: string;
  shieldsUp: string;
  overrides: Record<string, string>;
  parts: { hero: string; science: string; vehicle: string; buildings: string; pet: string };
  troops: string;
  legionScore: string;
  legionRank: string;
  hiveCentre: string;
  inHive: string;
  spreadOut: string;
  headquarters: string;
  mapRead: string;
  joining: string;
  joinPower: string;
  description: string;
}

export type ShieldMap = Record<string, { until: number; hours: number }>;
export type LinkMap = Record<string, number>;

export interface MoveEntry {
  id: number;
  ts: number;
  type: 'join' | 'leave' | 'rename';
  name: string;
  oldName?: string;
  cp?: string;
  from?: string;
  to?: string;
}

export const DEFAULT_INFO: HomeInfo = {
  peerRank: '', peerScore: '', shieldsUp: '',
  overrides: {},
  parts: { hero: '', science: '', vehicle: '', buildings: '', pet: '' },
  troops: '', legionScore: '', legionRank: '',
  hiveCentre: '', inHive: '', spreadOut: '', headquarters: '', mapRead: '',
  joining: '', joinPower: '', description: '',
};

export function mergeInfo(v: Partial<HomeInfo> | null | undefined): HomeInfo {
  const x = v ?? {};
  return {
    ...DEFAULT_INFO,
    ...x,
    parts: { ...DEFAULT_INFO.parts, ...(x.parts ?? {}) },
    overrides: { ...(x.overrides ?? {}) },
  };
}

export function newAlliance(id: number, name: string, tag: string, isMain = false): Alliance {
  return { id, name, tag, leader: '', founded: '', icon: '', gamePower: '', stateRank: '', trend: '', change: '', combat: '', members: '', isMain };
}

export const DEFAULT_ALLIANCES: Alliance[] = [
  newAlliance(1, '猛兽之家', 'z0.0', true),
  newAlliance(2, 'Shadow Dragon & Lion', 'SDL'),
  newAlliance(3, 'Zombieland Rule #32', 'z0.0'),
];

export function parsePower(s?: string): number {
  if (!s) return 0;
  const t = s.toString().trim().toUpperCase().replace(/,/g, '');
  const n = parseFloat(t.replace(/[^0-9.]/g, ''));
  if (!n) return 0;
  if (t.includes('B') || t.includes('G')) return n * 1e9;
  if (t.includes('M')) return n * 1e6;
  if (t.includes('K')) return n * 1e3;
  return n;
}

function sig3(v: number): string {
  return v >= 100 ? String(Math.round(v)) : v.toPrecision(3);
}

export function fmtPower(n: number): string {
  if (!n) return '-';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1e9) return sign + sig3(a / 1e9) + 'B';
  if (a >= 1e6) return sign + sig3(a / 1e6) + 'M';
  if (a >= 1e3) return sign + sig3(a / 1e3) + 'K';
  return sign + String(Math.round(a));
}

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// One app_data row (by key) kept live through Realtime.
export function useKeyRow<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    readRowByKey<T>(key).then((v) => {
      if (cancelled) return;
      if (v !== null && v !== undefined) setValue(v);
      setLoading(false);
    });
    const channel = db
      .channel(`key_${key}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_data', filter: `key=eq.${key}` },
        (payload: any) => {
          const row = payload.new;
          if (row && row.value !== null && row.value !== undefined) setValue(row.value as T);
        }
      )
      .subscribe();
    return () => {
      cancelled = true;
      db.removeChannel(channel);
    };
  }, [key]);

  const update = useCallback(
    async (mutate: (cur: T) => T): Promise<boolean> => {
      const next = await mutateRowByKey<T>(key, fallback, mutate);
      if (next === null) {
        alert('Could not save. Please try again.');
        return false;
      }
      setValue(next);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return { value, update, loading };
}

// Used by the Members page to record joins, leaves and renames.
export async function logMove(e: Omit<MoveEntry, 'id' | 'ts'>): Promise<void> {
  const entry: MoveEntry = { ...e, id: Date.now() + Math.floor(Math.random() * 1000), ts: Date.now() };
  const cutoff = Date.now() - 60 * 86400000;
  await mutateRowByKey<MoveEntry[]>('moves', [], (cur) => [entry, ...cur].filter((x) => x.ts >= cutoff));
}
