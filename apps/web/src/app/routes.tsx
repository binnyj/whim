import type { RouteObject } from 'react-router';

import { HomePage } from '../pages/HomePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AppShell } from './AppShell';

/** Every route in the app. Shared by the browser router and tests (via a memory router). */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
