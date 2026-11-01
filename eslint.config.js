// Extends the shared @and3rn3t/eslint-config with net-traffic-specific rules.
// The shared base already sets react-hooks v7's React Compiler rules
// (set-state-in-effect, purity, immutability, …) to warn.
import and3rn3t from '@and3rn3t/eslint-config';

export default [
  ...and3rn3t,
  { ignores: ['*.config.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // shadcn/ui primitives export cva variants next to the component, and each
    // context module exports its provider plus its useX() hook. Splitting them
    // only to satisfy Fast Refresh isn't worth the churn; these files just do
    // a full reload on edit.
    files: ['src/components/ui/**/*.tsx', 'src/contexts/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
];
