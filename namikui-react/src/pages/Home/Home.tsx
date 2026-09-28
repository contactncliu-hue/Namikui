import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppData, getActiveMembers } from '../../context/AppDataContext';
import styles from './Home.module.css';

const MEDAL_COLORS = ['#f3a808', '#a0aec0', '#b7791f', '#3182ce', '#e53e3e'];

export default function Home() {
  const { currentUser } = useAuth();
  const { eventDates, members, vsData, homePhotos, noticeAnnouncements, getAttendanceStatus, memberAttendedCount } =
    useAppData();

  const canViewData =
    currentUser.role === 'admin' || currentUser.role === 'management' || currentUser.role === 'alliance';

  const activeMembers = useMemo(() => getActiveMembers(members), [members]);

  const avgRate = useMemo(() => {
    const totalEvents = eventDates.length;
    if (!totalEvents || !activeMembers.length) return 0;
    const totalAttended = activeMembers.reduce((sum, m) => sum + memberAttendedCount(m), 0);
    return (totalAttended / activeMembers.length / totalEvents) * 100;
  }, [eventDates, activeMembers, memberAttendedCount]);

  const topContributors = useMemo(() => {
    const activeNames = new Set(activeMembers.map((m) => m.name.toLowerCase()));
    const weeksCount = vsData.weeks.length;
    if (weeksCount === 0) return [];
    const recentWeekIdx = weeksCount - 1;
    return vsData.membersScores
      .filter((ms) => activeNames.has(ms.name.toLowerCase()))
      .map((ms) => ({ name: ms.name, recentScore: ms.scores[recentWeekIdx] ?? 0 }))
      .sort((a, b) => b.recentScore - a.recentScore)
      .slice(0, 5)
      .filter((s) => s.recentScore > 0 || vsData.membersScores.some((m) => m.scores.some((sc) => sc > 0)));
  }, [vsData, activeMembers]);

  const recentEvents = useMemo(() => eventDates.slice(-5).reverse(), [eventDates]);

  const visiblePhotos = useMemo(
    () =>
      homePhotos.filter((p) =>
        p.visibility === 'alliance'
          ? currentUser.role === 'admin' || currentUser.role === 'management' || currentUser.role === 'alliance'
          : true
      ),
    [homePhotos, currentUser.role]
  );

  const visibleNotices = useMemo(
    () =>
      noticeAnnouncements
        .filter((n) =>
          n.visibility === 'alliance'
            ? currentUser.role === 'admin' || currentUser.role === 'management' || currentUser.role === 'alliance'
            : true
        )
        .slice(0, 3),
    [noticeAnnouncements, currentUser.role]
  );

  if (!canViewData) {
    return (
      <section className={styles.view}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Home Dashboard</h1>
          <div className={styles.pageSubtext}>Welcome to Loopy's Playground Alliance Management Dashboard</div>
        </div>
        <div className={styles.emptyState}>
          🔒 This content is only available to Alliance Members and Staff. Ask an Admin to assign you the Alliance
          role.
        </div>
      </section>
    );
  }

  return (
    <section className={styles.view}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Home Dashboard</h1>
        <div className={styles.pageSubtext}>Welcome to Loopy's Playground Alliance Management Dashboard</div>
      </div>

      <div className={`${styles.card} ${styles.accentGold}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>🖼️ RECENT PHOTOS / VIDEOS</div>
        </div>
        {visiblePhotos.length === 0 ? (
          <div className={styles.emptyState}>No photos or videos yet.</div>
        ) : (
          <div className={styles.photoRow}>
            {visiblePhotos.slice(0, 8).map((p) => (
              <div key={p.id} className={styles.photoThumb}>
                <img src={p.dataUrl} alt={p.uploader} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.quadGrid}>
        <div className={styles.card}>
          <div className={styles.statLabel}>TOTAL MEMBERS</div>
          <div className={styles.statRow}>
            <div className={styles.statValue}>{activeMembers.length}/100</div>
            <div className={styles.statIcon}>👥</div>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.statLabel}>EVENT ATTENDANCE</div>
          <div className={styles.statRow}>
            <div className={`${styles.statValue} ${styles.statValueGold}`}>{avgRate.toFixed(1)}%</div>
            <div className={styles.statIcon}>📅</div>
          </div>
        </div>
      </div>

      <div className={styles.quadGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeaderTitle} style={{ marginBottom: 18 }}>
            ⚔️ TOP 5 CONTRIBUTORS
          </div>
          {topContributors.length === 0 ? (
            <div className={styles.emptyState}>No VS points recorded yet.</div>
          ) : (
            <div className={styles.list}>
              {topContributors.map((c, idx) => (
                <div key={c.name} className={styles.listRow}>
                  <div className={styles.listRowLeft}>
                    <span className={styles.medal} style={{ background: MEDAL_COLORS[idx] }}>
                      {idx + 1}
                    </span>
                    <span className={styles.listRowName}>{c.name}</span>
                  </div>
                  <div className={styles.listRowValue}>
                    {c.recentScore.toLocaleString()}
                    <span className={styles.listRowUnit}> pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeaderTitle} style={{ marginBottom: 18 }}>
            📅 RECENT EVENTS
          </div>
          {recentEvents.length === 0 ? (
            <div className={styles.emptyState}>No events recorded yet.</div>
          ) : (
            <div className={styles.list}>
              {recentEvents.map((ev) => {
                const attendedCount = activeMembers.reduce(
                  (sum, m) => sum + (getAttendanceStatus(m.id, ev.id) ? 1 : 0),
                  0
                );
                const rate = activeMembers.length ? Math.round((attendedCount / activeMembers.length) * 100) : 0;
                return (
                  <div key={ev.id} className={styles.listRow}>
                    <div className={styles.eventRowLeft}>
                      <span className={styles.eventRowName}>{ev.name || 'Event'}</span>
                      <span className={styles.eventRowDate}>{ev.date}</span>
                    </div>
                    <span className={styles.eventRowRate}>{rate}% attended</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`${styles.card} ${styles.accentRed}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderTitle}>📣 NOTICES</div>
        </div>
        {visibleNotices.length === 0 ? (
          <div className={styles.emptyState}>No notices yet.</div>
        ) : (
          <div>
            {visibleNotices.map((n) => (
              <div key={n.id} className={styles.noticeRow}>
                <div className={styles.noticeTop}>
                  <span className={styles.noticeName}>{n.title}</span>
                  <span className={styles.noticeDate}>{n.date}</span>
                </div>
                <div className={styles.noticeDesc}>{n.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
