import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's automatic afterEach(cleanup) only registers when
// a global `afterEach` exists (i.e. vitest's `test.globals: true`), which
// this project's vitest.config.ts does not enable. Without this, DOM from
// one test leaks into the next within the same file. Register it explicitly.
afterEach(() => {
  cleanup();
});
