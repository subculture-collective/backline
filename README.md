<p align="center"><img src="brand/backline/social-banner.png" alt="Backline banner: the road-case mark beside the Backline wordmark and the line &quot;The gear behind your community.&quot; on a dark case-black background." width="100%"></p>

# Backline

**Keep your people together.** Backline is a Discord bot with a web dashboard for the people who run a server. It welcomes new members, keeps a record of moderation, gives members a private place to ask for help, and runs events, levels, feeds and audio. Every module starts switched off; turn on the ones your server needs.

Backline is a release candidate in a private pilot with the SUBCULT community. Public installation is not open yet. The landing page is at [backline.subcult.tv](https://backline.subcult.tv/). You can run your own copy from this repository.

## What it does

- **A good first hello.** Welcome messages, a rules gate, and roles members pick for themselves.
- **Keep the context.** Warnings, timeouts, kicks, bans and purges land in a case history with a reason and the staff member who acted. Delivery is confirmed against current Discord permissions, never assumed.
- **Make room to listen.** Private tickets that the opener, invited participants, configured staff and server administrators can see. Transcripts expire on the schedule you choose.
- **Your server, your rules.** Every module is opt-in per server, configured from the dashboard or `/settings` in Discord, and starts disabled.
- **Nothing silent.** Moderation and settings changes are durable jobs with a state you can read back. Recovery snapshots are owner-confirmed before anything is restored.

## 23 modules, five groups

| Group                   | Modules                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Welcome and community   | Onboarding, self-assigned roles, birthdays, AFK status, suggestions, polls, community reports                              |
| Safety and records      | Moderation, anti-spam, audit log, private tickets, activity reports                                                        |
| Engagement              | Leveling, giveaways, economy, entertainment, audio (radio, clips and soundboards)                                          |
| Automation and recovery | Scheduled utilities, custom commands, Twitch/YouTube/RSS integrations, workflows, recovery snapshots and selective restore |
| Operator extensions     | Plugins installed by the bot operator                                                                                      |

Each module has a developer note under [`docs/developer/`](./docs/developer/), for example [onboarding](./docs/developer/onboarding.md), [moderation](./docs/developer/moderation.md), [tickets](./docs/developer/tickets.md) and [recovery](./docs/developer/selective-restore.md).

## The dashboard

Sign in with Discord and Backline shows the servers where you hold Manage Server permission.

- **Overview**: what is switched on, what is waiting on the operator, moderation actions still in flight, API service state, and the newest cases.
- **Server setup**: the module catalog, grouped as above, with search, state filters and collapsible settings per module.
- **Moderation**: queue an action, follow its delivery, and read the case table.
- **Activity, analytics and metrics**: observed member activity, channel heatmaps, suspicion and ghost scores, network and flow diagrams, and usage metrics. Activity collection is a module the server enables; nothing is collected until it does.
- **Status**: database, cache and Discord API availability.

It ships in light and dark mode, honors reduced-motion preferences, and is built on a documented [design system](./docs/design/APP-SYSTEM.md) that carries the [Backline identity](./docs/design/BACKLINE.md).

## Tech stack

- **Bot and API**: Node.js 22, Express, TypeScript, Prisma, PostgreSQL behind PgBouncer, Redis
- **Bot runtime**: discord.js with durable job polling and a singleton Gateway session
- **Dashboard**: React 19, Vite, Tailwind CSS, Recharts and D3, i18next (English, Spanish, French, German, Japanese)
- **Authentication**: Discord OAuth2 with JWT access and refresh sessions
- **Docs**: VitePress

```bash
backend/        # Discord bot, API server, Prisma schema, plugins
frontend/       # React dashboard and landing page
sdk/            # TypeScript/JavaScript SDK for the public API
docs/           # VitePress documentation site
brand/          # Provenance for the generated brand assets
scripts/        # Backup, restore, migration and maintenance scripts
```

## Quick start

### Docker (recommended)

```bash
cp .env.example .env
# Fill in your Discord credentials and secrets
docker-compose -f docker-compose.dev.yml up
```

- Dashboard: http://localhost:5173
- API: http://localhost:3001
- PostgreSQL: localhost:5432

See [DOCKER.md](./DOCKER.md) for the full setup.

### Manual

```bash
# Backend
cd backend
npm install
npx prisma migrate dev --name init
npm run dev          # Discord bot and job worker
npm run dev:api      # API server

# Frontend
cd frontend
npm install
npm run dev
```

Running `npm install` in the repository root installs the Git hooks (ESLint and Prettier on staged files, type checks before push, conventional commit messages).

## Configuration

The backend validates its environment with [Zod](https://zod.dev/) on startup and exits with code 1 if anything required is missing or malformed.

### Backend (`backend/.env`)

| Variable                | Description                                                 | Validation        |
| ----------------------- | ----------------------------------------------------------- | ----------------- |
| `DISCORD_BOT_TOKEN`     | Bot token from the Discord Developer Portal                 | Min 50 characters |
| `DISCORD_CLIENT_ID`     | OAuth2 client ID                                            | Min 10 characters |
| `DISCORD_CLIENT_SECRET` | OAuth2 client secret                                        | Min 20 characters |
| `DISCORD_REDIRECT_URI`  | OAuth2 redirect, e.g. `http://localhost:5173/auth/callback` | Valid URL         |
| `JWT_SECRET`            | Signs access tokens                                         | Min 32 characters |
| `JWT_REFRESH_SECRET`    | Signs refresh tokens                                        | Min 32 characters |

Optional variables with their defaults:

| Variable                     | Description                                      | Default                  |
| ---------------------------- | ------------------------------------------------ | ------------------------ |
| `NODE_ENV`                   | `development`, `staging`, `production` or `test` | `development`            |
| `PORT`                       | API port                                         | `3001`                   |
| `DATABASE_URL`               | PostgreSQL connection string                     | -                        |
| `DISCORD_GUILD_ID`           | Pin the dashboard to one server                  | -                        |
| `BOT_GUILD_IDS`              | Comma-separated servers to monitor               | -                        |
| `ADMIN_DISCORD_IDS`          | Comma-separated admin user IDs                   | -                        |
| `CORS_ORIGINS`               | Comma-separated allowed origins                  | `http://localhost:5173`  |
| `JWT_ACCESS_EXPIRES_IN`      | Access token lifetime                            | `15m`                    |
| `JWT_REFRESH_EXPIRES_IN`     | Refresh token lifetime                           | `7d`                     |
| `REDIS_URL`                  | Redis connection string                          | `redis://localhost:6379` |
| `ENABLE_RATE_LIMITING`       | Rate limiting on or off                          | `true`                   |
| `ENABLE_REDIS_RATE_LIMITING` | Redis-backed distributed limits                  | `true`                   |
| `ENABLE_IP_BLOCKING`         | Automatic IP blocking                            | `true`                   |
| `ENABLE_LOAD_SHEDDING`       | Shed load under pressure                         | `true`                   |
| `LOG_LEVEL`                  | `error`, `warn`, `info` or `debug`               | `info`                   |
| `FRONTEND_URL`               | Dashboard URL for redirects                      | -                        |

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Modules that need privileged Discord intents (member, message content, voice state) also need those intents enabled on the bot by the operator. The dashboard marks such modules "Needs operator" until that is done.

### Frontend (`frontend/.env`)

| Variable                     | Description                                    | Required           |
| ---------------------------- | ---------------------------------------------- | ------------------ |
| `VITE_API_URL`               | API base URL, e.g. `http://localhost:3001/api` | Yes                |
| `VITE_DISCORD_CLIENT_ID`     | Discord OAuth2 client ID                       | Yes                |
| `VITE_ENVIRONMENT`           | Environment label                              | No (`development`) |
| `VITE_ENABLE_ANALYTICS`      | Dashboard usage analytics                      | No (`false`)       |
| `VITE_ANALYTICS_TRACKING_ID` | Analytics tracking ID                          | No                 |

Frontend variables are embedded in the build and visible to every visitor. Never put a secret in one.

## Testing

```bash
# Backend
cd backend
npm test                  # all tests
npm run test:unit
npm run test:integration
npm run test:coverage

# Frontend
cd frontend
npm test                  # unit and component tests (vitest)
npm run test:e2e          # Playwright
npm run test:coverage
```

Frontend tests run under jsdom. See [TESTING.md](./TESTING.md) for the test layout.

## Deploy

[compose.release.yml](./compose.release.yml) runs a release: PostgreSQL, Redis, a one-off migration step, the API, a single bot and job worker, and the compiled dashboard. Run exactly one bot replica, because it owns the Discord Gateway session. Copy `release-example.env` and `release-runtime-example.env` to a private location, fill them in, and point the Compose file at your backend and dashboard images. [DEPLOYMENT.md](./DEPLOYMENT.md) walks through the steps, backups and a restore check.

`docker-compose.prod.yml` and the `k8s/`, `helm/` and `terraform/` directories come from earlier work and are not the documented release path.

## API, SDK and plugins

The API is guild-scoped: `/api/guilds`, `/api/guilds/:guildId/modules`, `/api/guilds/:guildId/moderation/cases`, `/api/guilds/:guildId/jobs/:jobId` and per-module routes for history, diagnostics and actions. Moderation actions take an idempotency key, so a lost response can be retried safely.

- **Swagger UI**: `/api/docs` · **ReDoc**: `/api/redoc` · **OpenAPI 3.0**: `/api/openapi.json`
- [Public API reference](./docs/PUBLIC_API.md), [developer guide](./docs/DEVELOPER_GUIDE.md), [authentication](./docs/api/AUTHENTICATION_GUIDE.md), [rate limiting](./docs/api/RATE_LIMITING_GUIDE.md)
- The public API uses API keys with tier-based quotas (FREE, PRO, ENTERPRISE) and per-endpoint rate limits.

The TypeScript SDK lives in [`sdk/`](./sdk/) (package name `@spywatcher/sdk`):

```typescript
import { Spywatcher } from '@spywatcher/sdk';

const client = new Spywatcher({
    baseUrl: 'http://localhost:3001/api',
    apiKey: 'spy_live_your_api_key_here',
});
const ghosts = await client.analytics.getGhosts();
```

Plugins extend the bot and API without touching core code: dynamic loading, a permission system, event hooks, custom routes and lifecycle management through `/api/plugins`. Start from [`backend/plugins/template`](./backend/plugins/template/) and read the [plugin system guide](./PLUGIN_SYSTEM.md).

## Operations

- **Security**: multi-layer rate limiting, request validation, IP blocking and load shedding with circuit breakers. [RATE_LIMITING.md](./RATE_LIMITING.md), [SECURITY.md](./SECURITY.md)
- **Database**: PostgreSQL with PgBouncer transaction pooling and Prisma. [CONNECTION_POOLING.md](./CONNECTION_POOLING.md), [POSTGRESQL.md](./POSTGRESQL.md), [DATABASE_OPTIMIZATION.md](./DATABASE_OPTIMIZATION.md)
- **Backup and recovery**: scheduled encrypted backups, WAL archiving for point-in-time recovery, and documented drills. `npm run db:backup`, `npm run db:restore` and `npm run backup:health-check` in `backend/`. [BACKUP.md](./BACKUP.md), [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md)
- **Monitoring**: Sentry, Prometheus metrics, structured Winston logs, liveness and readiness probes, and Grafana with Loki and Promtail. [MONITORING.md](./MONITORING.md), [LOGGING.md](./LOGGING.md)
- **Privacy**: consent-gated dashboard analytics and data controls. [PRIVACY_ANALYTICS.md](./PRIVACY_ANALYTICS.md)

## Documentation

- [User guide](./docs/guide/), [admin guide](./docs/admin/), [developer guide](./docs/developer/), [API reference](./docs/api/)
- Design: [app design system](./docs/design/APP-SYSTEM.md), [landing page and identity](./docs/design/BACKLINE.md)

```bash
npm run docs:dev       # local docs server
npm run docs:build
npm run docs:preview
```

## Code quality

ESLint with security and accessibility rules, Prettier, strict TypeScript, Husky and lint-staged hooks, and conventional commits enforced by commitlint.

```bash
npm run lint           # backend and frontend
npm run lint:fix
npm run format
npm run type-check
```

## Contributing

Report bugs and request features in [GitHub issues](https://github.com/subculture-collective/backline/issues). Ask questions and share ideas in [GitHub Discussions](https://github.com/subculture-collective/backline/discussions). Send code as a pull request on GitHub against `main`.

Read the [contributing guidelines](./CONTRIBUTING.md), the [code of conduct](./CODE_OF_CONDUCT.md) and the [security policy](./SECURITY.md). Commit messages follow Conventional Commits.

CI runs on every pull request: backend lint, type check, Prisma validation, build, tests and PostgreSQL integration tests; frontend lint, type check, tests, build and Playwright end-to-end tests; a documentation build; dependency audits; and image, Compose and secret scans. All of them must pass before a pull request can merge.

## License

GNU General Public License, version 3 or later (`GPL-3.0-or-later`). See [LICENSE](LICENSE).
