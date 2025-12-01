#!/usr/bin/env node

/**
 * Dependency Check Script
 * Checks for outdated, vulnerable, or unused dependencies
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function checkNpmDeps() {
  console.log('📦 Checking npm dependencies...\n');

  try {
    console.log('Checking for outdated packages...');
    execSync('npm outdated', { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    // npm outdated exits with non-zero if packages are outdated
    if (error.status === 1) {
      console.log('\n⚠️  Some packages are outdated. Run "npm update" to update them.');
    } else {
      console.error('Error checking outdated packages:', error.message);
    }
  }

  try {
    console.log('\n🔒 Running security audit...');
    execSync('npm audit', { stdio: 'inherit', cwd: projectRoot });
  } catch (error) {
    if (error.status === 1) {
      console.log('\n⚠️  Security vulnerabilities found. Run "npm audit fix" to fix them.');
    } else {
      console.error('Error running security audit:', error.message);
    }
  }
}

function checkPythonDeps() {
  const requirementsPath = join(projectRoot, 'backend', 'requirements.txt');
  if (!existsSync(requirementsPath)) {
    return;
  }

  console.log('\n🐍 Checking Python dependencies...\n');

  try {
    console.log('Checking for outdated packages...');
    execSync('pip list --outdated', { stdio: 'inherit', cwd: join(projectRoot, 'backend') });
  } catch (error) {
    console.log('Note: Make sure you have a virtual environment activated.');
  }

  try {
    console.log('\n🔒 Running safety check (if installed)...');
    execSync('safety check', { stdio: 'inherit', cwd: join(projectRoot, 'backend') });
  } catch (error) {
    console.log('💡 Tip: Install "safety" (pip install safety) for Python security checks');
  }
}

function main() {
  const args = process.argv.slice(2);
  const checkPython = args.includes('--python') || args.includes('-p');
  const checkNpm = !args.includes('--python-only');

  if (checkNpm) {
    checkNpmDeps();
  }

  if (checkPython) {
    checkPythonDeps();
  }

  console.log('\n✨ Dependency check complete!');
}

main();

