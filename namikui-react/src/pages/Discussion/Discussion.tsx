import { useEffect, useState } from 'react';
import styles from './Discussion.module.css';
import { useAuth } from '../../context/AuthContext';
import { ROW, logAudit, mutateRow, useAppRow } from '../../lib/appData';
import ChatPanel from './components/ChatPanel';
import PollCard from './components/PollCard';
import PollModal from './components/PollModal';
import NoticeModal from './components/NoticeModal';
import type { ChatMessage, OfficialNotice, Poll, PollFields } from './discussionTypes';

export function Discussion() {
  const { currentUser } = useAuth();
  const username = currentUser.username ?? 'Unknown';
  const role = currentUser.role;
  const isAdmin = role === 'admin';
  const canAccess = role === 'admin' || role === 'management';

  const { rows: messages, setRows: setMessages, loading: chatLoading } = useAppRow<ChatMessage>(ROW.chatMessages, canAccess);
  const { rows: polls, setRows: setPolls } = useAppRow<Poll>(ROW.polls, canAccess);
  const { rows: notices, setRows: setNotices } = useAppRow<OfficialNotice>(ROW.notices, canAccess);

  const [tab, setTab] = useState<'chat' | 'announcement'>('chat');
  const [pollModal, setPollModal] = useState<Poll | 'new' | null>(null);
  const [noticeModal, setNoticeModal] = useState<OfficialNotice | 'new' | null>(null);
  const [now, setNow] = useState(Date.now());

  // Re-check every 30s so polls move to "Archived" when their timer runs out
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const log = (type: string, details: string) => void logAudit(username, role, type, details);

  // ---------- Chat ----------
  const sendMessage = async (text: string): Promise<boolean> => {
    const msg: ChatMessage = {
      user: username,
      role: role ?? 'member',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const next = await mutateRow<ChatMessage>(ROW.chatMessages, 'chatMessages', (cur) => [...cur, msg].slice(-500));
    if (!next) {
      alert('Could not send the message. Please try again.');
      return false;
    }
    setMessages(next);
    return true;
  };

  // ---------- Polls ----------
  const savePoll = async (fields: PollFields) => {
    const existing = pollModal && pollModal !== 'new' ? pollModal : null;
    let next: Poll[] | null;
    if (existing) {
      next = await mutateRow<Poll>(ROW.polls, 'polls', (cur) =>
        cur.map((p) => (p.id === existing.id ? { ...p, question: fields.question, options: fields.options } : p))
      );
    } else {
      const poll: Poll = {
        id: Date.now(),
        question: fields.question,
        options: fields.options.map((o) => ({ text: o.text, votes: [] })),
        expiresAt: Date.now() + fields.timerSecs * 1000,
        createdBy: username,
      };
      next = await mutateRow<Poll>(ROW.polls, 'polls', (cur) => [poll, ...cur]);
    }
    if (!next) {
      alert('Could not save the poll. Please try again.');
      return;
    }
    setPolls(next);
    log(existing ? 'ADMIN_EDIT_POLL' : 'CREATE_POLL', `${existing ? 'Edited' : 'Created'} poll: "${fields.question}"`);
    setPollModal(null);
  };

  const votePoll = async (pollId: number, optionIndex: number) => {
    const flags = { rejection: null as string | null };
    const next = await mutateRow<Poll>(ROW.polls, 'polls', (cur) =>
      cur.map((p) => {
        if (p.id !== pollId) return p;
        if (Date.now() > p.expiresAt) {
          flags.rejection = 'This poll has already closed and cannot accept new votes.';
          return p;
        }
        if (p.options.some((o) => o.votes.includes(username))) {
          flags.rejection = 'You have already voted on this poll. Changing votes is disabled.';
          return p;
        }
        return {
          ...p,
          options: p.options.map((o, i) => (i === optionIndex ? { ...o, votes: [...o.votes, username] } : o)),
        };
      })
    );
    if (!next) {
      alert('Could not record your vote. Please try again.');
      return;
    }
    setPolls(next);
    if (flags.rejection) {
      alert(flags.rejection);
      return;
    }
    const q = next.find((p) => p.id === pollId)?.question ?? String(pollId);
    log('VOTE_POLL', `Voted on poll: "${q}"`);
  };

  const deleteVote = async (pollId: number, optionIndex: number, voter: string) => {
    if (!isAdmin) return;
    const next = await mutateRow<Poll>(ROW.polls, 'polls', (cur) =>
      cur.map((p) =>
        p.id !== pollId
          ? p
          : { ...p, options: p.options.map((o, i) => (i === optionIndex ? { ...o, votes: o.votes.filter((v) => v !== voter) } : o)) }
      )
    );
    if (!next) {
      alert('Could not remove the vote. Please try again.');
      return;
    }
    setPolls(next);
    const q = next.find((p) => p.id === pollId)?.question ?? String(pollId);
    log('ADMIN_DELETE_VOTE', `Admin removed vote for [${voter}] on poll "${q}"`);
  };

  const archivePoll = async (poll: Poll) => {
    if (!isAdmin) return;
    if (!window.confirm(`Archive poll "${poll.question}" now? This will close it to voting immediately.`)) return;
    const next = await mutateRow<Poll>(ROW.polls, 'polls', (cur) =>
      cur.map((p) => (p.id === poll.id ? { ...p, expiresAt: Date.now() } : p))
    );
    if (!next) {
      alert('Could not archive the poll. Please try again.');
      return;
    }
    setPolls(next);
    setNow(Date.now());
    log('ADMIN_ARCHIVE_POLL', `Admin archived poll early: "${poll.question}"`);
  };

  const deletePoll = async (poll: Poll): Promise<void> => {
    if (!isAdmin) return;
    if (!window.confirm(`Permanently delete poll "${poll.question}"?`)) return;
    const next = await mutateRow<Poll>(ROW.polls, 'polls', (cur) => cur.filter((p) => p.id !== poll.id));
    if (!next) {
      alert('Could not delete the poll. Please try again.');
      return;
    }
    setPolls(next);
    log('ADMIN_DELETE_POLL', `Admin deleted poll: ${poll.question}`);
    setPollModal(null);
  };

  // ---------- Official notices ----------
  const saveNotice = async (fields: { title: string; content: string }) => {
    const existing = noticeModal && noticeModal !== 'new' ? noticeModal : null;
    if (existing && !isAdmin) {
      alert('Only Admin can edit notices.');
      return;
    }
    let next: OfficialNotice[] | null;
    if (existing) {
      next = await mutateRow<OfficialNotice>(ROW.notices, 'notices', (cur) =>
        cur.map((n) => (n.id === existing.id ? { ...n, ...fields } : n))
      );
    } else {
      const notice: OfficialNotice = { id: Date.now(), ...fields, date: new Date().toLocaleDateString(), author: username };
      next = await mutateRow<OfficialNotice>(ROW.notices, 'notices', (cur) => [notice, ...cur]);
    }
    if (!next) {
      alert('Could not save the notice. Please try again.');
      return;
    }
    setNotices(next);
    log(existing ? 'ADMIN_EDIT_NOTICE' : 'CREATE_NOTICE', `${existing ? 'Admin edited official notice' : 'Posted notice'}: "${fields.title}"`);
    setNoticeModal(null);
  };

  const deleteNotice = async (notice: OfficialNotice): Promise<void> => {
    if (!isAdmin) return;
    if (!window.confirm(`Delete notice "${notice.title}"?`)) return;
    const next = await mutateRow<OfficialNotice>(ROW.notices, 'notices', (cur) => cur.filter((n) => n.id !== notice.id));
    if (!next) {
      alert('Could not delete the notice. Please try again.');
      return;
    }
    setNotices(next);
    log('ADMIN_DELETE_NOTICE', `Admin deleted official notice: ${notice.title}`);
    setNoticeModal(null);
  };

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>Discussion Room</h1>
        <div className={styles.card}>
          <div className={styles.empty}>Access Denied: Management or Admin clearance is required.</div>
        </div>
      </div>
    );
  }

  const activePolls = polls.filter((p) => now <= p.expiresAt);
  const archivedPolls = polls.filter((p) => now > p.expiresAt);
  const cardProps = {
    now,
    username,
    isAdmin,
    onVote: (id: number, i: number) => void votePoll(id, i),
    onEdit: (p: Poll) => setPollModal(p),
    onArchive: (p: Poll) => void archivePoll(p),
    onDelete: (p: Poll) => void deletePoll(p),
    onDeleteVote: (id: number, i: number, v: string) => void deleteVote(id, i, v),
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.pageTitle}>Discussion Room</h1>
        <div className={styles.pageSubtext}>Alliance communication and active member polls</div>
      </div>

      <div className={styles.controlsCard}>
        <div className={styles.btnGroup}>
          <button className={`${styles.btnToggle} ${tab === 'chat' ? styles.btnToggleActive : ''}`} onClick={() => setTab('chat')}>
            💬 CHAT
          </button>
          <button
            className={`${styles.btnToggle} ${tab === 'announcement' ? styles.btnToggleActive : ''}`}
            onClick={() => setTab('announcement')}
          >
            📣 ANNOUNCEMENTS &amp; NOTICES
          </button>
        </div>
      </div>

      {tab === 'chat' ? (
        <ChatPanel messages={messages} loading={chatLoading} onSend={sendMessage} />
      ) : (
        <div className={styles.card}>
          <div className={styles.announceTop}>
            <div>
              <h2 className={styles.cardTitle}>ANNOUNCEMENT, POLLS &amp; NOTICES</h2>
              <p className={styles.cardDesc} style={{ marginBottom: 0 }}>
                Create time-bounded polls, official management notices, and view archived polls.
              </p>
            </div>
            <div className={styles.announceBtns}>
              <button className={`${styles.btnAction} ${styles.btnGold}`} onClick={() => setNoticeModal('new')}>
                + ADD NOTICE
              </button>
              <button className={`${styles.btnAction} ${styles.btnGold}`} onClick={() => setPollModal('new')}>
                + CREATE POLL
              </button>
            </div>
          </div>

          <div className={styles.grid}>
            <div>
              <h3 className={styles.sectionTitle}>Active Polls</h3>
              <div className={styles.stack}>
                {activePolls.length === 0 ? (
                  <div className={styles.empty}>No active polls.</div>
                ) : (
                  activePolls.map((p) => <PollCard key={p.id} poll={p} {...cardProps} />)
                )}
              </div>
              <h3 className={styles.sectionTitleMuted}>Archived Polls (Closed)</h3>
              <div className={styles.stack}>
                {archivedPolls.length === 0 ? (
                  <div className={styles.empty}>No archived polls.</div>
                ) : (
                  archivedPolls.map((p) => <PollCard key={p.id} poll={p} {...cardProps} />)
                )}
              </div>
            </div>

            <div>
              <h3 className={styles.sectionTitle}>Official Notices</h3>
              <div className={styles.stack}>
                {notices.length === 0 ? (
                  <div className={styles.empty}>No notices posted.</div>
                ) : (
                  notices.map((n) => (
                    <div key={n.id} className={styles.noticeCard}>
                      <div className={styles.noticeTop}>
                        <span className={`${styles.noticeTitle} notranslate`}>{n.title}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`${styles.noticeDate} notranslate`}>{n.date}</span>
                          {isAdmin && (
                            <button className={`${styles.actionLink} ${styles.linkPrimary}`} onClick={() => setNoticeModal(n)}>
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                      <div className={`${styles.noticeBody} notranslate`}>{n.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {pollModal && (
        <PollModal
          poll={pollModal === 'new' ? null : pollModal}
          isAdmin={isAdmin}
          onClose={() => setPollModal(null)}
          onSave={savePoll}
          onDelete={deletePoll}
        />
      )}
      {noticeModal && (
        <NoticeModal
          notice={noticeModal === 'new' ? null : noticeModal}
          isAdmin={isAdmin}
          onClose={() => setNoticeModal(null)}
          onSave={saveNotice}
          onDelete={deleteNotice}
        />
      )}
    </div>
  );
}

export default Discussion;
