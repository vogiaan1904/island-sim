import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only cleans up by itself when the test globals are on; the repo's tests import from 'vitest'.
afterEach(cleanup);
