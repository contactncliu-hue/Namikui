import type { VsSessionType, VsWeekEntry } from '../../types';

export const THRESHOLD_WEEKLY = 12168000;
export const THRESHOLD_DAILY = 2028000;

export function getThreshold(type: VsSessionType): number {
  return type === 'daily' ? THRESHOLD_DAILY : THRESHOLD_WEEKLY;
}

export function getWeekDate(wk: string | VsWeekEntry): string {
  return typeof wk === 'object' ? wk.date : wk;
}

export function getWeekType(wk: string | VsWeekEntry): VsSessionType {
  return typeof wk === 'object' && wk.type ? wk.type : 'weekly';
}

// Stored dates are MM-DD-YYYY; <input type="date"> needs YYYY-MM-DD.
export function formatDateForInput(mmddyyyy: string): string {
  if (!mmddyyyy) return '';
  const parts = mmddyyyy.split('-');
  if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[0]}-${parts[1]}`;
  return mmddyyyy;
}

export function formatDateForDisplay(yyyymmdd: string): string {
  if (!yyyymmdd) return '';
  const parts = yyyymmdd.split('-');
  if (parts.length === 3 && parts[0].length === 4) return `${parts[1]}-${parts[2]}-${parts[0]}`;
  return yyyymmdd;
}

export function parseDateString(dateStr: string | undefined): Date {
  if (!dateStr) return new Date(0);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return new Date(dateStr);
    return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
  }
  if (parts.length === 2) {
    const year = new Date().getFullYear();
    return new Date(`${year}-${parts[0]}-${parts[1]}`);
  }
  return new Date(dateStr);
}

export const RANK_GROUP_ORDER: Record<string, number> = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4 };
