import styles from '../Members.module.css';
import type { Member } from '../../../types';

interface Props {
  member: Member;
  isAdmin: boolean;
  onClose: () => void;
  onDeleteEntry: (index: number) => void;
}

export default function F1HistoryModal({ member, isAdmin, onClose, onDeleteEntry }: Props) {
  const history = member.f1History ?? [];
  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>
          <span className="notranslate">{member.name}</span> - F1 History{' '}
          <span className={styles.closeX} onClick={onClose}>
            ✕
          </span>
        </h3>
        <label>Recorded Entries</label>
        <div className={styles.historyList}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 12, fontSize: 12 }}>
              No historical records found.
            </div>
          ) : (
            history.map((item, index) => (
              <div key={index} className={styles.historyItem}>
                <div className="notranslate">
                  <span className={styles.historyItemDate}>{item.date}</span>
                  <div className={styles.historyItemVal}>{item.val}</div>
                </div>
                {isAdmin && (
                  <button className={styles.btnDanger + ' ' + styles.btnAction} onClick={() => onDeleteEntry(index)}>
                    🗑
                  </button>
                )}
              </div>
            ))
          )}
        </div>
        <div className={styles.modalBtns}>
          <button className={styles.btnAction} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
