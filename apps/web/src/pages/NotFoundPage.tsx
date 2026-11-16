import { Link } from 'react-router';

import styles from './Page.module.css';

export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.lead}>There&apos;s nothing at this address.</p>
      <Link to="/">Back to home</Link>
    </section>
  );
}
