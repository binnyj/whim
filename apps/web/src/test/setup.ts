// Adds DOM matchers like toBeInTheDocument(), unmounts rendered components and restores mocks
// (e.g. a stubbed fetch) after each test.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
