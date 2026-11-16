import { ApiError } from '../../api/api-error';
import styles from './ApiStatus.module.css';
import { useHealth } from './use-health';

/** Shows whether the API is reachable: loading, up (with version), or down with a retry button. */
export function ApiStatus() {
  const { data, error, isPending, isFetching, refetch } = useHealth();

  let content;
  if (isPending) {
    content = <span>Checking the API…</span>;
  } else if (error) {
    const message =
      error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
    content = (
      <>
        <span className={styles.down}>API is down.</span>
        <span>{message}</span>
        <button
          type="button"
          className={styles.retry}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </>
    );
  } else {
    content = (
      <>
        <span className={styles.up}>API is up</span>
        <span>v{data.version}</span>
      </>
    );
  }

  return (
    <div role="status" aria-live="polite" className={styles.status}>
      {content}
    </div>
  );
}
