# AGENTS.md — Chatbot Gobern

## Quick commands

```bash
pnpm dev           # Next.js dev with Turbopack
pnpm check         # Lint + typecheck (ultracite)
pnpm fix           # Auto-fix lint + format (ultracite)
pnpm test          # Playwright e2e tests (sets PLAYWRIGHT=True internally)
pnpm db:migrate    # Apply Drizzle migrations (PostgreSQL)
pnpm db:generate   # Create migration from schema changes
pnpm db:push      # Push schema directly to DB (skip migrations, dev only)
pnpm build        # Runs db:migrate first, then next build
```

## Architecture: demo-first, Flowise-only

This is a fork of the Vercel AI SDK Chatbot template running in **demo mode**. All routes redirect to the Flowise-powered Legislativo chat — no auth, no PostgreSQL, no AI Gateway required.

- **Proxy** (`proxy.ts`): bypasses all auth. Health check at `/ping` returns `pong`.
- **Root route** `/` redirects to `/legislativo-chat` (see `app/(chat)/page.tsx`).
- **Legislativo chat**: standalone, no auth, no DB. Uses Flowise API via `/api/legislativo-chat`.
- **Main chat** (`/api/chat`): disabled in demo mode by the root redirect. Requires DB + AI Gateway if re-enabled.
- **Auth.js, Drizzle, Redis**: code still present but never loaded in the demo flow (import chains are clean).

## Environment variables

- Primary env file is `.env.local` (not `.env`) — used by drizzle config AND playwright config
- `.env` is gitignored, `.env.example` is the template
- Legislativo mode requires: `FLOWISE_API_URL`, `FLOWISE_CHATFLOW_ID` (and optional `FLOWISE_API_KEY`)
- For full functionality: `POSTGRES_URL`, `AUTH_SECRET`, `REDIS_URL`, `BLOB_READ_WRITE_TOKEN`
- `IS_DEMO=1` enables `/demo` base path mode
- `PLAYWRIGHT=True` switches AI providers to mocks (test environment detection)

## Key architectural constraints

- **packageManager is pnpm 10.32.1** — enforced in package.json; CI uses pnpm
- **Ultracite (Biome) for linting/formatting** — `pnpm check` in CI, format-on-save in VSCode
- **Biome excludes from linting**: `components/ai-elements/`, `components/elements/`, `components/ui/`, `lib/utils.ts`, `hooks/use-mobile.ts` (auto-generated/shadcn files)
- **Build runs migrations first**: `pnpm build` = `tsx lib/db/migrate && next build` — schema must be valid at build time. In demo mode, set `POSTGRES_URL` or remove the `db:migrate` step from the build script.
- **Import alias `@/*`** maps to root (not `src/`) — e.g. `import { foo } from "@/lib/constants"`
- **Database**: PostgreSQL via Drizzle ORM. Schema: `lib/db/schema.ts`. Migrations: `lib/db/migrations/`. Drizzle config reads from `.env.local`. Not required for demo mode.
- **Auth**: Auth.js v5 beta (next-auth). Disabled in demo mode by proxy bypass. Guest users identified by regex `guestRegex = /^guest-\d+$/`.
- **AI**: Test environment swaps to mock providers in `lib/ai/providers.ts`. Production uses `ai.gateway.languageModel()`. Not needed in demo mode (Flowise handles AI).
- **Rate limiting**: Redis-based IP rate limit (`lib/ratelimit.ts`), 10 msgs/hour, production only
- **Bot protection**: `botid` on `/api/chat` POST (configured in `instrumentation-client.ts`)
- **Error handling**: Custom `ChatbotError` class with typed error codes (`type:surface`), surfaces errors per-context (`lib/errors.ts`)
- **Next.js 16 experimental**: React Compiler enabled, `cacheComponents`, `cachedNavigations`, `inlineCss`, Turbopack

## Testing

- **Playwright e2e only** — no unit tests. Tests live in `tests/e2e/`.
- Run single test: `pnpm exec playwright test --grep "test name"` or target a file: `pnpm exec playwright test tests/e2e/chat.test.ts`
- Playwright reads `.env.local` for secrets, launches `pnpm dev` as web server, health-checks `/ping`
- On CI: `PLAYWRIGHT=True` is set by the test script, which toggles mock AI providers
- CI secrets required: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, `REDIS_URL`
- Only Chromium tests, max 2 workers, 240s timeout per test, `forbidOnly` on CI

## Additional reference files

- `.cursor/rules/ultracite.mdc` — full Ultracite/Biome rule set (a11y, React, TS conventions)
