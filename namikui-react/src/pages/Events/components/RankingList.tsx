import styles from '../Events.module.css';
import type { EventDate, Member } from '../../../types';
import { compareByRankThenF1 } from '../../../lib/memberSort';
import { assignCompetitionRanks, memberRate, rateClass, attendanceWeight } from '../eventsUtils';

interface Props {
  events: EventDate[];
  members: Member[];
  sortMode: 'default' | 'rank';
  getAttendanceStatus: (memberId: number, eventId: number) => boolean | 'late';
}

function Card({ member, rank, attendedCount, total }: { member: Member; rank: number; attendedCount: number; total: number }) {
  const rate = memberRate(attendedCount, total);
  const rc = rateClass(rate);
  const cardClass = (styles as Record<string, string>)['cardR' + rank] || '';
  const badgeClass = (styles as Record<string, string>)['cardBadgeR' + rank] || '';
  return (
    <div className={`${styles.rankingCard} ${cardClass}`}>
      <div className={styles.cardLeft}>
        <div className={`${styles.cardBadge} ${badgeClass}`}>{rank}</div>
        <div>
          <div className={`${styles.cardName} notranslate`}>{member.name}</div>
          <div className={`${styles.cardSub} notranslate`}>
            {attendedCount}/{total} events attended
          </div>
        </div>
      </div>
      <div className={styles.cardRight}>
        <div className={styles.cardBarWrap}>
          <div className={styles.progressBar}>
            <div
              className={`${styles.progressBarFill} ${styles['fill' + rc.charAt(0).toUpperCase() + rc.slice(1)]}`}
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>
        <span className={`${styles.progressText} ${styles['attended' + rc.charAt(0).toUpperCase() + rc.slice(1)]}`}>
          {rate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export default function RankingList({ events, members, sortMode, getAttendanceStatus }: Props) {
  const attendedCount = (m: Member) =>
    events.reduce((s, ev) => s + attendanceWeight(getAttendanceStatus(m.id, ev.id)), 0);

  if (members.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>No members yet.</div>;
  }

  if (sortMode === 'rank') {
    const withRate = members.map((m) => ({ m, rate: memberRate(attendedCount(m), events.length) }));
    withRate.sort((a, b) => b.rate - a.rate);
    const ranked = assignCompetitionRanks(withRate, (x) => Math.round(x.rate * 100));
    return (
      <div className={styles.rankingList}>
        {ranked.map(({ item, rank }) => (
          <Card key={item.m.id} member={item.m} rank={rank} attendedCount={attendedCount(item.m)} total={events.length} />
        ))}
      </div>
    );
  }

  const sorted = [...members].sort(compareByRankThenF1);
  let lastGroupKey: string | null = null;
  return (
    <div className={styles.rankingList}>
      {sorted.map((m, idx) => {
        const groupKey = m.rank || 'R1';
        const showBar = groupKey !== lastGroupKey;
        lastGroupKey = groupKey;
        const barClass = (styles as Record<string, string>)['group' + groupKey] || styles.groupR1;
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {showBar && <div className={`${styles.rankGroupBar} ${barClass}`}>{groupKey}</div>}
            <Card member={m} rank={idx + 1} attendedCount={attendedCount(m)} total={events.length} />
          </div>
        );
      })}
    </div>
  );
}
