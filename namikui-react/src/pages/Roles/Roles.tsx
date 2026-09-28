import { useCallback, useEffect, useState } from 'react';
import styles from './Roles.module.css';
import { db } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { logAudit } from '../../lib/appData';

// Columns come straight from the `accounts` table (same ones AuthContext queries)
interface AccountRow {
  user_id: string;
  username: string;
  role: string;
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'alliance', label: 'Alliance Member' },
  { value: 'management', label: 'Management' },
  { value: 'admin', label: 'Admin' },
];

export function Roles() {
  const { currentUser, refreshAccounts } = useAuth();
  const username = currentUser.username ?? 'Unknown';
  const isAdmin = currentUser.role === 'admin';

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.from('accounts').select('*');
    if (error) {
      console.error('Could not load accounts:', error);
      setLoading(false);
      return;
    }
    const rows = ((data ?? []) as AccountRow[]).slice().sort((a, b) => a.username.localeCompare(b.username));
    setAccounts(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
    else setLoading(false);
  }, [isAdmin, load]);

  const save = async (acc: AccountRow) => {
    const newRole = pending[acc.user_id] ?? acc.role;
    if (newRole === acc.role) return;
    if (
      acc.username === username &&
      !window.confirm('You are changing your own role. If you remove Admin you will lose access to this page. Continue?')
    ) {
      return;
    }
    setSavingId(acc.user_id);
    const { data, error } = await db.from('accounts').update({ role: newRole }).eq('user_id', acc.user_id).select();
    setSavingId(null);
    if (error) {
      console.error('Could not update role:', error);
      alert('Could not update role. Please try again.');
      return;
    }
    if (!data || data.length === 0) {
      alert('The role was not changed. The database did not allow the update.');
      return;
    }
    setAccounts((list) => list.map((a) => (a.user_id === acc.user_id ? { ...a, role: newRole } : a)));
    setPending((p) => {
      const next = { ...p };
      delete next[acc.user_id];
      return next;
    });
    void logAudit(username, currentUser.role, 'ASSIGN_ROLE', `Admin changed role for user [${acc.username}] from ${acc.role} to ${newRole}`);
    await refreshAccounts();
  };

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.denied}>Only Admin can assign roles.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.pageTitle}>Assign User Roles</h1>
        <div className={styles.pageSubtext}>Manage user roles and system clearance</div>
      </div>
      <div className={styles.card}>
        <p className={styles.desc}>Pick a role for each account, then press Save on that row.</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Current Role</th>
                <th>New Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className={styles.mutedCell}>Loading…</td></tr>
              ) : accounts.length === 0 ? (
                <tr><td colSpan={4} className={styles.mutedCell}>No registered accounts found yet.</td></tr>
              ) : (
                accounts.map((acc) => {
                  const value = pending[acc.user_id] ?? acc.role;
                  return (
                    <tr key={acc.user_id}>
                      <td className={`${styles.name} notranslate`}>{acc.username}</td>
                      <td className="notranslate">{acc.role}</td>
                      <td>
                        <select
                          className={styles.select}
                          value={value}
                          onChange={(e) => setPending((p) => ({ ...p, [acc.user_id]: e.target.value }))}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          className={styles.saveBtn}
                          disabled={value === acc.role || savingId === acc.user_id}
                          onClick={() => void save(acc)}
                        >
                          {savingId === acc.user_id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Roles;
