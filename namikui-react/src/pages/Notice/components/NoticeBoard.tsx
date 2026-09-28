import styles from '../Notice.module.css';
import type { NoticeAnnouncement, Visibility } from '../noticeTypes';
import { canSee } from '../ganttUtils';

interface Props {
  announcements: NoticeAnnouncement[];
  role: string | null;
  isStaff: boolean;
  loading: boolean;
  onAdd: () => void;
  onEdit: (ann: NoticeAnnouncement) => void;
}

const visibilityLabel = (v: Visibility) => (v === 'alliance' ? 'Alliance Members + Staff Only' : 'Everyone');
const badgeClass = (v: Visibility) => (v === 'alliance' ? styles.badgeAlliance : styles.badgeEveryone);

export default function NoticeBoard({ announcements, role, isStaff, loading, onAdd, onEdit }: Props) {
  const visible = announcements.filter((a) => canSee(a.visibility, role));

  return (
    <div className={`${styles.card} ${styles.cardAccentRed}`}>
      <div className={styles.cardHeaderRow}>
        <h2 className={styles.cardTitle}>📣 NOTICE BOARD</h2>
        {isStaff && (
          <button className={styles.btnOutlineGold} onClick={onAdd}>
            + ADD ANNOUNCEMENT
          </button>
        )}
      </div>
      <p className={styles.cardDesc}>
        Clan updates, upcoming schedules, and main notices posted by management tier staff.
      </p>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : visible.length === 0 ? (
        <div className={styles.empty}>No notices yet.</div>
      ) : (
        <div className={styles.announcementList}>
          {visible.map((ann) => (
            <div key={ann.id} className={styles.announcementCard}>
              <div className={styles.announcementTop}>
                <span className={`${styles.announcementTitle} notranslate`}>{ann.title}</span>
                <div className={styles.announcementMeta}>
                  <span className={`${styles.badge} ${badgeClass(ann.visibility)}`}>{visibilityLabel(ann.visibility)}</span>
                  <span className="notranslate">{ann.date}</span>
                  {isStaff && (
                    <button className={styles.editLink} onClick={() => onEdit(ann)}>
                      Edit
                    </button>
                  )}
                </div>
              </div>
              <div className={`${styles.announcementBody} notranslate`}>{ann.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
