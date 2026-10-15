import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import '../../styles/sidebar-theme.css';
import styles from './Sidebar.module.css';

const LOGO_URL = 'https://sqrrfslqwcgpsmzdovru.supabase.co/storage/v1/object/public/assets/IMG_6300.png';

function NavPlate({ to, end, label, onClick }: { to: string; end?: boolean; label: string; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `sb-plate sb-plate-green ${styles.plate} ${isActive ? `active ${styles.plateActive}` : ''}`
      }
    >
      <span className={styles.plateText}>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { currentUser, logout } = useAuth();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);

  const isManagementOrAdmin = currentUser.role === 'admin' || currentUser.role === 'management';
  const isAdmin = currentUser.role === 'admin';
  const close = () => setOpen(false);

  return (
    <>
      <button className={styles.hamburger} onClick={() => setOpen((p) => !p)} aria-label={t('toggleMenu')}>
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
        <span className={styles.hamburgerLine} />
      </button>

      {open && <div className={styles.overlay} onClick={close} />}

      <aside
        className={`sb-theme ${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}
        data-lang={language}
      >
        <img src="/sidebar/logo-zoo.png" alt="ZOO" className={styles.zoo} />

        <div className={styles.user}>
          <img src={LOGO_URL} alt="" className={styles.avatar} />
          <div className={`sb-plate sb-plate-blue ${styles.plate} ${styles.userPlate}`}>
            <span className={styles.plateText}>{(currentUser.username || 'Member').toUpperCase()}</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <ul className={styles.menu}>
            <li><NavPlate to="/" end label={t('homepage')} onClick={close} /></li>
            <li><NavPlate to="/notice" label={t('notice')} onClick={close} /></li>
            <li><NavPlate to="/members" label={t('members')} onClick={close} /></li>
            <li><NavPlate to="/events" label={t('eventAttendance')} onClick={close} /></li>
          </ul>

          {isManagementOrAdmin && (
            <>
              <div className={styles.sectionTitle}>{t('managementAdmin')}</div>
              <ul className={styles.menu}>
                <li><NavPlate to="/discussion" label={t('discussionRoom')} onClick={close} /></li>
                {isAdmin && (
                  <>
                    <li><NavPlate to="/history" label={t('editHistoryAudit')} onClick={close} /></li>
                    <li><NavPlate to="/roles" label={t('assignUserRoles')} onClick={close} /></li>
                  </>
                )}
              </ul>
            </>
          )}
        </nav>

        <div className={styles.footer}>
          <button
            type="button"
            className={`sb-plate sb-plate-pink ${styles.plate} ${styles.logoutPlate}`}
            onClick={logout}
          >
            <span className={styles.plateText}>{t('logOut')}</span>
          </button>
          <LanguageSwitcher />
        </div>
      </aside>
    </>
  );
}
