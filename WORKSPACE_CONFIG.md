# Workspace Configuration Guide

This document outlines all the workspace configuration and settings for the NetInsight project.

## 📋 Configuration Files Overview

### Code Quality & Formatting

- **`eslint.config.js`** - ESLint configuration for code linting
  - Uses flat config format (ESLint 9+)
  - Configured for TypeScript and React
  - Includes React Hooks and React Refresh plugins

- **`.prettierrc.json`** - Prettier configuration for code formatting
  - Single quotes, semicolons, 100 char line width
  - Consistent formatting across the codebase

- **`.prettierignore`** - Files to exclude from Prettier formatting

- **`.editorconfig`** - Editor configuration for consistent coding styles
  - UTF-8 encoding, LF line endings
  - 2-space indentation for most files

### Editor Configuration

- **`.vscode/settings.json`** - VS Code workspace settings
  - Format on save enabled
  - ESLint auto-fix on save
  - Prettier as default formatter
  - TypeScript workspace version

- **`.vscode/extensions.json`** - Recommended VS Code extensions
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript

### Version Management

- **`.nvmrc`** - Node.js version specification
  - Currently set to Node.js 20
  - Use `nvm use` to switch to the correct version

### CI/CD

- **`.github/workflows/ci.yml`** - Continuous Integration workflow
  - Runs on push and pull requests
  - Type checking
  - Linting
  - Format checking

- **`.github/workflows/deploy.yml`** - Deployment workflow
  - Builds and deploys to Cloudflare Pages
  - Automatic project creation
  - Preview deployments for PRs

### GitHub Templates

- **`.github/ISSUE_TEMPLATE/bug_report.md`** - Bug report template
- **`.github/ISSUE_TEMPLATE/feature_request.md`** - Feature request template
- **`.github/pull_request_template.md`** - Pull request template

## 🛠️ Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run preview      # Preview production build locally
```

### Building
```bash
npm run build        # Build for production (skips type check)
npm run build:check  # Build with full type checking
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint and auto-fix issues
npm run format       # Format code with Prettier
npm run format:check # Check code formatting
npm run type-check   # Run TypeScript type checking
npm run validate     # Run all checks (type-check + lint + format)
```

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Install Recommended VS Code Extensions
VS Code will prompt you to install recommended extensions, or install manually:
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

### 3. Configure Node Version (if using nvm)
```bash
nvm use
```

### 4. Verify Setup
```bash
npm run validate
```

## 📝 Code Style Guidelines

### Formatting
- Use Prettier for all formatting (runs on save in VS Code)
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- 100 character line width

### Linting
- ESLint runs on save (auto-fix enabled)
- Follow React Hooks rules
- TypeScript strict mode enabled
- Unused variables should be prefixed with `_`

### TypeScript
- Use TypeScript for all new files
- Enable strict null checks
- Avoid `any` type (warnings enabled)
- Use proper type definitions

## 🚀 Pre-commit Workflow

While not configured by default, you can add pre-commit hooks using tools like:
- **Husky** - Git hooks made easy
- **lint-staged** - Run linters on staged files

Example setup:
```bash
npm install -D husky lint-staged
npx husky init
```

Then add to `package.json`:
```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

## 🔍 Continuous Integration

The CI workflow (`.github/workflows/ci.yml`) automatically runs:
- Type checking on every push and PR
- Linting on every push and PR
- Format checking on every push and PR

All checks must pass before merging PRs.

## 📦 Dependencies Management

- **Renovate** - Automated dependency updates
  - Configuration: `renovate.json`
  - Creates PRs for dependency updates
  - Uses recommended presets

## 🎯 Best Practices

1. **Always run `npm run validate` before committing**
2. **Use VS Code recommended extensions** for best experience
3. **Follow the PR template** when creating pull requests
4. **Run type checking** before pushing: `npm run type-check`
5. **Format code** before committing: `npm run format`

## 🔗 Related Documentation

- [ESLint Configuration](https://eslint.org/docs/latest/use/configure/)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [EditorConfig](https://editorconfig.org/)
- [VS Code Settings](https://code.visualstudio.com/docs/getstarted/settings)

