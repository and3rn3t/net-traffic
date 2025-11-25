# NetInsight - Deep Network Analysis

A comprehensive network traffic analysis dashboard built with React, TypeScript, and Vite.

## 🚀 Features

- Real-time network traffic monitoring
- Advanced analytics and visualization
- Geographic distribution mapping
- Protocol breakdown and analysis
- Security posture monitoring
- Anomaly detection

## 🛠️ Development

### Prerequisites

- Node.js 20 or higher
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📦 Deployment to Cloudflare Pages

This project is configured for automatic deployment to Cloudflare Pages via GitHub Actions.

### Initial Setup

1. **Create a Cloudflare API Token:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template or create custom token with:
     - Account.Cloudflare Pages:Edit
     - Zone.Zone:Read (if using custom domains)
   - Copy the token

2. **Get your Cloudflare Account ID:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Your Account ID is shown in the right sidebar

3. **Configure GitHub Secrets:**
   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token
     - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID

### Automatic Deployment

Once configured, the project will automatically deploy:

- **Production:** Pushes to `main` or `master` branch
- **Preview:** Pull requests to `main` or `master` branch

The GitHub Actions workflow will:
1. Build the project using `npm run build`
2. Deploy the `dist` directory to Cloudflare Pages
3. Create preview deployments for pull requests

### Manual Deployment

You can also deploy manually using Wrangler CLI:

```bash
# Install Wrangler globally (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=net-traffic
```

## 📁 Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── lib/           # Utilities and types
│   ├── hooks/         # Custom React hooks
│   └── styles/        # CSS styles
├── .github/
│   ├── workflows/        # GitHub Actions workflows
│   └── ISSUE_TEMPLATE/   # Issue templates
├── .vscode/              # VS Code workspace settings
├── src/                  # Source code
└── vite.config.ts        # Vite build configuration
```

## 🔧 Configuration

- `vite.config.ts`: Vite build settings
- `eslint.config.js`: ESLint configuration
- `.prettierrc.json`: Prettier formatting rules
- `.github/workflows/`: CI/CD pipelines
- See [WORKSPACE_CONFIG.md](./WORKSPACE_CONFIG.md) for detailed configuration guide

## 📄 License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.
