# TempleOS

Cloud-based Temple Management Platform (multi-tenant SaaS). See [docs/DEVELOPMENT-PLAN.md](docs/DEVELOPMENT-PLAN.md) for the full architecture.

## Structure

| Path | Purpose |
|---|---|
| `apps/admin` | Temple admin portal — app.templeos.com (dev: `localhost:3000`) |
| `apps/sites` | Public tenant websites — `{tenant}.templeos.com` (dev: `{tenant}.localhost:3001`) |
| `packages/core` | **All business logic** — services → repositories → Drizzle |
| `packages/db` | Drizzle schema, migrations, RLS policies |
| `packages/validators` | Zod schemas (single source of truth for input shapes) |
| `packages/auth` | Supabase auth helpers, tenant context resolution |
| `packages/ui` | Shared design-system primitives |
| `packages/config` | Shared tsconfig presets |

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in Supabase credentials
pnpm db:generate       # generate SQL migrations from Drizzle schema
pnpm dev               # admin on :3000, sites on :3001
```

Visit a tenant site locally at `http://demo.localhost:3001`.

## Commands

```bash
pnpm typecheck   # tsc across all packages
pnpm lint        # eslint (strict TS, no `any`)
pnpm test        # vitest
pnpm build       # turbo build
```

## Architecture rules (enforced in review)

1. Business logic lives **only** in `packages/core`. Server Actions and API routes are thin adapters.
2. Every repository method takes a `TenantContext` as its first argument. No unscoped queries.
3. All external input is parsed with Zod at the boundary. No `as` casts of external data.
4. Services return `Result<T, DomainError>` — throwing is for programmer errors only.
