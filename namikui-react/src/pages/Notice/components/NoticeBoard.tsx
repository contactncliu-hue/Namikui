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

export default function NoticeBoard({ announcements, role, isStaff, loading, onAdd, onEdit }: Props) {
  const visible = announcements.filter((a) => canSee(a.visibility, role));

  return (
    <div className={styles.tlCard}>
      <div className={styles.tlBanner}>
        <div className={styles.tlBannerSide} />
        <div className={styles.tlBannerCenter}>
          <h2 className={styles.tlTitle}>NOTICES</h2>
        </div>
        <div className={styles.tlBannerActions}>
          {isStaff && (
            <button type="button" className={styles.tlBtnBrown} onClick={onAdd}>
              ADD NOTICE
            </button>
          )}
        </div>
      </div>

      <div className={styles.tlFrame}>
        <div className={styles.nbBar}>Clan updates, upcoming schedules, and main notices posted by management tier staff.</div>
        {loading ? (
          <div className={styles.tlEmpty}>Loading…</div>
        ) : visible.length === 0 ? (
          <div className={styles.tlEmpty}>No notices yet.</div>
        ) : (
          <div className={styles.nbList}>
            {visible.map((ann) => (
              <div key={ann.id} className={styles.nbItem}>
                <img className={styles.nbFlower} src="/assets/notices/flower-notice.png" alt="" />
                <div className={styles.nbTop}>
                  <span className={`${styles.nbTitle} notranslate`}>{ann.title}</span>
                  <div className={styles.nbMeta}>
                    <span className={`${styles.nbBadge} ${ann.visibility === 'alliance' ? styles.nbBadgeAlliance : ''}`}>
                      {visibilityLabel(ann.visibility)}
                    </span>
                    <span className="notranslate">{ann.date}</span>
                    {isStaff && (
                      <button type="button" className={styles.nbEdit} onClick={() => onEdit(ann)}>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                <div className={`${styles.nbText} notranslate`}>{ann.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <img className={styles.nbLeaf} src="/assets/notices/leaf-plant.png" alt="" />
    </div>
  );
}
