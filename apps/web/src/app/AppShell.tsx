import { Link, Outlet } from 'react-router';

import styles from './AppShell.module.css';

/** Layout around every page: header with the app name, and the current page below. */
export function AppShell() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            Whim
          </Link>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
