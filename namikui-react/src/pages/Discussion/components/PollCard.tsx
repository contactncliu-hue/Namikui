import styles from '../Discussion.module.css';
import type { Poll } from '../discussionTypes';

interface Props {
  poll: Poll;
  now: number;
  username: string;
  isAdmin: boolean;
  onVote: (pollId: number, optionIndex: number) => void;
  onEdit: (poll: Poll) => void;
  onArchive: (poll: Poll) => void;
  onDelete: (poll: Poll) => void;
  onDeleteVote: (pollId: number, optionIndex: number, voter: string) => void;
}

export default function PollCard({ poll, now, username, isAdmin, onVote, onEdit, onArchive, onDelete, onDeleteVote }: Props) {
  const closed = now > poll.expiresAt;
  const total = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const hasVoted = poll.options.some((o) => o.votes.includes(username));
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  if (closed) {
    return (
      <div className={styles.pollCardClosed}>
        <div className={styles.pollTop}>
          <div className={styles.pollQuestion}>
            [CLOSED] <span className="notranslate">{poll.question}</span>
          </div>
          {isAdmin && (
            <button className={`${styles.actionLink} ${styles.linkRed}`} onClick={() => onDelete(poll)}>
              Delete
            </button>
          )}
        </div>
        <div className={styles.pollMeta}>
          Total Votes: <span className="notranslate">{total}</span>
        </div>
        <div className={styles.options}>
          {poll.options.map((o, i) => (
            <div key={i} className={styles.closedRow}>
              <span className="notranslate">{o.text}</span>
              <span className="notranslate" style={{ fontWeight: 800 }}>
                {o.votes.length} ({pct(o.votes.length)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const secsLeft = Math.max(0, Math.floor((poll.expiresAt - now) / 1000));
  const hours = Math.floor(secsLeft / 3600);
  const mins = Math.floor((secsLeft % 3600) / 60);

  return (
    <div className={styles.pollCard}>
      <div className={styles.pollTop}>
        <div className={`${styles.pollQuestion} notranslate`}>{poll.question}</div>
        <div className={styles.pollActions}>
          <button className={`${styles.actionLink} ${styles.linkPrimary}`} onClick={() => onEdit(poll)}>
            Edit
          </button>
          {isAdmin && (
            <>
              <button className={`${styles.actionLink} ${styles.linkGold}`} onClick={() => onArchive(poll)}>
                Archive
              </button>
              <button className={`${styles.actionLink} ${styles.linkRed}`} onClick={() => onDelete(poll)}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      <div className={styles.pollMeta}>
        Expires in:{' '}
        <span className="notranslate">
          {hours}h {mins}m
        </span>{' '}
        · Total Votes: <span className="notranslate">{total}</span>
      </div>
      <div className={styles.options}>
        {poll.options.map((o, i) => (
          <div key={i} className={styles.option}>
            <div className={styles.optionTop}>
              <span className={`${styles.optionText} notranslate`}>{o.text}</span>
              {!hasVoted ? (
                <button className={styles.btnSmallGold} onClick={() => onVote(poll.id, i)}>
                  Vote
                </button>
              ) : (
                <span className={`${styles.voteResult} notranslate`}>
                  {o.votes.length} vote(s) ({pct(o.votes.length)}%)
                </span>
              )}
            </div>
            {hasVoted && isAdmin && o.votes.length > 0 && (
              <div className={`${styles.voters} notranslate`}>
                Voters:{' '}
                {o.votes.map((v, vi) => (
                  <span key={v}>
                    {v}{' '}
                    <button className={styles.voterX} onClick={() => onDeleteVote(poll.id, i, v)}>
                      [x]
                    </button>
                    {vi < o.votes.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
