import { useState } from 'react';
import styles from './Notice.module.css';
import { useNoticeUser } from './noticeAuth';
import { useNoticeData } from './useNoticeData';
import GanttTimeline from './components/GanttTimeline';
import CalendarEventModal from './components/CalendarEventModal';
import NoticeBoard from './components/NoticeBoard';
import AnnouncementModal from './components/AnnouncementModal';
import type { AnnouncementFields, CalendarEvent, NoticeAnnouncement } from './noticeTypes';

export function Notice() {
  const { username, role } = useNoticeUser();
  const canView = role === 'admin' || role === 'management' || role === 'alliance';
  const isStaff = role === 'admin' || role === 'management';

  const {
    calendarEvents,
    announcements,
    loading,
    upsertCalendarEvent,
    removeCalendarEvent,
    upsertAnnouncement,
    removeAnnouncement,
    logAction,
  } = useNoticeData({ enabled: canView, isStaff, username, role });

  const [eventModal, setEventModal] = useState<CalendarEvent | 'new' | null>(null);
  const [annModal, setAnnModal] = useState<NoticeAnnouncement | 'new' | null>(null);

  const saveEvent = async (ev: CalendarEvent) => {
    const isNew = !calendarEvents.some((e) => e.id === ev.id);
    const ok = await upsertCalendarEvent(ev);
    if (!ok) {
      alert('Could not save the event. Please try again.');
      return;
    }
    void logAction(
      isNew ? 'ADD_CALENDAR_EVENT' : 'EDIT_CALENDAR_EVENT',
      isNew ? `Added calendar event: ${ev.name} (${ev.type})` : `Updated calendar event: ${ev.name}`
    );
    setEventModal(null);
  };

  const deleteEvent = async (id: number) => {
    const ev = calendarEvents.find((e) => e.id === id);
    const ok = await removeCalendarEvent(id);
    if (!ok) {
      alert('Could not delete the event. Please try again.');
      return;
    }
    void logAction('DELETE_CALENDAR_EVENT', `Deleted calendar event: ${ev ? ev.name : id}`);
    setEventModal(null);
  };

  const saveAnnouncement = async (fields: AnnouncementFields) => {
    const existing = annModal && annModal !== 'new' ? annModal : null;
    const ann: NoticeAnnouncement = existing
      ? { ...existing, ...fields }
      : { id: Date.now(), ...fields, date: new Date().toLocaleDateString(), author: username };
    const ok = await upsertAnnouncement(ann);
    if (!ok) {
      alert('Could not save the announcement. Please try again.');
      return;
    }
    const audience = fields.visibility === 'alliance' ? 'Alliance Members + Staff Only' : 'Everyone';
    void logAction(
      existing ? 'EDIT_NOTICE_ANNOUNCEMENT' : 'ADD_NOTICE_ANNOUNCEMENT',
      `${existing ? 'Updated' : 'Posted'} notice board announcement: "${fields.title}" (visible to: ${audience})`
    );
    setAnnModal(null);
  };

  const deleteAnnouncement = async (id: number) => {
    const ann = announcements.find((a) => a.id === id);
    const ok = await removeAnnouncement(id);
    if (!ok) {
      alert('Could not delete the announcement. Please try again.');
      return;
    }
    void logAction('DELETE_NOTICE_ANNOUNCEMENT', `Deleted notice board announcement: ${ann ? ann.title : id}`);
    setAnnModal(null);
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Notices</h1>
        <div className={styles.pageSubtext}>Alliance notices and the event timeline</div>
      </div>

      {!canView ? (
        <div className={styles.card}>
          <div className={styles.empty}>
            🔒 This content is only available to Alliance Members and Staff. Ask an Admin to assign you the Alliance role.
          </div>
        </div>
      ) : (
        <>
          <GanttTimeline
            events={calendarEvents}
            role={role}
            isStaff={isStaff}
            onAdd={() => setEventModal('new')}
            onEdit={(ev) => setEventModal(ev)}
          />
          <NoticeBoard
            announcements={announcements}
            role={role}
            isStaff={isStaff}
            loading={loading}
            onAdd={() => setAnnModal('new')}
            onEdit={(ann) => setAnnModal(ann)}
          />
        </>
      )}

      {isStaff && eventModal && (
        <CalendarEventModal
          event={eventModal === 'new' ? null : eventModal}
          onClose={() => setEventModal(null)}
          onSave={saveEvent}
          onDelete={deleteEvent}
        />
      )}
      {isStaff && annModal && (
        <AnnouncementModal
          announcement={annModal === 'new' ? null : annModal}
          onClose={() => setAnnModal(null)}
          onSave={saveAnnouncement}
          onDelete={deleteAnnouncement}
        />
      )}
    </div>
  );
}

export default Notice;
