import styles from '../VsPoints.module.css';
import type { Member, VsData } from '../../../types';
import { RANK_GROUP_ORDER, getThreshold, getWeekDate, getWeekType } from '../vsUtils';

type SortMode = 'default' | 'points';

interface Props {
  vsData: VsData;
  members: Member[];
  cycleIndices: number[];
  search: string;
  isStaff: boolean;
  sortMode: SortMode;
  onEditScore: (memberId: number, weekIdx: number) => void;
}

export default function RankingCards({ vsData, members, cycleIndices, search, isStaff, sortMode, onEditScore }: Props) {
  const activeIds = new Set(members.map((m) => String(m.id)));
  const activeScores = vsData.membersScores.filter((m) => activeIds.has(String(m.id)));
  const memberRankById = new Map(members.map((m) => [String(m.id), m.rank || 'R1']));

  const withTotals = activeScores.map((m) => ({
    ...m,
    total: cycleIndices.reduce((sum, i) => sum + (m.scores[i] || 0), 0),
  }));
  const maxTotal = Math.max(...withTotals.map((m) => m.total), 1);
  const weeklyScoresByIdx = (wIdx: number) => [...activeScores].map((m) => m.scores[wIdx] || 0).sort((a, b) => b - a);

  const renderBreakdown = (m: (typeof withTotals)[number]) => (
    <div className={styles.cardBreakdown}>
      {cycleIndices.map((wIdx, displayIdx) => {
        const wk = vsData.weeks[wIdx];
        const sVal = m.scores[wIdx] || 0;
        const isLow = sVal < getThreshold(getWeekType(wk));
        const typeLabel = getWeekType(wk) === 'daily' ? 'Day' : 'Wk';
        return (
          <span
            key={wIdx}
            className={isStaff ? styles.cardBreakdownItem : ''}
            onClick={() => isStaff && onEditScore(Number(m.id), wIdx)}
            title={isStaff ? 'Click to edit this score' : undefined}
          >
            {typeLabel} {displayIdx + 1}:{' '}
            <strong style={{ color: isLow ? 'var(--color-not-attended)' : 'var(--color-text-dark)' }}>{sVal.toLocaleString()}</strong>
          </span>
        );
      })}
    </div>
  );

  const renderBars = (m: (typeof withTotals)[number]) => (
    <div className={styles.barsContainer}>
      {cycleIndices.map((wIdx) => {
        const wk = vsData.weeks[wIdx];
        const sVal = m.scores[wIdx] || 0;
        const barHeight = Math.max(Math.round((sVal / maxTotal) * 32), 6);
        const weeklyList = weeklyScoresByIdx(wIdx);
        const scoreRank = weeklyList.indexOf(sVal) + 1;
        let barClass = styles.barDefault;
        if (scoreRank === 1) barClass = styles.barR1;
        else if (scoreRank === 2) barClass = styles.barR2;
        else if (scoreRank === 3) barClass = styles.barR3;
        else if (scoreRank === 4) barClass = styles.barR4;
        else if (scoreRank === 5) barClass = styles.barR5;
        return (
          <div key={wIdx} className={`${styles.barBlock} ${barClass}`} style={{ height: barHeight }} title={`${getWeekDate(wk)}: ${sVal.toLocaleString()}`} />
        );
      })}
    </div>
  );

  if (sortMode === 'points') {
    const top5 = [...withTotals].sort((a, b) => b.total - a.total).slice(0, 5);
    const top5Ids = new Set(top5.map((m) => String(m.id)));
    const rankMap = new Map(top5.map((m, i) => [String(m.id), i + 1]));
    const memberOrderIndex = new Map(members.map((m, idx) => [String(m.id), idx]));
    const rest = withTotals
      .filter((m) => !top5Ids.has(String(m.id)))
      .sort((a, b) => (memberOrderIndex.get(String(a.id)) ?? 0) - (memberOrderIndex.get(String(b.id)) ?? 0));
    const ranked = [...top5, ...rest];
    const filtered = ranked.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

    if (filtered.length === 0) {
      return <div className={styles.mutedCell} style={{ background: 'white', borderRadius: 6, border: '1px solid var(--color-border-light)' }}>No rankings available.</div>;
    }

    return (
      <div className={styles.rankingList}>
        {filtered.map((m) => {
          const trueRank = rankMap.get(String(m.id));
          let cardClass = '';
          let badgeClass = 'r5';
          if (trueRank === 1) { cardClass = styles.top1; badgeClass = 'r1'; }
          else if (trueRank === 2) { cardClass = styles.top3; badgeClass = 'r2'; }
          else if (trueRank === 3) { cardClass = styles.top3; badgeClass = 'r3'; }
          else if (trueRank === 4) { cardClass = styles.top4; badgeClass = 'r4'; }
          else if (trueRank === 5) { cardClass = styles.top5; badgeClass = 'r5'; }
          return (
            <div key={m.id} className={`${styles.rankingCard} ${cardClass}`}>
              <div className={styles.cardLeft}>
                <div style={{ width: 32, textAlign: 'center' }}>
                  {trueRank && <span className={`${styles.badgeRank} ${(styles as Record<string, string>)[badgeClass]}`}>{trueRank}</span>}
                </div>
                <div>
                  <div className={`${styles.cardName} notranslate`}>{m.name}</div>
                  {renderBreakdown(m)}
                </div>
              </div>
              <div className={styles.cardRight}>
                {renderBars(m)}
                <div className={styles.cardTotal}>
                  <div className={`${styles.cardTotalVal} notranslate`}>{m.total.toLocaleString()}</div>
                  <div className={styles.cardTotalLabel}>total pts</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Default: grouped by member rank tier (R5 -> R1), same color dividers as
  // the Members and Table tabs. Within a tier, highest total first.
  const sorted = [...withTotals]
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ga = RANK_GROUP_ORDER[memberRankById.get(String(a.id)) || 'R1'] ?? 99;
      const gb = RANK_GROUP_ORDER[memberRankById.get(String(b.id)) || 'R1'] ?? 99;
      if (ga !== gb) return ga - gb;
      return b.total - a.total;
    });

  if (sorted.length === 0) {
    return <div className={styles.mutedCell} style={{ background: 'white', borderRadius: 6, border: '1px solid var(--color-border-light)' }}>No rankings available.</div>;
  }

  let lastGroupKey: string | null = null;

  return (
    <div className={styles.rankingList}>
      {sorted.map((m) => {
        const groupKey = memberRankById.get(String(m.id)) || 'R1';
        const showBar = groupKey !== lastGroupKey;
        lastGroupKey = groupKey;
        const barClass = (styles as Record<string, string>)['tier' + groupKey] || styles.tierR1;
        return (
          <div key={m.id} style={{ display: 'contents' }}>
            {showBar && <div className={`${styles.tierGroupBar} ${barClass}`}>{groupKey}</div>}
            <div className={styles.rankingCard}>
              <div className={styles.cardLeft}>
                <div>
                  <div className={`${styles.cardName} notranslate`}>{m.name}</div>
                  {renderBreakdown(m)}
                </div>
              </div>
              <div className={styles.cardRight}>
                {renderBars(m)}
                <div className={styles.cardTotal}>
                  <div className={`${styles.cardTotalVal} notranslate`}>{m.total.toLocaleString()}</div>
                  <div className={styles.cardTotalLabel}>total pts</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
