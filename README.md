# SkinFlow

A premium **Telegram Mini App** for collecting fictional, CS2-inspired weapon skins. Players open virtual cases with free demo coins, build a collection, complete daily missions and track their stats. A separate, secure **admin panel** (also usable as a Mini App through a dedicated admin bot) manages skins, cases, missions and settings.

> **Entertainment only.** Coins and skins are fictional, have **zero monetary value**, and can never be bought, sold, traded, deposited, withdrawn or cashed out. There is intentionally no code path for any of that — including for administrators. All names and artwork are original.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, TanStack Query/Virtual, Zustand |
| Backend | Node.js, Express 5 (runs as a Vercel serverless function or a standalone server) |
| Database | PostgreSQL (`pg`, parameterised SQL, transactions, row locks) |
| Images | `sharp` → WebP optimised + thumbnail; stored in **Vercel Blob** (CDN) or local disk in dev |
| Telegram | WebApp SDK, server-side `initData` HMAC validation, bot webhooks |
| Tests | Vitest, Supertest, Testing Library (66 tests) |

## Features

**Player app** (5 tabs: Home · Cases · Inventory · Missions · Profile)
- Telegram login via signed `initData` (validated on the server), optional server-created guest accounts for browser demos
- Case opening with a server-generated reel: case shake → open → decelerating carousel → rarity-specific reveal (subtle → animated border → particles → premium legendary reveal); skip button; reduced-motion path
- Inventory with search, rarity / weapon / collection filters, newest / rarity / value sort, 2→5 column responsive grid, virtualisation for large inventories
- Skin detail (favorite, collection view), collections with completion, achievements, opening history, level/XP, streaks
- Daily reward (fixed amount), daily / weekly / one-time missions, promo codes — virtual coins only
- Sell skins back for virtual coins (in-app only; coins can never be withdrawn or bought)
- Settings: language (English / Русский / O'zbekcha), sound, animations, haptics, dark theme, reduced motion
- Telegram integration: `ready()`, `expand()`, theme & safe-area insets, native BackButton & MainButton, haptics; particles pause when the app is backgrounded
- Skeleton loaders everywhere, friendly error states with retry (network, server, unauthorized, invalid session, insufficient coins, rate limit, case unavailable, inventory)
- Service worker (cache-first for static assets, never caches API), route-level code splitting, lazy images

**Admin panel** (`/admin`)
- Login with username/password (scrypt) **or** Telegram Mini App via the admin bot (allow-listed Telegram IDs)
- Dashboard: totals + charts (users/day, openings/day, most opened cases, most collected skins, rarity distribution)
- **Skins**: drag-&-drop upload (PNG/JPG/WEBP, size check, preview), automatic WebP optimisation + thumbnail, live preview, virtual price, rarity, weapon, collection (pick or create), active/featured; table with Edit / Duplicate / Activate-Deactivate / Delete
- **Cases**: create/edit, upload image, set cost, assign skins with explicit drop weights, live probability table, case preview, 5 000-opening simulation (no effect on players), deactivate
- Users & inventory inspection (coins, skins, openings, missions), audited virtual-coin adjustments, block/unblock
- Promo codes (reward, usage limit, expiry), bulk weapon renaming, CS2 weapon name suggestions; admin UI in Uzbek
- Openings, missions CRUD (daily/weekly/once), daily reward log, settings (app name, maintenance, animation intensity, daily reward, case availability, min version, cooldown), admin accounts (RBAC owner/admin/viewer), Telegram bot setup, audit logs

## Security

- Telegram `initData` HMAC-SHA256 validation + freshness check; raw client user data is never trusted
- HS256 session tokens for players; admin sessions are opaque random tokens (hashed in DB) in `HttpOnly` cookies + per-session CSRF header
- RBAC (viewer = read-only, admin = content, owner = settings/accounts); every admin mutation is audit-logged
- Case results, rewards, balances and inventory are computed **only on the server** inside a transaction with the user row locked (`SELECT … FOR UPDATE`); `CHECK (virtual_coins >= 0)`; unique constraints for daily rewards and mission claims
- Cryptographically secure weighted random (`crypto.randomInt`) with fixed, admin-visible weights — no hidden modifiers
- Postgres-backed rate limiting (works across serverless instances): global, auth, guest creation, case opening, claims, admin login brute-force lockout
- Zod validation on every input, text sanitisation, parameterised SQL only, magic-byte checks for uploads (SVG rejected), strict CSP / security headers, uploads referenced by server-issued IDs (no arbitrary image URLs)
- Secrets live only in server environment variables — nothing sensitive ships to the browser

## Getting started (local)

```bash
cp .env.example .env          # fill in DATABASE_URL, SESSION_SECRET, ADMIN_* …
npm install
npm run dev                   # API on :3001, Vite on :5173 (proxies /api)
```

The schema and seed data (6 cases, 41 original skins, 6 missions, settings, first admin from `ADMIN_USERNAME`/`ADMIN_PASSWORD`) are created automatically on first request. `npm run db:migrate` does it explicitly.

```bash
npm test                      # needs a Postgres test DB (TEST_DATABASE_URL, default postgres://postgres:postgres@localhost:5432/skinflow_test)
npm run build                 # typecheck + production build to dist/
npm run assets                # regenerate the original placeholder artwork & sounds
```

## Deploying to Vercel

1. Import the repo in Vercel (framework: *Other*; `vercel.json` already configures build, output, rewrites and headers).
2. Storage: add a **Postgres** database (e.g. Neon from the Vercel Marketplace → sets `DATABASE_URL`/`POSTGRES_URL`) and a **Blob** store (sets `BLOB_READ_WRITE_TOKEN`).
3. Environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (`DATABASE_SSL=true` for hosted DBs) |
| `SESSION_SECRET` | ≥ 32 random characters |
| `TELEGRAM_BOT_TOKEN` | Player bot token (verifies `initData`) |
| `ADMIN_TELEGRAM_BOT_TOKEN` | Admin bot token (opens `/admin` as a Mini App) |
| `ADMIN_TELEGRAM_IDS` | Extra Telegram user IDs allowed into the admin panel (the owner ID in `server/config.ts` is always allowed) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | First owner account (created once) |
| `ALLOW_GUEST_LOGIN` | `true` to let browser visitors try the app without Telegram |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (image storage) |
| `PUBLIC_URL` | Optional canonical URL used for bot buttons/webhooks |

4. Open `https://<your-app>/admin` → **Settings → Telegram bots → Connect bots to this deployment**. This sets both bots' webhooks, menu buttons (`Play` / `Admin`) and `/start` commands.
5. Message the admin bot `/start` — it replies with your Telegram ID. Add it to `ADMIN_TELEGRAM_IDS` (or link it under Settings → Admin accounts).

## Project structure

```
api/index.ts              Vercel serverless entry (Express app)
server/
  app.ts                  Express app, security middleware, routing, error handling
  config.ts               Environment configuration
  db/                     pool, idempotent schema, seed catalog, migrations
  lib/                    telegram validation, tokens, passwords, rate limit, random, images, storage
  middleware/             player auth, admin session + CSRF + RBAC + audit log
  routes/                 auth, player API, telegram webhooks, admin API
  services/               case opening, missions, users, settings, serializers
web/
  index.html
  public/assets/          cases/ skins/ icons/ avatars/ sounds/  (original, generated)
  src/                    player app (pages, components, stores, lib) + admin/ (lazy-loaded)
scripts/generate-assets.ts  Generates all original SVG artwork and WAV sounds
tests/                    API, security, transaction and rate-limit tests
```

## API

Player: `POST /api/auth/telegram`, `POST /api/auth/guest`, `GET /api/config`, `GET|PATCH /api/me`, `GET /api/cases`, `GET /api/cases/:id`, `POST /api/cases/:id/open`, `GET /api/inventory`, `GET /api/inventory/:skinId`, `POST /api/inventory/:skinId/favorite`, `GET /api/collections`, `GET /api/openings`, `GET /api/missions`, `POST /api/missions/:id/claim`, `POST /api/daily-reward`, `GET /api/profile`

Admin (`/api/admin/*`): `login`, `login/telegram`, `logout`, `me`, `dashboard`, `users[/:id][/coins|/block]`, `collections`, `skins[/:id][/status|/duplicate]`, `uploads`, `cases[/:id][/items|/preview]`, `openings`, `missions[/:id]`, `rewards`, `settings`, `admins[/:id/telegram]`, `telegram[/setup]`, `logs`
