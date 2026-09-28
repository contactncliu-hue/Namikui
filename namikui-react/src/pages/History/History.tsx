import { useState } from 'react';
import styles from './History.module.css';
import { useAuth } from '../../context/AuthContext';
import { ROW, logAudit, mutateRow, readRow, useAppRow, writeRow } from '../../lib/appData';
import type { AuditEntry } from '../../lib/appData';

interface Snapshot {
  id: number;
  timestamp: string;
  user: string;
  eventDates: unknown[];
  members: unknown[];
}

const MAX_SNAPSHOTS = 15;

export function History() {
  const { currentUser } = useAuth();
  const username = currentUser.username ?? 'Unknown';
  const role = currentUser.role;
  const isAdmin = role === 'admin';

  const { rows: logs, loading: logsLoading } = useAppRow<AuditEntry>(ROW.auditLogs, isAdmin);
  const { rows: snapshots, loading: snapsLoading } = useAppRow<Snapshot>(ROW.dataSnapshots, isAdmin);
  const [busyId, setBusyId] = useState<number | null>(null);

  const restore = async (snap: Snapshot) => {
    if (
      !window.confirm(
        `Restore event definitions and the member roster to the snapshot from ${snap.timestamp}? Your current data is saved as a new snapshot first, so this can be undone.`
      )
    ) {
      return;
    }
    setBusyId(snap.id);
    try {
      const [curEvents, curMembers] = await Promise.all([readRow<unknown>(ROW.eventDates), readRow<unknown>(ROW.members)]);
      if (curEvents === null || curMembers === null) {
        alert('Could not read the current data, so nothing was changed.');
        return;
      }
      const safety: Snapshot = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        timestamp: new Date().toLocaleString(),
        user: username,
        eventDates: curEvents,
        members: curMembers,
      };
      const saved = await mutateRow<Snapshot>(ROW.dataSnapshots, 'dataSnapshots', (cur) =>
        [safety, ...cur].slice(0, MAX_SNAPSHOTS)
      );
      if (!saved) {
        alert('Could not save a safety snapshot first, so nothing was restored.');
        return;
      }
      const okEvents = await writeRow(ROW.eventDates, 'eventDates', snap.eventDates ?? []);
      const okMembers = await writeRow(ROW.members, 'members', snap.members ?? []);
      if (!okEvents || !okMembers) {
        alert('The restore only partly worked. Restore the safety snapshot at the top of the list to go back.');
        return;
      }
      void logAudit(username, role, 'RESTORE_SNAPSHOT', `Restored Event Attendance data to snapshot from ${snap.timestamp}`);
      alert('Snapshot restored.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.denied}>Access Denied: This area is strictly restricted to Admin accounts only.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>Audit Logs &amp; Edit History</h2>
        <p className={styles.desc}>
          Detailed accountability log showing who added data, modified records, or deleted parameters across the workspace.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User Account</th>
                <th>Action Type</th>
                <th>Description Details</th>
              </tr>
            </thead>
            <tbody>
              {logsLoading ? (
                <tr><td colSpan={4} className={styles.mutedCell}>Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className={styles.mutedCell}>No actions logged yet.</td></tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i}>
                    <td className={`${styles.time} notranslate`}>{log.timestamp}</td>
                    <td className="notranslate">
                      <span className={styles.user}>{log.user}</span> <span className={styles.userRole}>({log.role})</span>
                    </td>
                    <td><span className={`${styles.typeBadge} notranslate`}>{log.type}</span></td>
                    <td className={`${styles.details} notranslate`}>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.title}>🕐 Data Snapshots &amp; Restore</h2>
        <p className={styles.desc}>
          Snapshots of Event Attendance data (event definitions and the member roster). Restoring saves your current data as a
          new snapshot first, so a restore can always be undone.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Saved By</th>
                <th>Events</th>
                <th>Members</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {snapsLoading ? (
                <tr><td colSpan={5} className={styles.mutedCell}>Loading…</td></tr>
              ) : snapshots.length === 0 ? (
                <tr><td colSpan={5} className={styles.mutedCell}>No snapshots recorded yet.</td></tr>
              ) : (
                snapshots.map((snap) => (
                  <tr key={snap.id}>
                    <td className={`${styles.time} notranslate`}>{snap.timestamp}</td>
                    <td className={`${styles.user} notranslate`}>{snap.user}</td>
                    <td className={`${styles.center} notranslate`}>{(snap.eventDates ?? []).length}</td>
                    <td className={`${styles.center} notranslate`}>{(snap.members ?? []).length}</td>
                    <td>
                      <button className={styles.restoreBtn} disabled={busyId !== null} onClick={() => void restore(snap)}>
                        {busyId === snap.id ? 'Restoring…' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default History;
