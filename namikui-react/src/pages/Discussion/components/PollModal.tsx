import { useState } from 'react';
import styles from '../Discussion.module.css';
import type { Poll, PollFields, PollOption } from '../discussionTypes';

interface Props {
  poll: Poll | null; // null = creating new
  isAdmin: boolean;
  onClose: () => void;
  onSave: (fields: PollFields) => Promise<void>;
  onDelete: (poll: Poll) => Promise<void>;
}

export default function PollModal({ poll, isAdmin, onClose, onSave, onDelete }: Props) {
  const [question, setQuestion] = useState(poll?.question ?? '');
  const [options, setOptions] = useState<PollOption[]>(
    poll ? poll.options.map((o) => ({ text: o.text, votes: o.votes })) : [{ text: '', votes: [] }, { text: '', votes: [] }]
  );
  const [timer, setTimer] = useState('86400');
  const [saving, setSaving] = useState(false);

  const setOptionText = (idx: number, text: string) =>
    setOptions((opts) => opts.map((o, i) => (i === idx ? { ...o, text } : o)));

  const addOption = () => {
    if (options.length >= 8) {
      alert('A poll can have a maximum of 8 options.');
      return;
    }
    setOptions((opts) => [...opts, { text: '', votes: [] }]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) {
      alert('A poll needs at least 2 options.');
      return;
    }
    setOptions((opts) => opts.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!question.trim()) {
      alert('Please enter a poll question.');
      return;
    }
    const clean = options.map((o) => ({ text: o.text.trim(), votes: o.votes })).filter((o) => o.text);
    if (clean.length < 2) {
      alert('Please enter at least two options.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ question: question.trim(), options: clean, timerSecs: parseInt(timer, 10) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!poll) return;
    setSaving(true);
    try {
      await onDelete(poll);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modalCard}>
        <h3>{poll ? 'Edit Poll' : 'Create New Poll'}</h3>
        <input
          type="text"
          placeholder="Poll Question (e.g. Next Guild Event Timing?)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <label className={styles.fieldLabel}>Poll Options:</label>
        {options.map((o, i) => (
          <div key={i} className={styles.optionDraftRow}>
            <input type="text" placeholder={`Option ${i + 1}`} value={o.text} onChange={(e) => setOptionText(i, e.target.value)} />
            {options.length > 2 && (
              <button type="button" className={styles.removeBtn} onClick={() => removeOption(i)} title="Remove option">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" className={styles.btnAction} onClick={addOption} style={{ marginBottom: 16 }}>
          + Add Option
        </button>

        {!poll && (
          <>
            <label className={styles.fieldLabel}>Timer Option:</label>
            <select value={timer} onChange={(e) => setTimer(e.target.value)}>
              <option value="86400">24 Hours</option>
              <option value="259200">3 Days</option>
              <option value="604800">1 Week</option>
            </select>
          </>
        )}

        <div className={styles.modalBtns}>
          {poll && isAdmin && (
            <button className={`${styles.btnAction} ${styles.btnDanger}`} onClick={() => void handleDelete()} disabled={saving}>
              Delete Poll
            </button>
          )}
          <button className={styles.btnAction} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={() => void submit()} disabled={saving}>
            {saving ? 'Saving…' : 'Publish Poll'}
          </button>
        </div>
      </div>
    </div>
  );
}
