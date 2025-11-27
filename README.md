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

## ⚙️ Environment Configuration

The application uses environment variables to configure API connections and behavior.

### Environment Variables

Create a `.env` file in the project root (see `.env.example` for a template):

```env
# Enable/disable real API mode
# Set to 'true' to connect to backend API, 'false' to use mock data
VITE_USE_REAL_API=false

# Backend API Base URL
# Default: http://localhost:8000
# For Raspberry Pi: http://<raspberry-pi-ip>:8000
VITE_API_BASE_URL=http://localhost:8000
```

### Environment Variable Reference

| Variable            | Description                                   | Default                 | Required |
| ------------------- | --------------------------------------------- | ----------------------- | -------- |
| `VITE_USE_REAL_API` | Enable real backend API mode (`true`/`false`) | `false`                 | No       |
| `VITE_API_BASE_URL` | Backend API server URL                        | `http://localhost:8000` | No       |

### Validation

Validate your environment configuration:

```bash
npm run validate:env
```

This script will:

- Check that all environment variables are set correctly
- Validate URL formats
- Warn about missing or incorrect configurations
- Provide setup tips

### Usage Modes

**Mock Data Mode (Default):**

- Set `VITE_USE_REAL_API=false` or omit the variable
- Application uses generated mock data
- Works completely offline
- Useful for development and testing UI

**Real API Mode:**

- Set `VITE_USE_REAL_API=true`
- Set `VITE_API_BASE_URL` to your backend server URL
- Connects to Raspberry Pi 5 backend or local backend
- Requires backend to be running
- Provides real-time data via WebSocket

### Example Configurations

**Local Development (Mock Data):**

```env
VITE_USE_REAL_API=false
```

**Local Development (Backend on same machine):**

```env
VITE_USE_REAL_API=true
VITE_API_BASE_URL=http://localhost:8000
```

**Raspberry Pi Backend:**

```env
VITE_USE_REAL_API=true
VITE_API_BASE_URL=http://192.168.1.100:8000
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

## 📚 Documentation

Comprehensive documentation is available in the project:

### For Users

- **[USER_GUIDE.md](./USER_GUIDE.md)** - Complete user guide with getting started, features, and troubleshooting

### For Developers

- **[AGENT_INSTRUCTIONS.md](./AGENT_INSTRUCTIONS.md)** - Instructions for AI agents and developers
- **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** - Frontend-backend integration guide
- **[PERFORMANCE_OPTIMIZATIONS.md](./PERFORMANCE_OPTIMIZATIONS.md)** - Performance optimization guide

### Project Management

- **[ROADMAP.md](./ROADMAP.md)** - Development roadmap and phases
- **[REMAINING_TASKS.md](./REMAINING_TASKS.md)** - Current task list with priorities
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Complete documentation index

See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a full list of all documentation files.

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
