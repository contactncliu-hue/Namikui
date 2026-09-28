import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db } from '../lib/supabase';
import type {
  EventDate,
  Member,
  AttendanceMap,
  EventVotesMap,
  VsData,
  HomePhoto,
  NoticeAnnouncement,
} from '../types';

interface AppDataContextValue {
  eventDates: EventDate[];
  members: Member[];
  attendanceMap: AttendanceMap;
  eventVotesMap: EventVotesMap;
  vsData: VsData;
  homePhotos: HomePhoto[];
  noticeAnnouncements: NoticeAnnouncement[];
  loading: boolean;
  refresh: () => Promise<void>;
  getAttendanceStatus: (memberId: number, eventId: number) => boolean | 'late';
  memberAttendedCount: (member: Member) => number;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(undefined);

const ACTIVE_MEMBERS = (list: Member[]) => list.filter((m) => m.status !== 'removed');

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [eventDates, setEventDates] = useState<EventDate[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [eventVotesMap, setEventVotesMap] = useState<EventVotesMap>({});
  const [vsData, setVsData] = useState<VsData>({ weeks: [], membersScores: [] });
  const [homePhotos, setHomePhotos] = useState<HomePhoto[]>([]);
  const [noticeAnnouncements, setNoticeAnnouncements] = useState<NoticeAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const applyRow = useCallback((row: { key: string; value: unknown }) => {
    switch (row.key) {
      case 'eventDates':
        setEventDates((row.value as EventDate[]) || []);
        break;
      case 'members':
        setMembers((row.value as Member[]) || []);
        break;
      case 'attendance':
        setAttendanceMap((row.value as AttendanceMap) || {});
        break;
      case 'eventVotes':
        setEventVotesMap((row.value as EventVotesMap) || {});
        break;
      case 'vsData':
        setVsData((row.value as VsData) || { weeks: [], membersScores: [] });
        break;
      case 'homePhotos':
        setHomePhotos((row.value as HomePhoto[]) || []);
        break;
      case 'noticeAnnouncements':
        setNoticeAnnouncements((row.value as NoticeAnnouncement[]) || []);
        break;
      default:
        break;
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await db.from('app_data').select('*').neq('id', 15);
    if (error) {
      console.error('Error loading app_data:', error);
      return;
    }
    (data || []).forEach(applyRow);
  }, [applyRow]);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();

    const channel = db
      .channel('app_data_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data' }, (payload) => {
        const row = payload.new as { key: string; value: unknown } | undefined;
        if (!row || !row.key || row.key === 'dataSnapshots') return;
        applyRow(row);
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [refresh, applyRow]);

  const getAttendanceStatus = useCallback(
    (memberId: number, eventId: number): boolean | 'late' => {
      const m = attendanceMap[memberId];
      if (!m) return false;
      const v = m[eventId];
      return v === true ? true : v === 'late' ? 'late' : false;
    },
    [attendanceMap]
  );

  const memberAttendedCount = useCallback(
    (member: Member) => {
      let count = 0;
      eventDates.forEach((ev) => {
        if (getAttendanceStatus(member.id, ev.id)) count++;
      });
      return count;
    },
    [eventDates, getAttendanceStatus]
  );

  return (
    <AppDataContext.Provider
      value={{
        eventDates,
        members,
        attendanceMap,
        eventVotesMap,
        vsData,
        homePhotos,
        noticeAnnouncements,
        loading,
        refresh,
        getAttendanceStatus,
        memberAttendedCount,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider');
  return ctx;
}

export function getActiveMembers(list: Member[]) {
  return ACTIVE_MEMBERS(list);
}
