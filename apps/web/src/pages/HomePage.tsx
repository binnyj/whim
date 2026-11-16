import styles from './Page.module.css';

/** Placeholder home page; the location → mood flow replaces it. */
export function HomePage() {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>I have some free time. What should I do?</h1>
      <p className={styles.lead}>
        Whim finds something fun nearby that fits your mood and your time.
      </p>
    </section>
  );
}
