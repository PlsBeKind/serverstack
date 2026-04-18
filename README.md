# ServerStack

[![CI](https://github.com/mmaxx45/serverstack/actions/workflows/ci.yml/badge.svg)](https://github.com/mmaxx45/serverstack/actions/workflows/ci.yml)
[![Docker](https://github.com/mmaxx45/serverstack/actions/workflows/docker-build.yml/badge.svg)](https://github.com/mmaxx45/serverstack/actions/workflows/docker-build.yml)
![Alpha](https://img.shields.io/badge/status-alpha-orange)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Self-hosted, multi-provider server inventory and cost tracker. Keep tabs on your servers, contracts, costs, and credentials in one place.

## Features

- Multi-provider server inventory with full CRUD
- Contract management with cost tracking and promo alerts
- Dashboard with cost breakdowns, resource summaries, and charts
- Encrypted credential storage (AES-256-GCM) — passwords never in API list responses
- Automatic alerts for expiring contracts and ending promos
- JSON export/import for backup and migration
- Full i18n support (English + German)
- Dark-mode-first premium UI
- Single Docker container deployment with SQLite

## Quick Start (Docker)

### Using the pre-built image (recommended)

```bash
mkdir serverstack && cd serverstack

# Create docker-compose.yml
cat > docker-compose.yml <<EOF
services:
  serverstack:
    image: ghcr.io/mmaxx45/serverstack:latest
    container_name: serverstack
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - JWT_SECRET=change-me-to-a-random-secret
      - ENCRYPTION_KEY=change-me-32-byte-key-here!!
    restart: unless-stopped
EOF

# Edit the environment variables above, then start
docker compose up -d
```

### Building from source

```bash
git clone https://github.com/mmaxx45/serverstack.git
cd serverstack
cp .env.example .env
# Edit .env and set JWT_SECRET and ENCRYPTION_KEY
docker compose up -d --build
```

Open [http://localhost:3000](http://localhost:3000) and create your admin account.

## Manual Setup

```bash
# Prerequisites: Node.js 22+
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cp .env.example .env
# Start development servers
cd backend && npm run dev &
cd frontend && npm run dev
```

Backend runs on port 3000, frontend dev server on port 5173 (proxies API calls).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT token signing secret |
| `ENCRYPTION_KEY` | Yes | AES-256 key for credential encryption |
| `SMTP_HOST` | No | SMTP server for email alerts |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `ALERT_EMAIL` | No | Email for alert notifications |
| `PORT` | No | Server port (default: 3000) |
| `DEFAULT_LANG` | No | Default language: en or de (default: en) |

## Tech Stack

- **Backend:** Node.js 22, Express 5, better-sqlite3, JWT, bcrypt, node-cron
- **Frontend:** React 19, Vite 6, Tailwind CSS 4, Recharts, Lucide React, Axios, react-i18next
- **Testing:** Vitest + Supertest (backend), Vitest + React Testing Library (frontend)
- **Deployment:** Docker (multi-arch: amd64 + arm64)

## Testing

```bash
npm test              # Run all tests
npm run test:backend  # Backend only
npm run test:frontend # Frontend only
```

## Contributing

1. Fork the repo
2. Create a feature branch from `development`: `git checkout -b feat/my-feature development`
3. Make changes with tests
4. Ensure CI passes: `npm test && cd frontend && npm run build`
5. Open a PR against `development`

## License

[AGPL-3.0](LICENSE)
