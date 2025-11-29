# Running E2E Tests

## Quick Start

### Option 1: Auto-start (Recommended)

Playwright will automatically start the dev server for you:

```bash
npm run test:e2e
```

### Option 2: Manual Server Start

If auto-start has issues, start the server manually first:

1. **Start the dev server** (in a separate terminal):

   ```bash
   npm run dev
   ```

2. **Wait for the server to be ready** (you should see "Local: <http://localhost:5173>")

3. **Run tests** (in another terminal):

   ```bash
   npm run test:e2e
   ```

## Available Commands

- `npm run test:e2e` - Run all E2E tests (headless)
- `npm run test:e2e:ui` - Run tests in interactive UI mode (recommended for debugging)
- `npm run test:e2e:headed` - Run tests with visible browser
- `npm run test:e2e:debug` - Debug a specific test
- `npm run test:e2e:report` - View the HTML test report

## Running Specific Tests

```bash
# Run a specific test file
npx playwright test tests/e2e/app.spec.ts

# Run a specific test by name
npx playwright test -g "should load the application"

# Run tests matching a pattern
npx playwright test --grep "navigation"
```

## Troubleshooting

### Server Connection Issues

- Ensure port 5173 is not in use by another process
- Check that the dev server is running: `curl http://localhost:5173`
- Increase timeout in `playwright.config.ts` if server takes longer to start

### Tests Failing

- Check the HTML report: `npm run test:e2e:report`
- View screenshots/videos in `test-results/` directory
- Run in UI mode for step-by-step debugging: `npm run test:e2e:ui`

### Backend Requirements

- Most tests work with mock data (no backend needed)
- For full integration testing, start the backend: `cd backend && python main.py`
