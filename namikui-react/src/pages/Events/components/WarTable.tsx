import { useMemo } from 'react';
import styles from '../Events.module.css';
import type { EventDate, Member } from '../../../types';
import { RANK_GROUP_ORDER, assignCompetitionRanks, memberRate, rateClass } from '../eventsUtils';

interface Props {
  warEvents: EventDate[];
  members: Member[];
  sortMode: 'default' | 'rank';
  getAttendanceStatus: (memberId: number, eventId: number) => boolean | 'late';
  getVote: (memberId: number, eventId: number) => 'yes' | 'no' | 'maybe' | null;
}

interface WarStat {
  m: Member;
  attended: number;
  rate: number;
  red: number;
  yellow: number;
}

function WarCard({ stat, rank, total }: { stat: WarStat; rank: number; total: number }) {
  const rc = rateClass(stat.rate);
  const cardClass = (styles as Record<string, string>)['cardR' + rank] || '';
  const badgeClass = (styles as Record<string, string>)['cardBadgeR' + rank] || '';
  return (
    <div className={`${styles.rankingCard} ${cardClass}`}>
      <div className={styles.cardLeft}>
        <div className={`${styles.cardBadge} ${badgeClass}`}>{rank}</div>
        <div>
          <div className={`${styles.cardName} notranslate`}>{stat.m.name}</div>
          <div className={`${styles.cardSub} notranslate`}>
            {stat.attended}/{total} war events attended
            {' · '}
            <span style={{ color: '#dc2626' }}>{stat.red} red</span>
            {' · '}
            <span style={{ color: '#b89117' }}>{stat.yellow} yellow</span>
          </div>
        </div>
      </div>
      <div className={styles.cardRight}>
        <div className={styles.cardBarWrap}>
          <div className={styles.progressBar}>
            <div
              className={`${styles.progressBarFill} ${styles['fill' + rc.charAt(0).toUpperCase() + rc.slice(1)]}`}
              style={{ width: `${stat.rate}%` }}
            />
          </div>
        </div>
        <span className={`${styles.progressText} ${styles['attended' + rc.charAt(0).toUpperCase() + rc.slice(1)]}`}>
          {stat.rate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function WarTable({ warEvents, members, sortMode, getAttendanceStatus, getVote }: Props) {
  const stats: WarStat[] = useMemo(() => {
    return members.map((m) => {
      let attended = 0;
      let red = 0;
      let yellow = 0;
      warEvents.forEach((ev) => {
        const didAttend = !!getAttendanceStatus(m.id, ev.id);
        if (didAttend) {
          attended++;
          return;
        }
        const vote = getVote(m.id, ev.id) || 'none';
        if (vote === 'maybe') yellow++;
        else red++;
      });
      const rate = memberRate(attended, warEvents.length);
      return { m, attended, rate, red, yellow };
    });
  }, [warEvents, members, getAttendanceStatus, getVote]);

  const totalAttended = stats.reduce((s, r) => s + r.attended, 0);
  const totalRateSum = stats.reduce((s, r) => s + r.rate, 0);
  const avgAttendance = members.length ? (totalAttended / members.length).toFixed(1) : '0.0';
  const avgRate = members.length ? (totalRateSum / members.length).toFixed(1) + '%' : '0.0%';

  const body = (() => {
    if (warEvents.length === 0) {
      return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>No war events recorded yet.</div>;
    }
    if (stats.length === 0) {
      return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>No members yet.</div>;
    }

    if (sortMode === 'rank') {
      const sorted = [...stats].sort((a, b) => b.rate - a.rate);
      const ranked = assignCompetitionRanks(sorted, (r) => Math.round(r.rate * 100));
      return (
        <div className={styles.rankingList}>
          {ranked.map(({ item, rank }) => (
            <WarCard key={item.m.id} stat={item} rank={rank} total={warEvents.length} />
          ))}
        </div>
      );
    }

    const sorted = [...stats].sort((a, b) => (RANK_GROUP_ORDER[a.m.rank] ?? 99) - (RANK_GROUP_ORDER[b.m.rank] ?? 99));
    let lastGroupKey: string | null = null;
    return (
      <div className={styles.rankingList}>
        {sorted.map((stat, idx) => {
          const groupKey = stat.m.rank || 'R1';
          const showBar = groupKey !== lastGroupKey;
          lastGroupKey = groupKey;
          const barClass = (styles as Record<string, string>)['group' + groupKey] || styles.groupR1;
          return (
            <div key={stat.m.id} style={{ display: 'contents' }}>
              {showBar && <div className={`${styles.rankGroupBar} ${barClass}`}>{groupKey}</div>}
              <WarCard stat={stat} rank={idx + 1} total={warEvents.length} />
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <>
      <section className={styles.warStatGrid}>
        <div className={styles.warStatCard}>
          <div className={styles.warStatLabel}>Members</div>
          <div className={`${styles.warStatValue} notranslate`}>{members.length}</div>
        </div>
        <div className={styles.warStatCard}>
          <div className={styles.warStatLabel}>Avg War Attendance</div>
          <div className={`${styles.warStatValue} notranslate`}>{avgAttendance}</div>
        </div>
        <div className={styles.warStatCard}>
          <div className={styles.warStatLabel}>Avg War Rate</div>
          <div className={`${styles.warStatValue} notranslate`}>{avgRate}</div>
        </div>
        <div className={styles.warStatCard}>
          <div className={styles.warStatLabel}>Pct Base</div>
          <div className={`${styles.warStatValue} notranslate`}>{warEvents.length} war events</div>
        </div>
      </section>

      {body}
    </>
  );
}
