import type { BlackGoldAssignments, BlackGoldEntry, BlackGoldDate } from './blackGoldTypes';
import { EMPTY_ENTRY } from './blackGoldTypes';

export function parseDateString(dateStr: string | undefined): Date {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return new Date(dateStr);
    return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
  }
  return new Date(dateStr);
}

export function sortDates(dates: BlackGoldDate[]): BlackGoldDate[] {
  return [...dates].sort((a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime());
}

export function getEntry(assignments: BlackGoldAssignments, memberId: number, dateId: string): BlackGoldEntry {
  return assignments[String(memberId)]?.[dateId] ?? EMPTY_ENTRY;
}

export const RANK_GROUP_ORDER: Record<string, number> = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4 };
export const RANK_GROUP_COLORS: Record<string, string> = { R5: '#2563eb', R4: '#dc2626', R3: '#ea580c', R2: '#eab308', R1: '#16a34a' };
