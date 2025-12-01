#!/usr/bin/env node

/**
 * Pre-commit Hook Script
 * Runs validation checks before committing
 */

import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const checks = [
  { name: 'Type Check', command: 'npm run type-check' },
  { name: 'Linter', command: 'npm run lint' },
  { name: 'Format Check', command: 'npm run format:check' },
];

let failed = false;

console.log('🔍 Running pre-commit checks...\n');

for (const check of checks) {
  try {
    console.log(`✓ Running ${check.name}...`);
    execSync(check.command, { stdio: 'pipe', cwd: projectRoot });
    console.log(`  ✅ ${check.name} passed\n`);
  } catch (error) {
    console.error(`  ❌ ${check.name} failed\n`);
    failed = true;
  }
}

if (failed) {
  console.error('❌ Pre-commit checks failed. Please fix the errors before committing.');
  console.log('\n💡 Quick fixes:');
  console.log('  - Run "npm run lint:fix" to auto-fix linting issues');
  console.log('  - Run "npm run format" to auto-fix formatting issues');
  process.exit(1);
}

console.log('✅ All pre-commit checks passed!');
process.exit(0);
