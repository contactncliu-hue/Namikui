import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar/Sidebar';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout() {
  return (
    <div className={styles.app}>
      <Sidebar />
      <main className={styles.main}>
        <Outlet />
        <div className={styles.footerBar}>
          <span>♦ Loopy's Playground · Alliance Management Tool</span>
        </div>
      </main>
    </div>
  );
}
