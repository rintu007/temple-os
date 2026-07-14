# TempleOS — Software Architecture & Development Plan

| | |
|---|---|
| **Document** | Architecture & Development Plan v1.0 |
| **Product** | TempleOS — Cloud Temple Management Platform (SaaS) |
| **Status** | Approved — Phase 0 in progress |
| **Date** | 2026-07-15 |
| **Launch market** | India + Bangladesh first, then global (decided 2026-07-15) |

---

## 1. High-Level System Architecture

TempleOS is a multi-tenant SaaS composed of three client surfaces sharing one backend core:

```
                        ┌─────────────────────────────────────────────┐
                        │                  CLIENTS                    │
                        │                                             │
   {tenant}.templeos.com│  Public Sites   Admin Portal   Mobile App   │
   custom domains ──────┤  (Next.js)      (Next.js)      (Expo, later)│
                        └──────┬───────────────┬──────────────┬───────┘
                               │               │              │
                        Server Components  Server Actions   REST /api/v1
                               │               │              │
                        ┌──────▼───────────────▼──────────────▼───────┐
                        │           APPLICATION CORE (packages/core)  │
                        │                                             │
                        │   Services  ──►  Repositories  ──►  Drizzle │
                        │   (business      (data access,      ORM    │
                        │    logic,         tenant-scoped)            │
                        │    authorization)                           │
                        └──────┬──────────────────────────────────────┘
                               │
        ┌──────────────┬───────┼──────────┬─────────────┬─────────────┐
        │              │       │          │             │             │
   Supabase       Supabase  Supabase   Inngest       Resend      Payment
   PostgreSQL     Auth      Storage    (jobs, crons, (email)     Providers
   (+ RLS)                            workflows)                 (Stripe/
                                                                  Razorpay)
```

**Core principles**

1. **One core, many surfaces.** All business logic lives in `packages/core` (services + repositories). Server Actions, REST route handlers, and Inngest jobs are thin adapters over the same services. The mobile app never needs new business logic — only the REST adapter.
2. **Tenant isolation is enforced twice.** Application layer (every repository method requires a tenant context) *and* database layer (Postgres RLS). A bug in one layer is caught by the other.
3. **Public sites are cache-first.** Tenant websites are rendered from published CMS content with ISR/tag-based revalidation, so thousands of temple sites cost near-zero at rest.
4. **Everything async goes through Inngest.** Emails, receipts, recurring donation charges, notification fan-out, report generation — no fire-and-forget promises inside request handlers.

---

## 2. Monorepo Structure (Turborepo + pnpm)

