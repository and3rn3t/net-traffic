#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * Analyzes the production bundle size
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distPath = join(projectRoot, 'dist');

function analyzeBundle() {
  console.log('📊 Analyzing bundle size...\n');

  if (!existsSync(distPath)) {
    console.log('⚠️  dist/ directory not found. Building first...\n');
    try {
      execSync('npm run build', { stdio: 'inherit', cwd: projectRoot });
    } catch (error) {
      console.error('❌ Build failed:', error.message);
      process.exit(1);
    }
  }

  try {
    const assetsPath = join(distPath, 'assets');
    if (!existsSync(assetsPath)) {
      console.error('❌ assets directory not found in dist/');
      process.exit(1);
    }

    let files = [];
    try {
      // Try recursive readdir (Node 20+)
      files = readdirSync(assetsPath, { recursive: true });
    } catch {
      // Fallback for older Node versions
      files = readdirSync(assetsPath);
    }

    let totalSize = 0;
    const fileSizes = [];

    for (const file of files) {
      const filePath = join(assetsPath, file);
      try {
        const stats = statSync(filePath);
        if (stats.isFile()) {
          const size = stats.size;
          totalSize += size;
          fileSizes.push({ name: file, size });
        }
      } catch {
        // Skip files that can't be accessed
      }
    }

    // Sort by size (largest first)
    fileSizes.sort((a, b) => b.size - a.size);

    console.log('📦 Bundle Size Breakdown:\n');
    console.log('Top 10 largest files:');
    fileSizes.slice(0, 10).forEach((file, index) => {
      const sizeKB = (file.size / 1024).toFixed(2);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const sizeStr = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
      console.log(`  ${index + 1}. ${file.name}: ${sizeStr}`);
    });

    const totalKB = (totalSize / 1024).toFixed(2);
    const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
    const totalStr = totalSize > 1024 * 1024 ? `${totalMB} MB` : `${totalKB} KB`;

    console.log(`\n📊 Total bundle size: ${totalStr}`);
    console.log(`   Files: ${fileSizes.length}`);

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (totalSize > 2 * 1024 * 1024) {
      console.log('  ⚠️  Bundle is large (>2MB). Consider code splitting or lazy loading.');
    }
    if (fileSizes[0]?.size > 500 * 1024) {
      console.log(`  ⚠️  Largest file (${fileSizes[0].name}) is >500KB. Consider optimization.`);
    }
    if (fileSizes.length > 20) {
      console.log('  ⚠️  Many files detected. Consider bundling optimization.');
    }
  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
    process.exit(1);
  }
}

analyzeBundle();
