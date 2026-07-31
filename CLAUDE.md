# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Backend (port 5000)
cd server && npm run dev

# Frontend (port 3000, Next.js App Router)
cd client && npm run dev
```

### Linting & Formatting

```bash
# Server
cd server && npm run lint
cd server && npm run format

# Client
cd client && npm run lint
```

### Production Build

```bash
# Frontend → Netlify
cd client && npm run build:next

# Backend → starts on Render
cd server && npm start
```

### Testing

```bash
# Server unit (Jest + Supertest, models mocked, no DB)
cd server && npm run test:unit
cd server && npm run test:coverage

# Server Mongo/Replica Set integration (real MongoMemoryReplSet)
cd server && npm run test:mongo

# Client (Vitest + Testing Library)
cd client && npm test
cd client && npm run test:watch

# Mobile (Jest + React Native Testing Library)
cd altimmo-app && npm run test:coverage

# Browser E2E (Playwright — spins up its own MongoMemoryReplSet + Express + Next dev server)
cd client && npm run test:e2e
```

**Server tests** live in `server/__tests__/`. Plain `*.test.js` files are unit tests (no DB, models mocked) — `npm test`/`npm run test:unit` run only these. `*.mongo.integration.test.js` and `*.replica.integration.test.js` files hit a real MongoDB (via `mongodb-memory-server`) and are excluded from `test:unit`; run them with `npm run test:mongo` (uses its own script, `scripts/run-mongo-tests.js`, to manage the replica set lifecycle).

**Client tests** live in `client/lib/__tests__/` — component and utility tests (Testing Library + jsdom).

**Mobile tests** live in `altimmo-app/src/**/__tests__/`.

**E2E tests** live in `client/e2e/` — full browser flows (Playwright, `desktop-chromium` + `mobile-chromium` projects) against a seeded, ephemeral backend. Not run in the `lint.yml`/`mobile-validation.yml` CI workflows' `test` jobs; see `.github/workflows/e2e.yml`.

Exact test counts are intentionally not documented here — they drift with every PR; check `npm test`/`npm run test:mongo` output for the current numbers rather than trusting a hardcoded figure.

## Architecture

**Stack**: Node.js/Express + MongoDB (Mongoose) | Next.js 15 App Router + React 18 + Tailwind CSS 3

**Monorepo layout**:
- `server/` — Express REST API (port 5000)
- `client/` — Next.js frontend deployed to Netlify
- `netlify.toml` — build config (`base: client`, `publish: .next`, `@netlify/plugin-nextjs`)

### Three Business Verticals

The app is organized around three domains, each with its own models, routes, and controllers:

| Pole | Domain | Key models |
|------|--------|------------|
| **Altimmo** | Real estate | Property, Transaction |
| **Altcom** | Business services | AltcomProject, PortfolioItem |
| **Mila Events** | Event planning | Event, Quote, Review |

All poles share the `User` model (roles: `Client`, `Collaborateur`, `Admin`, `Prestataire`, `Proprietaire`).

### Backend (`server/`)

MVC-like: each feature has `routes/<feature>Routes.js` → `controllers/<feature>Controller.js` → `models/<Feature>.js`.

**Middleware order**: Helmet → CORS → JSON parsing → gzip → Morgan → rate-limit → `authMiddleware.js` → route handlers → `errorMiddleware.js`

**Auth pattern**: JWT in `Authorization: Bearer <token>` header. Token payload contains `userId`, `role`, `tokenVersion`. Increment `user.tokenVersion` in DB to globally invalidate all tokens for a user (no blacklist needed).

**API response shape**:
```javascript
{ status: 'success' | 'error', data: {...}, message: '...', results: [...] }
```

**File uploads**: Use `uploadMiddleware` (wraps Cloudinary). Send `FormData` from frontend; receive a Cloudinary URL back.

**Background jobs** (node-cron):
- Facebook sync: every hour
- IMAP email polling (Zoho): every 5 minutes

### Frontend (`client/`)

```
client/
├── app/              # Next.js App Router pages (auth/, dashboard/, altimmo/, altcom/, mila-events/, admin/)
├── lib/
│   ├── components/   # Reusable UI components (PascalCase .jsx)
│   ├── services/     # API calls — one file per domain (propertyService.js, eventService.js…)
│   ├── context/      # AuthContext.js — single auth source of truth
│   ├── hooks/        # Custom hooks (useAltcomData, useUnreadCount…)
│   └── utils/        # Helpers
└── components/       # Legacy admin components
```

**All API calls go through service files** (`lib/services/<domain>Service.js`), never directly from components.

**State**: React Context only — no Redux. Token stored in `localStorage`.

**Protected routes**: wrap pages in `ProtectedRoute` (auth check) or `RoleProtectedRoute` (role check).

**Styling**: Tailwind CSS only, no CSS modules or inline styles. Custom colors: `secondary`, `gold`. Fonts: Cormorant Garamond (display), DM Sans (body).

### Adding a New Feature (end-to-end pattern)

1. `server/models/NewFeature.js` — Mongoose schema
2. `server/routes/newFeatureRoutes.js` + `server/controllers/newFeatureController.js`
3. Register route in `server/server.js`
4. `client/lib/services/newFeatureService.js` — API calls
5. `client/app/new-feature/page.jsx` — page component (add `'use client'` if interactive)

## Code Conventions

- `const` everywhere, `async/await` (not `.then()`)
- Functional React components with hooks only (no class components)
- Naming: components `PascalCase.jsx`, services `camelCase.js`, hooks `use<Feature>.js`, API routes `kebab-case`
- Log format: `🔍` info, `✅` success, `❌` error, `⚠️` warning

## Environment Variables

- Backend `.env` lives in `server/.env`
- Frontend `.env` lives in `client/.env`
- Key backend vars: `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_*`, `ZOHO_*`
- Key frontend vars: `NEXT_PUBLIC_API_URL` (points to backend)
