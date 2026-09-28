export type Visibility = 'everyone' | 'alliance';
export type EventCategory = 'alliance' | 'war';
export type RepeatType = 'custom' | 'weekly' | 'biweekly' | 'monthly';

export interface CalendarEvent {
  id: number;
  name: string;
  category: EventCategory;
  color: string;
  visibility: Visibility;
  type: RepeatType;
  time: string | null;
  endTime: string | null;
  date?: string;
  endDate?: string;
  dayOfWeek?: number;
  biweeklyAnchorDate?: string;
  dayOfMonth?: number;
}

export interface NoticeAnnouncement {
  id: number;
  title: string;
  content: string;
  visibility: Visibility;
  date: string;
  author?: string;
}

export interface AnnouncementFields {
  title: string;
  content: string;
  visibility: Visibility;
}

export interface AuditEntry {
  timestamp: string;
  user: string;
  role: string;
  type: string;
  details: string;
}

export interface GanttBar {
  event: CalendarEvent;
  startIdx: number;
  span: number;
  dateLabel: string;
  isRepeat: boolean;
  key: string;
}
