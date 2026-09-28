export type Role = 'member' | 'alliance' | 'management' | 'admin';

export interface CurrentUser {
  username: string | null;
  role: Role | null;
}

export interface Account {
  user_id: string;
  username: string;
  role: Role;
}

export interface EventDate {
  id: number;
  name: string;
  date: string;
  isWar: boolean;
  subtext?: string;
}

export interface F1HistoryEntry {
  date: string;
  val: string;
}

export interface Member {
  id: number;
  name: string;
  rank: string;
  frozenRank?: string;
  f1Raw?: number;
  status?: 'active' | 'inactive' | 'removed';
  cp?: string;
  rawCp?: number;
  f1Cp?: string;
  f1History?: F1HistoryEntry[];
  faction?: 'F' | 'S' | 'R';
  level?: string;
  note?: string;
  attended?: number;
  events?: number[];
}

export type AttendanceMap = Record<number, Record<number, true | 'late' | undefined>>;
export type EventVotesMap = Record<number, Record<number, 'yes' | 'no' | 'maybe' | undefined>>;

export interface AuditLogEntry {
  timestamp: string;
  user: string;
  role: string;
  type: string;
  details: string;
}

export interface VsMemberScore {
  id: number;
  name: string;
  scores: number[];
}

export type VsSessionType = 'weekly' | 'daily';

export interface VsWeekEntry {
  date: string;
  type: VsSessionType;
}

export interface VsArchiveEntry {
  cycleStartDate: string | null;
  cycleEndDate: string | null;
  weeks: Array<string | VsWeekEntry>;
  membersTotals: Array<{ id: number; name: string; total: number }>;
}

export interface VsData {
  weeks: Array<string | VsWeekEntry>;
  membersScores: VsMemberScore[];
  cycleStartDate?: string | null;
  cycleEndDate?: string | null;
  cycleDates?: string[];
  archives?: VsArchiveEntry[];
}

export interface HomePhoto {
  id: number;
  dataUrl: string;
  uploader: string;
  date: string;
  visibility: 'everyone' | 'alliance';
}

export interface NoticeAnnouncement {
  id: number;
  title: string;
  content: string;
  date: string;
  author: string;
  visibility: 'everyone' | 'alliance';
}
