import { useState } from 'react';
import styles from '../Notice.module.css';
import type { AnnouncementFields, NoticeAnnouncement, Visibility } from '../noticeTypes';

interface Props {
  announcement: NoticeAnnouncement | null; // null = creating new
  onClose: () => void;
  onSave: (fields: AnnouncementFields) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function AnnouncementModal({ announcement, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [content, setContent] = useState(announcement?.content ?? '');
  const [visibility, setVisibility] = useState<Visibility>(announcement?.visibility ?? 'everyone');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Please fill out both title and content.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), content: content.trim(), visibility });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!announcement) return;
    if (!window.confirm(`Delete announcement "${announcement.title}"?`)) return;
    setSaving(true);
    try {
      await onDelete(announcement.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>{announcement ? 'Edit Announcement' : 'Add Announcement'}</h3>
        <input type="text" placeholder="Announcement Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          placeholder="Announcement Details..."
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <label className={styles.fieldLabel}>Visible To</label>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
          <option value="everyone">Everyone</option>
          <option value="alliance">Alliance Members + Staff Only</option>
        </select>
        <div className={styles.modalBtns}>
          {announcement && (
            <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={handleDelete} disabled={saving}>
              Delete
            </button>
          )}
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
