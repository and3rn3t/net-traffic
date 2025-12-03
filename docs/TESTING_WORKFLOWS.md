# Testing Workflows Overview

## Quick Reference

### Workflow Structure

```
┌─────────────────────────────────────┐
│  CI/CD Workflow (ci-cd.yml)         │
│  ┌───────────────────────────────┐  │
│  │ Unit Tests (always)            │  │
│  │ - Type check                   │  │
│  │ - Lint                         │  │
│  │ - Format check                 │  │
│  │ - Unit tests                   │  │
│  │ - Integration tests            │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ E2E Tests (push to main only) │  │
│  │ - Playwright E2E suite         │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Deploy (after tests pass)      │  │
│  │ - Build                        │  │
│  │ - Deploy to Cloudflare         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Nightly Tests (nightly-tests.yml)  │
│  ┌───────────────────────────────┐  │
│  │ Unit Tests (with coverage)     │  │
│  │ - Full test suite              │  │
│  │ - Coverage reports              │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ E2E Tests                     │  │
│  │ - Complete E2E suite          │  │
│  │ - Playwright reports           │  │
│  └───────────────────────────────┘  │
│  ┌───────────────────────────────┐  │
│  │ Test Summary                   │  │
│  │ - Aggregates results           │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

## When Tests Run

| Event              | Unit Tests | E2E Tests | Deploy |
| ------------------ | ---------- | --------- | ------ |
| Pull Request       | ✅         | ❌        | ❌     |
| Push to main       | ✅         | ✅        | ✅     |
| Nightly (2 AM UTC) | ✅         | ✅        | ❌     |

## Benefits

1. **Fast PR Feedback**: Unit tests run quickly on every PR
2. **Comprehensive Main**: E2E tests ensure main branch quality
3. **Nightly Monitoring**: Catches regressions over time
4. **Cost Efficient**: E2E tests only when needed
5. **Better Coverage**: Nightly runs include coverage tracking
6. **Faster E2E Tests**: 4 workers for parallel execution (~2x faster)
7. **Non-Blocking**: E2E failures don't prevent deployment

## Artifact Retention

- **CI/CD workflow**: 7 days
- **Nightly workflow**: 30 days

## Manual Triggering

All workflows can be manually triggered from the GitHub Actions UI.
