import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './Login.module.css';

const LOGO_URL = 'https://sqrrfslqwcgpsmzdovru.supabase.co/storage/v1/object/public/assets/IMG_6300.png';

export default function Login() {
  const { login, createAccount } = useAuth();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');

  async function handleSubmitLogin() {
    setLoggingIn(true);
    const result = await login(loginUsername, loginPassword);
    setLoggingIn(false);
    if (!result.ok) {
      setLoginError(result.message);
      return;
    }
    setShowLoginModal(false);
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
  }

  async function handleSubmitCreateAccount() {
    const result = await createAccount(newUser, newPass);
    if (!result.ok) {
      alert(result.message);
      return;
    }
    setShowCreateModal(false);
    const createdName = newUser;
    setNewUser('');
    setNewPass('');
    alert(`Account ${createdName} successfully created! You can now log in using these details.`);
  }

  return (
    <div className={styles.loginPage}>
      <header className={styles.loginHeader} />
      <main className={styles.loginMain}>
        <section className={styles.loginCard}>
          <div className={styles.logoWrapper}>
            <div className={styles.logoCircle}>
              <img src={LOGO_URL} alt="logo" className={styles.logoImg} />
            </div>
          </div>
          <h1 className={styles.title}>Alliance Management Tool</h1>
          <button
            type="button"
            className={styles.loginButton}
            onClick={() => {
              setLoginError('');
              setShowLoginModal(true);
            }}
          >
            LOG IN
          </button>
          <button type="button" className={styles.guestLink} onClick={() => setShowCreateModal(true)}>
            Create Account
          </button>
        </section>
      </main>

      {showLoginModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>System Login</h3>
            {loginError && <div className={styles.errorMsg}>{loginError}</div>}
            <input
              type="text"
              placeholder="Username (admin, manager, member...)"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitLogin()}
            />
            <div className={styles.modalBtns}>
              <button className={styles.btnOutline} onClick={() => setShowLoginModal(false)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleSubmitLogin} disabled={loggingIn}>
                {loggingIn ? 'Logging in…' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>Create New Account</h3>
            <input
              type="text"
              placeholder="Choose Username"
              value={newUser}
              onChange={(e) => setNewUser(e.target.value)}
            />
            <input
              type="password"
              placeholder="Choose Password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <div className={styles.roleInfo}>
              New accounts are registered as Members by default. Only an Admin can assign roles after logging in.
            </div>
            <div className={styles.modalBtns}>
              <button className={styles.btnOutline} onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleSubmitCreateAccount}>
                Register
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
