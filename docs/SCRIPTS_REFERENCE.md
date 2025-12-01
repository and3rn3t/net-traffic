# Scripts Reference

This document provides an overview of all available scripts in the NetInsight project.

## Frontend Scripts (npm)

### Development

- `npm run dev` - Start development server
- `npm run preview` - Preview production build
- `npm run build` - Build for production (without type checking)
- `npm run build:check` - Build for production (with type checking)

### Code Quality

- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run validate` - Run all validation checks (type-check, lint, format:check)
- `npm run pre-commit` - Run pre-commit validation checks

### Testing

- `npm run test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:e2e:ui` - Run E2E tests with UI
- `npm run test:e2e:headed` - Run E2E tests in headed mode
- `npm run test:e2e:debug` - Debug E2E tests
- `npm run test:e2e:report` - Show E2E test report
- `npm run test:all` - Run all tests (unit + E2E)

### Maintenance

- `npm run clean` - Clean build artifacts (dist, cache, etc.)
- `npm run clean:all` - Clean everything including node_modules and Python cache
- `npm run check-deps` - Check for outdated npm dependencies and security issues
- `npm run check-deps:python` - Check for outdated Python dependencies
- `npm run analyze-bundle` - Analyze production bundle size
- `npm run validate:env` - Validate environment configuration
- `npm run health-check` - Check backend health status

### Backend Scripts

- `npm run backend:setup` - Set up Python virtual environment and install dependencies
- `npm run db:backup` - Create a backup of the SQLite database

## Shell Scripts

### Backend Setup (`scripts/backend-setup.sh`)

Sets up the Python backend environment:

- Creates virtual environment if it doesn't exist
- Installs/upgrades pip
- Installs Python dependencies
- Creates `.env` file from `.env.example` if missing

**Usage:**

```bash
bash scripts/backend-setup.sh
# or
npm run backend:setup
```

### Database Backup (`scripts/db-backup.sh`)

Creates a timestamped backup of the SQLite database:

- Creates backup in `backend/backups/` directory
- Compresses backup with gzip
- Shows backup size and recent backups

**Usage:**

```bash
bash scripts/db-backup.sh
# or
npm run db:backup
```

### Raspberry Pi Scripts

- `scripts/raspberry-pi-start.sh` - Start NetInsight on Raspberry Pi
- `scripts/raspberry-pi-update.sh` - Update NetInsight on Raspberry Pi

## Node.js Scripts

### Clean (`scripts/clean.js`)

Removes build artifacts and temporary files:

- `dist/` - Production build
- `node_modules/.vite` - Vite cache
- `playwright-report/` - Playwright test reports
- `test-results/` - Test results
- `coverage/` - Test coverage reports

**Usage:**

```bash
npm run clean          # Clean build artifacts
npm run clean:all      # Clean everything including node_modules
```

### Check Dependencies (`scripts/check-deps.js`)

Checks for outdated and vulnerable dependencies:

- Checks npm packages for updates
- Runs npm security audit
- Optionally checks Python packages

**Usage:**

```bash
npm run check-deps           # Check npm dependencies
npm run check-deps:python    # Check npm and Python dependencies
```

### Analyze Bundle (`scripts/analyze-bundle.js`)

Analyzes the production bundle size:

- Lists top 10 largest files
- Shows total bundle size
- Provides optimization recommendations

**Usage:**

```bash
npm run analyze-bundle
```

### Pre-commit (`scripts/pre-commit.js`)

Runs validation checks before committing:

- Type checking
- Linting
- Format checking

**Usage:**

```bash
npm run pre-commit
```

**Note:** This can be integrated into Git hooks:

```bash
# Install as pre-commit hook
echo 'npm run pre-commit' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Health Check (`scripts/health-check.js`)

Checks the health of backend services:

- Main health endpoint
- Individual service health (storage, packet-capture, analytics, device, threat)

**Usage:**

```bash
npm run health-check
```

### Validate Environment (`scripts/validate-env.js`)

Validates environment configuration:

- Checks required environment variables
- Validates optional variables
- Provides setup tips

**Usage:**

```bash
npm run validate:env
```

## Workflow Examples

### Daily Development

```bash
# Start development
npm run dev

# In another terminal, validate before committing
npm run validate
```

### Before Committing

```bash
# Run pre-commit checks
npm run pre-commit

# Or run full validation
npm run validate
```

### Setting Up New Environment

```bash
# Install dependencies
npm install

# Set up backend
npm run backend:setup

# Validate environment
npm run validate:env
```

### Production Build

```bash
# Clean previous builds
npm run clean

# Build with type checking
npm run build:check

# Analyze bundle size
npm run analyze-bundle
```

### Maintenance

```bash
# Check for dependency updates
npm run check-deps

# Clean build artifacts
npm run clean

# Backup database
npm run db:backup

# Check backend health
npm run health-check
```

## Integration with Git Hooks

To automatically run validation before commits, you can set up a pre-commit hook:

```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
npm run pre-commit
EOF

chmod +x .git/hooks/pre-commit
```

Or use a tool like [Husky](https://github.com/typicode/husky) for more advanced hook management.

## CI/CD Integration

These scripts are designed to work well in CI/CD pipelines:

- `npm run validate` - Full validation suite
- `npm run test:all` - All tests
- `npm run build:check` - Production build with type checking
- `npm run health-check` - Service health verification

See `.github/workflows/ci-cd.yml` for example CI/CD usage.