```
temple-os/
├── apps/
│   ├── admin/                 # Admin portal — app.templeos.com
│   ├── sites/                 # Public tenant websites — {tenant}.templeos.com + custom domains
│   └── marketing/             # templeos.com landing/pricing (Phase 2; static-heavy)
│
├── packages/
│   ├── core/                  # ★ Business logic: services, repositories, domain types, errors
│   ├── db/                    # Drizzle schema, migrations, seed, RLS policies (SQL)
│   ├── auth/                  # Supabase auth helpers, session/tenant context, RBAC guards
│   ├── validators/            # Zod schemas — single source of truth for input/output shapes
│   ├── ui/                    # shadcn/ui-based design system (shared across apps)
│   ├── email/                 # React Email templates + Resend sender
│   ├── jobs/                  # Inngest function definitions
│   ├── api-client/            # Typed client for /api/v1 (used by mobile later)
│   └── config/                # Shared eslint, tsconfig, tailwind presets
│
├── tooling/                   # Codegen, scripts, CI helpers
├── docs/                      # This document, ADRs, runbooks
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

**Why two runtime apps instead of one?**

- Independent deploys and blast radius: a CMS/theme change to public sites can't break the admin portal.
- Different rendering profiles: `sites` is ISR/edge-cache heavy with wildcard-domain middleware; `admin` is dynamic, auth-gated, RSC + Server Actions.
- Vercel wildcard domains (`*.templeos.com`) and the custom-domain pipeline attach cleanly to one project (`sites`).

`marketing` stays a stub until Phase 2 — early on, templeos.com can redirect to a waitlist page inside `sites`.

---

## 3. Folder Structure (Feature-First)

### 3.1 `packages/core` — the heart of the system

```
packages/core/src/
├── features/
│   ├── donations/
│   │   ├── donation.service.ts        # Business rules, orchestration
│   │   ├── donation.repository.ts     # Drizzle queries, always tenant-scoped
│   │   ├── donation.types.ts          # Domain types (not DB row types)
│   │   ├── donation.errors.ts         # Typed domain errors
│   │   └── index.ts                   # Public API of the feature
│   ├── devotees/
│   ├── events/
│   ├── puja-booking/
│   ├── membership/
│   ├── organizations/
│   ├── cms/
│   └── ...
├── shared/
│   ├── tenant-context.ts              # { organizationId, templeId?, branchId?, userId, role }
│   ├── result.ts                      # Result<T, E> return type for services
│   ├── pagination.ts
│   └── audit.ts
└── index.ts
```

Rules:
- A feature exports **only** through its `index.ts`. Cross-feature calls go service→service, never service→foreign-repository.
- Every repository method's first parameter is `TenantContext`. There is no way to write an unscoped query without it being visible in review.
- Services return `Result<T, DomainError>` — no throwing for expected failures.

### 3.2 `apps/admin`

```
apps/admin/src/
├── app/                               # App Router: routing + layouts ONLY
│   ├── (auth)/login, register, ...
│   └── (dashboard)/
│       ├── donations/page.tsx         # imports from features/donations
│       ├── devotees/...
│       └── settings/...
├── features/                          # UI layer of each feature
│   └── donations/
│       ├── components/                # Feature-specific components
│       ├── actions.ts                 # 'use server' — thin: validate → auth → call service
│       ├── queries.ts                 # RSC data fetching via services
│       └── hooks/                     # TanStack Query hooks where client-side needed
├── components/                        # App-level shell (sidebar, topbar, command menu)
└── lib/                               # App-local utilities
```

The `app/` directory contains **no logic** — pages compose feature UI. Server Actions are ≤15 lines: parse with Zod, resolve tenant context, call service, map Result to response, `revalidateTag`.

### 3.3 `apps/sites`

```
apps/sites/src/
├── middleware.ts                      # Host → tenant resolution (subdomain/custom domain)
├── app/
│   └── [domain]/                      # Rewritten-to segment carrying tenant
│       ├── page.tsx                   # Home (theme-driven)
│       ├── about/, events/, donate/, book-puja/, gallery/, blog/...
├── features/                          # Public-facing feature UI (donation checkout, booking flow)
├── themes/                            # Theme registry: layout variants, tokens
└── lib/
```

---

## 4. Database Design Approach

**Stack:** Supabase PostgreSQL, schema owned by **Drizzle** (migrations via `drizzle-kit`, committed SQL). RLS policies live as hand-written SQL migrations alongside Drizzle migrations in `packages/db`.

**Conventions**

- Primary keys: UUID v7 (time-ordered — index-friendly, non-guessable).
- Every tenant table carries `organization_id` (denormalized even when reachable via parent — this is what makes RLS and indexes simple and fast).
- `created_at`, `updated_at` everywhere; `deleted_at` soft delete on user-facing records.
- Money as `numeric(12,2)` + `currency` char(3). Never floats.
- Composite indexes always lead with `organization_id`.
- `audit_logs` table: append-only (actor, action, entity, before/after JSONB) — non-negotiable for a product handling donations.

**Domain groups (~40 tables at maturity, ~20 for MVP)**

| Group | Key tables |
|---|---|
| Tenancy | `organizations`, `temples`, `branches`, `domains` |
| Identity & access | `users` (mirrors Supabase auth), `memberships` (user↔org), `roles`, `permissions`, `role_permissions` |
| Community | `devotees`, `families`, `family_members`, `volunteers`, `priests` |
| Finance | `donations`, `donation_categories`, `recurring_donations`, `payment_transactions`, `receipts`, `ledger_entries` |
| Worship & events | `events`, `festivals`, `puja_types`, `puja_bookings`, `daily_schedules` |
| Membership | `membership_plans`, `memberships_subscriptions` |
| CMS | `pages`, `page_blocks`, `posts`, `galleries`, `media`, `themes`, `site_settings` |
| Ops | `inventory_items`, `documents`, `notifications`, `audit_logs` |

**Payments are provider-agnostic:** `payment_transactions` stores `provider` (`stripe` | `razorpay`), `provider_ref`, normalized `status`. Services talk to a `PaymentProvider` interface; provider SDKs are adapters.

---

## 5. Multi-Tenancy Strategy

**Model:** Shared database, shared schema, tenant-discriminator column + RLS. This is the right cost/complexity point for thousands of small-to-mid orgs (Slack/Notion model). Schema-per-tenant is operationally unaffordable at our target scale and price point.

**Hierarchy:** `Organization → Temple → Branch`. Organization is the tenancy + billing boundary. Temple/branch are scoping filters *within* a tenant, enforced at the application layer (RBAC says which temples/branches a staff user can see); RLS enforces the organization wall.

**Enforcement — defense in depth:**

1. **App layer:** `TenantContext` is constructed once per request from the verified session (never from client input) and required by every repository method.
2. **DB layer (RLS):** Backend connects with a **non-bypass role** and sets `app.current_org_id` per transaction (`SET LOCAL`); policies check `organization_id = current_setting('app.current_org_id')::uuid`. The service-role/bypass connection exists only for migrations and explicitly-audited cross-tenant jobs.
3. **Tests:** a cross-tenant leakage test suite (attempt reads/writes across org boundaries for every repository) runs in CI. This is our most important test suite.

**Tenant resolution for public sites:**

- `*.templeos.com` wildcard → middleware extracts subdomain → cached (Vercel Data Cache / Redis later) lookup in `domains` → rewrite to `/[domain]/...`.
- Custom domains (Phase 3): Vercel Domains API to attach domain + issue TLS; `domains` table stores verification status.

---

## 6. Authentication & Authorization Strategy

**Authentication:** Supabase Auth (email/password + Google OAuth at MVP; phone/OTP later for devotees in India). `@supabase/ssr` cookie-based sessions in both Next.js apps.

**One identity, many tenants:** A user can belong to multiple organizations via `memberships`. A **Custom Access Token Hook** injects `org_id` and `role` claims of the active organization into the JWT; switching orgs mints a fresh session. This gives RLS and the app layer a *verified* tenant claim — never trust a client-sent org id.

**Authorization (RBAC):** Table-driven, per-organization.

- System roles seeded per org: `owner`, `admin`, `manager`, `staff`, `viewer` (+ custom roles later).
- Permissions are string keys (`donations:create`, `reports:view`, …) checked by a single guard: `authorize(ctx, 'donations:create')` called at the **service** layer (not the UI), so REST and Server Actions inherit identical enforcement.
- Temple/branch scoping stored on the membership (`temple_ids[]`, or `*`).

**Audience separation:** Admin portal auth is for staff. Devotee accounts (donation history, bookings) are the same Supabase Auth instance but with a `devotee` audience and no admin membership — they can only reach public-site authenticated areas.

---

## 7. Public Website Architecture

- **Rendering:** Each tenant page is built from published CMS content (`pages` + typed `page_blocks`), rendered with ISR and **tag-based revalidation** — publishing in the admin calls `revalidateTag('site:{orgId}')`. Result: static-speed sites, instant publish, near-zero DB load from traffic.
- **Theme Builder (phased):** Phase 1 = 2–3 professionally designed themes with token-level customization (colors, fonts, logo, hero). Phase 3 = block-level page builder. A drag-drop builder at MVP is a scope trap; beautiful defaults win deals.
- **Block model:** `page_blocks` are typed JSON (Zod-validated) — `hero`, `schedule`, `events-list`, `donation-cta`, `gallery`, `rich-text`, etc. Blocks render server-side; only interactive islands (donation checkout, booking form) hydrate.
- **SEO:** Per-page metadata, `generateMetadata`, OpenGraph images (`@vercel/og`), sitemap + robots per tenant, JSON-LD (`Organization`, `Event`, `HinduTemple` schema.org types).
- **Transactional flows** (donate, book puja, register as volunteer/member) are the interactive parts — they call the same `core` services through Server Actions, with payment provider checkout embedded.
- **Live streaming:** MVP = embed (YouTube/Facebook Live URL managed in CMS). Native streaming infra is not our business.

---

## 8. Admin Portal Architecture

- **Shell:** Sidebar navigation grouped by domain (Community, Finance, Worship, Website, Settings), org/temple switcher, command palette (⌘K), notification tray. Linear/Stripe-density UI, light/dark via CSS variables.
- **Data flow:** RSC-first. Pages fetch via services in Server Components; mutations via Server Actions + `revalidateTag`/`revalidatePath`. TanStack Query only where the client genuinely needs it (live dashboards, optimistic tables, infinite scroll).
- **Tables & forms as platform primitives:** One `DataTable` (TanStack Table: server pagination, filters, column visibility, export) and one form pattern (React Hook Form + Zod resolver + shared `Form` components from `packages/ui`) reused by every module. This is where 60% of admin UI effort compresses.
- **Dashboard:** materialized-view-backed stats (donations this month, upcoming events, new devotees) — no `COUNT(*)` over raw tables on every load.
- **Reports:** generated async via Inngest → stored in Supabase Storage → notification with signed URL. Never block a request on a PDF.

---

## 9. Mobile-Ready API Strategy

- **Adapter, not a rewrite:** `/api/v1/**` route handlers in `apps/admin` are thin: verify Supabase JWT (Bearer) → build `TenantContext` → call the *same* service → serialize with the *same* Zod schema.
- **Contract:** OpenAPI generated from Zod schemas (`zod-openapi`); versioned under `/v1`; cursor pagination; RFC 7807-style error body `{ code, message, details }` mapped from domain errors.
- **`packages/api-client`:** typed fetch client generated against the contract — Expo consumes this; the web never needs it (it uses services directly). Building it early keeps us honest that the REST layer actually works.
- **Mobile auth:** Supabase Auth native SDK; same JWT claims; refresh handled by SDK. No custom token service needed.
- **Discipline rule:** any logic that appears in a Server Action must be callable via `/api/v1`. CI check: route handlers and actions may import from `packages/core` and `packages/validators` only — no direct `packages/db` imports outside repositories.

---

## 10. Development Roadmap

| Phase | Duration | Theme | Outcome |
|---|---|---|---|
| **0 — Foundation** | 2–3 wks | Monorepo, CI, db package, auth, tenancy, design system seed | Deployable skeleton with org signup, RLS proven by tests |
| **1 — MVP Core** | 6–8 wks | Devotees, donations (one-time), events, basic CMS site, dashboard | A real temple can run on TempleOS |
| **2 — Monetize & Grow** | 6 wks | Puja booking, memberships, recurring donations, receipts/80G, roles UI, marketing site + billing (our own subscriptions) | Chargeable product; first paying temples |
| **3 — Platform Depth** | 8 wks | Custom domains, theme builder v2, volunteers/priests scheduling, inventory, accounting-lite, reports, notifications (FCM/email) | Competitive feature parity |
| **4 — Mobile & AI** | 8+ wks | Expo app (devotee-first), AI dashboard summary + donation insights on the API layer | Multi-surface platform |

---

## 11. MVP Feature List (Phase 0+1, strictly)

**Admin:** org onboarding wizard · temple profile · staff invites (owner/admin/staff roles) · devotee directory (CRUD, CSV import, families) · donation recording (online + manual/cash entry) + categories + receipt email · events & festival calendar · daily schedule editor · website settings (theme tokens, pages content, gallery) · dashboard (donations, devotees, upcoming events).

**Public site:** home, about, schedule, events, gallery, contact · donation checkout (Razorpay for Indian orgs, SSLCommerz for Bangladeshi orgs) · SEO baseline.

**Market-driven requirements (India + Bangladesh launch):**
- `organizations.country` + `currency` (INR/BDT) drive payment adapter, receipt format, and formatting locale.
- Receipts: India 80G-compliant donation receipts (registration no., PAN fields); Bangladesh standard donation receipts (income-tax rebate fields).
- i18n from day one: `en` + `bn` locales on public sites (Bengali is the shared language of the wedge market); `hi` in Phase 2; admin portal English-first with i18n-ready message catalog.
- WhatsApp is the primary notification channel for devotees in both markets (Phase 3) — email is a fallback, not the default assumption.

**Explicitly deferred:** custom domains, page builder, accounting, inventory, puja booking, memberships, volunteers module, mobile, AI. (Each has a stubbed nav slot marked "coming soon" only if sales needs it.)

---

## 12. Milestones

- **M1 (wk 3):** Skeleton live — signup → org created → `{slug}.templeos.com` renders a themed placeholder. RLS leakage suite green in CI.
- **M2 (wk 7):** Donations end-to-end — public checkout → webhook → recorded → receipt emailed → on dashboard.
- **M3 (wk 11):** MVP complete — 3 pilot temples onboarded free, feedback loop running.
- **M4 (wk 17):** Billing live (our subscription plans), puja booking + recurring donations shipped — first revenue.
- **M5 (wk 25):** Custom domains + theme builder v2 — public launch.

---

## 13. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-tenant data leak | Fatal to trust | Dual enforcement (app + RLS), mandatory leakage test suite in CI, audit logs, pen test before public launch |
| Payment/regulatory complexity (80G receipts in India, PCI, refunds) | Legal/financial | Provider-hosted checkout only (no card data touches us); receipt formats reviewed by an accountant; provider abstraction so market choice isn't a rewrite |
| Scope creep (the module list is huge) | Never shipping | Phased plan above is the contract; new asks enter Phase 3+ backlog by default |
| Theme builder rabbit hole | Months lost | Tokens-first theming at MVP; builder only after revenue |
| Single-founder bus factor / velocity | Stall | Monorepo conventions + this doc + ADRs keep everything legible; boring tech choices |
| Supabase/Vercel lock-in | Cost at scale | Drizzle (portable SQL), business logic provider-free; auth/storage behind thin adapters |
| Wildcard subdomain SEO/abuse (spam tenants) | Reputation | Manual org approval initially; `noindex` until a site is "published"; abuse reporting |

---

## 14. Coding Standards

- **TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`; `any` is a lint error (`@typescript-eslint/no-explicit-any`). Types inferred from Zod/Drizzle — no hand-duplicated shapes.
- **Boundaries (lint-enforced import rules):** `app/` → `features/` → `packages/core` → `packages/db`. No skipping layers; no `db` imports outside repositories; no React in `core`.
- **Naming:** files kebab-case; `*.service.ts`, `*.repository.ts`, `*.actions.ts`, `*.schema.ts`; DB snake_case ↔ TS camelCase via Drizzle casing config.
- **Errors:** services return `Result<T, DomainError>`; adapters map to HTTP/UI. `throw` only for programmer errors.
- **Validation:** every external boundary (action input, route body, webhook payload, CMS block JSON) parses through Zod. No `as` casts of external data.
- **Testing:** Vitest for services (with a test DB) — business logic and the tenancy suite are the priority; Playwright smoke flows (signup, donate, publish page) per release. Skip snapshot-testing UI minutiae.
- **Git/CI:** trunk-based, PRs with preview deploys, conventional commits, `turbo lint typecheck test` gates merge. Changesets once packages are consumed externally.
- **ADRs:** every irreversible decision gets a one-page ADR in `docs/adr/`.

---

## 15. Recommended Third-Party Services

| Concern | Choice | Note |
|---|---|---|
| Hosting | Vercel | Two projects (admin, sites); wildcard domain on sites |
| DB/Auth/Storage | Supabase | Pro plan from day 1 (PITR backups) |
| ORM | Drizzle | Migrations committed, no db push in prod |
| Payments | Razorpay (India, INR) + SSLCommerz (Bangladesh, BDT — aggregates bKash/Nagad/Rocket/cards) | Org's country selects the adapter behind `PaymentProvider`; Stripe adapter added at global expansion |
| Email | Resend + React Email | Transactional; marketing email much later |
| Jobs/Workflows | Inngest | Crons (recurring donations), fan-out, retries |
| Push | Firebase Cloud Messaging | Phase 3/4 with mobile |
| Errors/Perf | Sentry | Both apps + core |
| Analytics | PostHog | Product analytics + feature flags + session replay |
| Rate limiting | Upstash Redis | Public endpoints (donation, contact forms) |
| DNS/domains | Vercel Domains API + Cloudflare for templeos.com | Custom-domain automation Phase 3 |
| SMS/WhatsApp (later) | MSG91 / Twilio / WhatsApp Business API | India: WhatsApp is the channel that matters |

---

## 16. Future Scalability Considerations

- **Read path:** tenant-site content is CDN/ISR-served, so site traffic doesn't scale DB load. Dashboards move from materialized views → dedicated analytics store only if needed.
- **DB growth:** partitioning candidates (`donations`, `audit_logs`, `notifications` by month) — designed-for now (org_id + created_at composite keys), executed later. Supabase → dedicated Postgres/Citus is possible because Drizzle keeps us on portable SQL.
- **Cache tier:** introduce Redis (Upstash) for tenant-domain resolution and hot settings when lookups become measurable.
- **Search:** Postgres FTS first; Typesense/Meilisearch per-tenant indexes if devotee/donation search outgrows it.
- **AI readiness:** because all logic is service-based with typed inputs/outputs, AI features are *clients of services* (e.g., AI report generator calls `reports.service` + LLM). Add `pgvector` for embeddings when we build the assistant; audit-log everything AI writes.
- **Compliance runway:** audit logs, soft deletes, per-org data export (their data is theirs), and eventual data residency (India region) are all easier because tenancy is explicit on every row.

---

## Appendix A — Immediate Next Steps (Phase 0 kickoff)

1. Scaffold Turborepo (pnpm), `apps/admin`, `apps/sites`, `packages/{config,ui,db,core,validators,auth}`.
2. Supabase project + Drizzle setup; first migration: tenancy + identity tables + RLS policies.
3. Auth flow: signup → create organization → membership → JWT claims hook.
4. Middleware tenant resolution in `sites`; placeholder themed homepage.
5. CI: lint, typecheck, test, tenancy-leakage suite; Vercel preview deploys.
