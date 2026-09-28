import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import styles from './Sidebar.module.css';

const LOGO_URL = 'https://sqrrfslqwcgpsmzdovru.supabase.co/storage/v1/object/public/assets/IMG_6300.png';

export default function Sidebar() {
  const { currentUser, logout } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const isManagementOrAdmin = currentUser.role === 'admin' || currentUser.role === 'management';
  const isAdmin = currentUser.role === 'admin';

  function closeOnNavigate() {
    setOpen(false);
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.item} ${isActive ? styles.itemActive : ''}`;

  return (
    <>
      <button className={styles.hamburger} onClick={() => setOpen((prev) => !prev)} aria-label={t('toggleMenu')}>
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
      </button>

      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.logo}>
          <img src={LOGO_URL} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>

        <div className={styles.user}>
          <div className={styles.userAvatar}>{(currentUser.username || 'M').charAt(0).toUpperCase()}</div>
          <div>
            <div className={styles.userName}>{(currentUser.username || 'Member').toUpperCase()}</div>
            <div className={styles.userRole}>{t('role')} {(currentUser.role || 'member').toUpperCase()}</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.menu}>
            <li>
              <NavLink to="/" end onClick={closeOnNavigate} className={linkClass}>
                <span className={styles.icon}>⬦</span> {t('homepage')}
              </NavLink>
            </li>
            <li>
              <NavLink to="/notice" onClick={closeOnNavigate} className={linkClass}>
                <span className={styles.icon}>⬦</span> {t('notice')}
              </NavLink>
            </li>
            <li>
              <NavLink to="/members" onClick={closeOnNavigate} className={linkClass}>
                <span className={styles.icon}>⬦</span> {t('members')}
              </NavLink>
            </li>
            <li>
              <NavLink to="/blackgold" onClick={closeOnNavigate} className={linkClass}>
                <span className={styles.icon}>⬦</span> {t('blackGold')}
              </NavLink>
            </li>
            <li>
              <NavLink to="/events" onClick={closeOnNavigate} className={linkClass}>
                <span className={styles.icon}>⬦</span> {t('eventAttendance')}
              </NavLink>
            </li>
            <li>
              <NavLink to="/vspoints" onClick={closeOnNavigate} className={linkClass}>
                <span className={styles.icon}>⬦</span> {t('vsPoints')}
              </NavLink>
            </li>
          </ul>

          {isManagementOrAdmin && (
            <>
              <div className={styles.sectionTitle}>{t('managementAdmin')}</div>
              <ul className={styles.menu}>
                <li>
                  <NavLink to="/discussion" onClick={closeOnNavigate} className={linkClass}>
                    <span className={styles.icon}>|</span> {t('discussionRoom')}
                  </NavLink>
                </li>
                {isAdmin && (
                  <>
                    <li>
                      <NavLink to="/history" onClick={closeOnNavigate} className={linkClass}>
                        <span className={styles.icon}>|</span> {t('editHistoryAudit')}
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/roles" onClick={closeOnNavigate} className={linkClass}>
                        <span className={styles.icon}>|</span> {t('assignUserRoles')}
                      </NavLink>
                    </li>
                  </>
                )}
              </ul>
            </>
          )}
        </nav>

        <div className={styles.footer}>
          <LanguageSwitcher />
          <a className={`${styles.item} ${styles.logout}`} onClick={logout}>
            <span className={styles.icon}>|</span> {t('logOut')}
          </a>
        </div>
      </aside>
    </>
  );
}
