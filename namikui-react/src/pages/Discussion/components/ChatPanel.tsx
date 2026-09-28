import { useEffect, useRef, useState } from 'react';
import styles from '../Discussion.module.css';
import type { ChatMessage } from '../discussionTypes';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  onSend: (text: string) => Promise<boolean>;
}

export default function ChatPanel({ messages, loading, onSend }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const ok = await onSend(t);
      if (ok) setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`${styles.card} ${styles.chatCard}`}>
      <h2 className={styles.cardTitle}>MANAGEMENT CHAT ROOM</h2>
      <p className={styles.cardDesc}>
        Confidential communication channel restricted strictly to Management and Admin personnel.
      </p>
      <div className={styles.chatBox} ref={boxRef}>
        {loading ? (
          <div className={styles.empty}>Loading…</div>
        ) : messages.length === 0 ? (
          <div className={styles.empty}>No messages sent yet. Start the conversation!</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={styles.chatMsg}>
              <div className={styles.chatMeta}>
                <span className={`${styles.chatUser} notranslate`}>
                  {m.user} ({m.role})
                </span>
                <span className="notranslate">{m.timestamp}</span>
              </div>
              <div className={`${styles.chatText} notranslate`}>{m.text}</div>
            </div>
          ))
        )}
      </div>
      <div className={styles.chatInputRow}>
        <input
          className={styles.chatInput}
          type="text"
          placeholder="Type message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
        />
        <button className={`${styles.btnAction} ${styles.btnPrimary}`} onClick={() => void send()} disabled={sending}>
          Send
        </button>
      </div>
    </div>
  );
}
