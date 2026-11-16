import { Link, Outlet } from 'react-router';

/** Layout around every page: header with the app name, and the current page below. */
export function AppShell() {
  return (
    <>
      <header>
        <Link to="/">Whim</Link>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
