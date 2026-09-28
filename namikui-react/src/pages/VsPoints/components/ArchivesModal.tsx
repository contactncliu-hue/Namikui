import styles from '../VsPoints.module.css';
import type { VsArchiveEntry } from '../../../types';

interface Props {
  archives: VsArchiveEntry[];
  isStaff: boolean;
  onClose: () => void;
  onDeleteEntry: (index: number) => void;
}

export default function ArchivesModal({ archives, isStaff, onClose, onDeleteEntry }: Props) {
  const total = archives.length;
  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>
          Past Cycles
          <button className={styles.closeX} onClick={onClose}>
            ✕
          </button>
        </h3>
        {archives.length === 0 ? (
          <div className={styles.mutedCell}>No archived cycles yet.</div>
        ) : (
          [...archives]
            .map((arc, i) => ({ arc, archiveIdx: i }))
            .reverse()
            .map(({ arc, archiveIdx }) => {
              const cycleNumber = total - (total - 1 - archiveIdx);
              const sortedTotals = [...(arc.membersTotals || [])].sort((a, b) => b.total - a.total);
              return (
                <div key={archiveIdx} className={styles.archiveEntry}>
                  <div className={styles.archiveTitle}>
                    <span>Cycle {cycleNumber}</span>
                    {isStaff && (
                      <button className={styles.archiveDeleteBtn} onClick={() => onDeleteEntry(archiveIdx)}>
                        🗑 Delete
                      </button>
                    )}
                  </div>
                  <div className={styles.archiveMeta}>
                    {arc.cycleStartDate || '—'} to {arc.cycleEndDate || '—'} · {arc.weeks ? arc.weeks.length : 0} sessions
                  </div>
                  {sortedTotals.length === 0 ? (
                    <div className={styles.archiveRow}>
                      <span style={{ color: 'var(--color-text-muted)' }}>No member data recorded.</span>
                      <span />
                    </div>
                  ) : (
                    sortedTotals.slice(0, 10).map((m, i) => (
                      <div key={i} className={`${styles.archiveRow} notranslate`}>
                        <span>
                          #{i + 1} {m.name}
                        </span>
                        <span>{m.total.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              );
            })
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button className={styles.btnAction} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
