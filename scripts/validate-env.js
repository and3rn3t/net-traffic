#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Validates that required environment variables are set correctly
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Required environment variables
const REQUIRED_VARS = {
  // VITE_USE_REAL_API is optional (defaults to false)
  // VITE_API_BASE_URL is optional (defaults to http://localhost:8000)
};

// Optional but recommended environment variables
const OPTIONAL_VARS = {
  VITE_USE_REAL_API: {
    description: 'Enable real API mode (true/false)',
    default: 'false',
    validator: value => value === 'true' || value === 'false',
  },
  VITE_API_BASE_URL: {
    description: 'Backend API base URL',
    default: 'http://localhost:8000',
    validator: value => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
  },
};

function loadEnvFile() {
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
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  No .env file found. Using defaults.');
      return {};
    }
    throw error;
  }
}

function checkRequiredVars(env, issues) {
  for (const varName of Object.keys(REQUIRED_VARS)) {
    const value = process.env[varName] || env[varName];
    if (!value) {
      issues.push(`❌ Missing required variable: ${varName}`);
    }
  }
}

function checkOptionalVars(env, issues, warnings) {
  for (const [varName, config] of Object.entries(OPTIONAL_VARS)) {
    const value = process.env[varName] || env[varName];
    if (value) {
      if (config.validator && !config.validator(value)) {
        issues.push(`❌ Invalid value for ${varName}: "${value}"\n   ${config.description}`);
      }
    } else {
      warnings.push(
        `⚠️  ${varName} not set (using default: ${config.default})\n   ${config.description}`
      );
    }
  }
}

function checkApiConfiguration(env, warnings) {
  const useRealApi = process.env.VITE_USE_REAL_API || env.VITE_USE_REAL_API;
  const apiBaseUrl = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL;

  if (useRealApi === 'true') {
    if (!apiBaseUrl || apiBaseUrl === 'http://localhost:8000') {
      warnings.push(
        '⚠️  VITE_USE_REAL_API is true but VITE_API_BASE_URL is not configured for production.\n   Make sure to set VITE_API_BASE_URL to your backend server URL.'
      );
    }
  }
}

function printResults(issues, warnings, env) {
  if (issues.length > 0) {
    console.log('❌ Validation failed:\n');
    issues.forEach(issue => console.log(issue));
    console.log('\n');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    warnings.forEach(warning => console.log(warning));
    console.log('\n');
  }

  console.log('✅ Environment configuration is valid!\n');

  // Print current configuration
  const useRealApi = process.env.VITE_USE_REAL_API || env.VITE_USE_REAL_API;
  const apiBaseUrl = process.env.VITE_API_BASE_URL || env.VITE_API_BASE_URL;
  console.log('📋 Current Configuration:');
  console.log(`   VITE_USE_REAL_API: ${useRealApi || OPTIONAL_VARS.VITE_USE_REAL_API.default}`);
  console.log(`   VITE_API_BASE_URL: ${apiBaseUrl || OPTIONAL_VARS.VITE_API_BASE_URL.default}`);
  console.log('');

  // Provide setup instructions if needed
  if (!useRealApi || useRealApi === 'false') {
    console.log('💡 Tip: To enable real API mode:');
    console.log('   1. Set VITE_USE_REAL_API=true in your .env file');
    console.log('   2. Set VITE_API_BASE_URL to your backend server URL');
    console.log('   3. Make sure your backend is running\n');
  }
}

function validateEnv() {
  console.log('🔍 Validating environment configuration...\n');

  const env = loadEnvFile();
  const issues = [];
  const warnings = [];

  checkRequiredVars(env, issues);
  checkOptionalVars(env, issues, warnings);
  checkApiConfiguration(env, warnings);
  printResults(issues, warnings, env);

  process.exit(0);
}

// Run validation
validateEnv();
