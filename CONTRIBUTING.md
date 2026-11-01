# Contributing

Thank you for your interest in contributing! This guide will help you get started.

## How to Contribute

1. **Fork** the repository
2. **Create a branch** from `main` (see [Branch Naming](#branch-naming))
3. **Make your changes** with clear, focused commits
4. **Push** your branch and open a **Pull Request**

## Development Setup

```bash
git clone https://github.com/and3rn3t/net-traffic.git
cd net-traffic

# Frontend (Node version in .nvmrc)
npm install
npm run dev                    # http://localhost:5001, mock data unless VITE_USE_REAL_API=true

# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
python -m pytest
```

## Branch Naming

Use the format `type/short-description`:

- `feature/user-authentication`
- `fix/login-redirect-loop`
- `docs/update-api-reference`
- `chore/upgrade-dependencies`

Commit messages follow Conventional Commits and are checked by commitlint (`.husky/commit-msg`, header ≤ 100 chars).

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): short description

Optional longer body explaining what and why.

Refs: #123
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`

**Examples:**

```
feat(auth): add OAuth2 login flow
fix(api): handle null response from user endpoint
docs: update contributing guide
test(cart): add edge case tests for empty cart
```

## Pull Request Process

1. Fill out the [PR template](.github/pull_request_template.md) completely
2. Ensure all checks pass (lint, tests, build)
3. Request a review from at least one maintainer
4. Address review feedback
5. A maintainer will merge your PR once approved

Keep PRs focused on a single logical change. Large changes should be split into smaller PRs.

## Code Style

This project uses shared code style guidelines enforced through:

- [`.editorconfig`](.editorconfig) — Cross-editor formatting
- [`eslint.config.js`](eslint.config.js) and [`.prettierrc.json`](.prettierrc.json) — lint and format rules (frontend)
- [`backend/pyproject.toml`](backend/pyproject.toml) — ruff rules (backend)
- [AGENTS.md](AGENTS.md#conventions) — naming and code conventions

Run the linter before submitting:

```bash
npm run validate               # type-check + lint + format check
cd backend && ruff check .     # backend
```

## Testing

All new code should include tests. Follow the patterns documented in:

- [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) — test layers, patterns and CI expectations

```bash
npm run test:run                       # frontend unit tests
cd backend && python -m pytest         # backend
```

## AI-Assisted Development

This repository includes configuration files for AI coding assistants (Copilot, Cursor, Windsurf, Cline, Claude Code). These files define project conventions so AI tools produce consistent, high-quality code.

- [AGENTS.md](AGENTS.md) is the single source of truth for AI assistants; `CLAUDE.md` points to it

You can use AI tools while contributing — the config files ensure generated code aligns with project standards.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code. Report unacceptable behavior to the project maintainers.

## Questions?

[File an issue](https://github.com/and3rn3t/net-traffic/issues).
