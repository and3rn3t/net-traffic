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
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
