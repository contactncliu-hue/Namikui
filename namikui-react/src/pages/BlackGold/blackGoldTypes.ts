export interface BlackGoldDate {
  id: string;
  date: string; // MM-DD-YYYY
}

export type BlackGoldSlot = 'A' | 'B' | null;
export type BlackGoldRole = 'main' | 'sub' | null;

export interface BlackGoldEntry {
  slot: BlackGoldSlot;
  attended: boolean;
  playerRole: BlackGoldRole;
}

// memberId (as string) -> dateId -> entry
export type BlackGoldAssignments = Record<string, Record<string, BlackGoldEntry>>;

export const EMPTY_ENTRY: BlackGoldEntry = { slot: null, attended: false, playerRole: null };
