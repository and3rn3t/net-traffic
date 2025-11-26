/**
 * Test setup file for Vitest
 * Configures testing environment and global mocks
 */

import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Set environment variables for tests
// This ensures USE_REAL_API is true in tests that need it
// Note: This must be set before modules are imported
if (!import.meta.env.VITE_USE_REAL_API) {
  Object.defineProperty(import.meta, 'env', {
    value: {
      ...import.meta.env,
      VITE_USE_REAL_API: 'true',
      VITE_API_BASE_URL: 'http://localhost:8000',
    },
    writable: true,
    configurable: true,
  });
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock URL.createObjectURL and revokeObjectURL (not available in jsdom)
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Suppress console errors in tests (optional - remove if you want to see them)
// global.console = {
//   ...console,
//   error: vi.fn(),
//   warn: vi.fn(),
// };
