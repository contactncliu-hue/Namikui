import type { Member } from '../../types';

export const RANK_GROUP_ORDER: Record<string, number> = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4 };

export function rateClass(rate: number): 'high' | 'mid' | 'low' {
  if (rate >= 75) return 'high';
  if (rate >= 50) return 'mid';
  return 'low';
}

export function memberRate(attendedCount: number, totalEvents: number): number {
  if (totalEvents === 0) return 0;
  return (attendedCount / totalEvents) * 100;
}

// Competition ranking (1,1,3-style ties) over a list, given a comparable value per item.
export function assignCompetitionRanks<T>(sortedDesc: T[], valueFn: (item: T) => number): Array<{ item: T; rank: number }> {
  let lastVal: number | null = null;
  let rank = 0;
  return sortedDesc.map((item) => {
    const val = valueFn(item);
    if (lastVal === null || val !== lastVal) {
      rank += 1;
      lastVal = val;
    }
    return { item, rank };
  });
}

export function activeMembers(members: Member[]): Member[] {
  return members.filter((m) => m.status !== 'removed');
}
