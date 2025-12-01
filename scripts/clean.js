#!/usr/bin/env node

/**
 * Cleanup script - Removes build artifacts and temporary files
 */

import { rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const pathsToClean = [
  'dist',
  'node_modules/.vite',
  'playwright-report',
  'test-results',
  '.turbo',
  'coverage',
  '.next',
  'build',
];

const optionalPaths = [
  'node_modules',
  'backend/__pycache__',
  'backend/**/__pycache__',
  'backend/.pytest_cache',
  'backend/.coverage',
  'backend/htmlcov',
  'backend/*.pyc',
  'backend/**/*.pyc',
];

function clean() {
  console.log('🧹 Cleaning build artifacts...\n');

  let cleaned = 0;
  let skipped = 0;

  // Clean required paths
  for (const path of pathsToClean) {
    const fullPath = join(projectRoot, path);
    if (existsSync(fullPath)) {
      try {
        rmSync(fullPath, { recursive: true, force: true });
        console.log(`✅ Removed: ${path}`);
        cleaned++;
      } catch (error) {
        console.error(`❌ Failed to remove ${path}:`, error.message);
      }
    } else {
      skipped++;
    }
  }

  // Clean optional paths (with confirmation)
  const args = process.argv.slice(2);
  const cleanAll = args.includes('--all') || args.includes('-a');

  if (cleanAll) {
    console.log('\n🧹 Cleaning optional paths...\n');
    for (const path of optionalPaths) {
      const fullPath = join(projectRoot, path);
      if (existsSync(fullPath)) {
        try {
          rmSync(fullPath, { recursive: true, force: true });
          console.log(`✅ Removed: ${path}`);
          cleaned++;
        } catch (error) {
          console.error(`❌ Failed to remove ${path}:`, error.message);
        }
      }
    }
  }

  console.log(`\n✨ Cleanup complete! (${cleaned} removed, ${skipped} already clean)`);
  if (!cleanAll && optionalPaths.length > 0) {
    console.log('\n💡 Tip: Use --all or -a to also clean node_modules and Python cache files');
  }
}

clean();

