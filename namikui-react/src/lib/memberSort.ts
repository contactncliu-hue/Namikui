import type { Member } from '../types';
import { parseCpToRaw } from '../pages/Members/memberUtils';

const RANK_ORDER: Record<string, number> = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4 };

export function f1Value(m: Member): number {
  if (typeof m.f1Raw === 'number' && m.f1Raw > 0) return m.f1Raw;
  return parseCpToRaw(m.f1Cp || '0G').raw;
}

// Rank group first (R5 -> R1), then F1 Power high to low inside the group.
export function compareByRankThenF1(a: Member, b: Member): number {
  const ra = RANK_ORDER[a.rank || 'R1'] ?? 99;
  const rb = RANK_ORDER[b.rank || 'R1'] ?? 99;
  if (ra !== rb) return ra - rb;
  return f1Value(b) - f1Value(a);
}
