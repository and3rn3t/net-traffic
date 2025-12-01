#!/usr/bin/env node

/**
 * Health Check Script
 * Checks the health of frontend and backend services
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function loadEnv() {
  const envPath = join(projectRoot, '.env');
  try {
    const content = readFileSync(envPath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    return env;
  } catch {
    return {};
  }
}

async function checkBackend(apiUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { status: 'error', message: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { status: 'ok', data };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { status: 'error', message: 'Request timeout' };
    }
    return { status: 'error', message: error.message };
  }
}

async function checkServices(apiUrl) {
  const services = ['storage', 'packet-capture', 'analytics', 'device', 'threat'];

  const results = {};

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${apiUrl}/api/health/${service}`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        results[service] = { status: 'ok', data };
      } else {
        results[service] = { status: 'error', message: `HTTP ${response.status}` };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        results[service] = { status: 'error', message: 'Request timeout' };
      } else {
        results[service] = { status: 'error', message: error.message };
      }
    }
  }

  return results;
}

async function main() {
  const env = loadEnv();
  const apiUrl = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL || 'http://localhost:8000';

  console.log('🏥 Health Check\n');
  console.log(`Backend URL: ${apiUrl}\n`);

  // Check main health endpoint
  console.log('Checking main health endpoint...');
  const health = await checkBackend(apiUrl);
  if (health.status === 'ok') {
    console.log('✅ Backend is healthy');
    if (health.data) {
      console.log(`   Status: ${health.data.status || 'unknown'}`);
      if (health.data.version) {
        console.log(`   Version: ${health.data.version}`);
      }
    }
  } else {
    console.log(`❌ Backend health check failed: ${health.message}`);
    console.log('   Make sure the backend is running on', apiUrl);
    process.exit(1);
  }

  // Check individual services
  console.log('\nChecking individual services...');
  const services = await checkServices(apiUrl);

  for (const [service, result] of Object.entries(services)) {
    if (result.status === 'ok') {
      console.log(`✅ ${service}: healthy`);
    } else {
      console.log(`⚠️  ${service}: ${result.message}`);
    }
  }

  console.log('\n✨ Health check complete!');
}

main().catch(error => {
  console.error('❌ Health check failed:', error.message);
  process.exit(1);
});
