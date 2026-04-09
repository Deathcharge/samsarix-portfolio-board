# Helix Collective Dashboard

Real-time monitoring dashboard for the entire Helix Collective ecosystem.

## Features

- 📊 Real-time repository metrics
- 🔄 Auto-refresh every 30 seconds
- 🎨 Beautiful dark theme UI
- 📱 Fully responsive design
- 🚀 GitHub API integration
- ⚡ Fast and lightweight

## Tech Stack

- **Frontend**: React 19 + Vite + TailwindCSS
- **Backend**: Express.js + Octokit (GitHub API)
- **Visualizations**: Recharts

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

This will start both the backend server (port 5000) and frontend dev server (port 5173).

## Production Build

```bash
npm run build
npm start
```

## Environment Variables

Set GITHUB_TOKEN for authenticated API access.

## API Endpoints

- `GET /api/repos` - List all repositories
- `GET /api/repos/:repo/metrics` - Get specific repo metrics
- `GET /api/health` - System health status

## License

Dual licensed under Apache 2.0 and Proprietary License.
