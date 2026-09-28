import { useState } from 'react';
import styles from '../Discussion.module.css';
import type { OfficialNotice } from '../discussionTypes';

interface Props {
  notice: OfficialNotice | null; // null = creating new
  isAdmin: boolean;
  onClose: () => void;
  onSave: (fields: { title: string; content: string }) => Promise<void>;
  onDelete: (notice: OfficialNotice) => Promise<void>;
}

export default function NoticeModal({ notice, isAdmin, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(notice?.title ?? '');
  const [content, setContent] = useState(notice?.content ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Please fill out both notice title and content.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), content: content.trim() });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!notice) return;
    setSaving(true);
    try {
      await onDelete(notice);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>{notice ? 'Edit Management Notice' : 'Add Management Notice'}</h3>
        <input type="text" placeholder="Notice Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Notice Details..." rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
        <div className={styles.modalBtns}>
          {notice && isAdmin && (
            <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={() => void handleDelete()} disabled={saving}>
              Delete
            </button>
          )}
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Post Notice'}
          </button>
        </div>
      </div>
    </div>
  );
}
