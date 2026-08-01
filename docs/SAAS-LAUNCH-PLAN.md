# TempleOS — Package Management, Trial Gating & Public Launch Plan

Status: **M78 shipped** (M77: package management §2 + trial gating §3; M78: seat-limit enforcement — see §6). Remaining §5 decisions (legal drafting scope already approved but not started, launch-gate sequencing) still open.
Owner: engineering (this doc replaces ad-hoc planning in chat; update it as milestones land, the same way commits are numbered `M<n>: ...`).

**Decisions made (2026-08-01):** fully dynamic catalog (§2 Option 2, not the recommended Option 1) · trial = Growth-tier modules (§3 option B) · applies immediately to orgs already mid-trial, no grandfathering · legal page drafts: yes, proceed (§4, not yet started).

This doc answers three things asked together, because they're the same system:
1. Platform-editable **package management** (today the plan catalog is a hardcoded constant).
2. **Module access driven by package**, including a trial tier that's actually limited (today trial = every module unlocked).
3. What else is missing before this is a **fully launched, chargeable public SaaS product**, not just a working app.

---

## 1. Current state (audit, as of M76)

### 1.1 What's already built

- **4-tier plan catalog** — `packages/validators/src/billing.ts`: `trial`, `starter`, `growth`, `pro`. Each has a name, USD price, description, feature bullets, and a `PLAN_MODULES` module list. This is a **hardcoded TypeScript constant**, not a database table — changing a price or moving a module between plans today means a code change + deploy.
- **Module gating enforcement** — real and working. `requireTenantContext(requiredModule)` (`apps/admin/src/lib/session.ts`) redirects a visitor to `/billing?locked=X` if their org's plan doesn't include that module; the sidebar nav shows a lock icon on gated items ahead of the click (`moduleForHref`). Four gateable bundles: `worship`, `community`, `finance-basic`, `accounting`. Core operations (dashboard, devotees, one-time donations, events, team, the public site, billing itself) are never gated — a temple's donation intake must never depend on TempleOS's own subscription status.
- **Stripe subscriptions** — checkout session creation, customer portal, and webhook handling (`checkout.session.completed`, `customer.subscription.updated/deleted`) are all coded (`packages/core/src/features/billing/`). Only `growth` and `pro` are purchasable; `starter` is free/default, `trial` is never purchased.
- **Platform admin overrides (M64, M68)** — `/platform` lets TempleOS staff view every org's plan/status/MRR and manually override one org's plan, status, or trial length (for comping, support, or un-sticking a stuck payment). This is a **per-org escape hatch**, not a catalog editor — it changes what plan an org is *on*, not what a plan *contains* or costs.
- **Org status enforcement (M68)** — `suspended` blocks the whole admin dashboard (not the public donor site).

### 1.2 The specific contradiction that prompted this doc

`billing.service.ts#getEntitledModules`:
```
if (row.status === 'trialing' && !isTrialExpired) return 'all';
```
Trial currently gets **every module unlocked** — that was a deliberate MVP choice (`PLAN_CATALOG.trial.description`: *"14-day full-feature trial — no card required"*), but it's the opposite of what's being asked for now (limited trial access). This needs a product decision, not just a code fix — see §3.

Also fail-open: an org with **no subscription row at all** (provisioned before platform billing existed) also gets `'all'`. That's a migration-safety fallback for legacy orgs and is unrelated to the trial question — flagged separately in §5 so it doesn't get changed by accident.

### 1.3 Gaps found while auditing (not previously tracked anywhere)

| Gap | Why it matters | Evidence |
|---|---|---|
| **Plan catalog isn't platform-editable** | Can't change a price, rename a plan, or move a module between tiers without a code deploy | `PLAN_CATALOG`/`PLAN_MODULES` are `const` in `packages/validators/src/billing.ts` |
| **Trial = unlimited access** | Contradicts "limited trial" ask; also means a trial org has no incentive signal to see what an upgrade unlocks | §1.2 above |
| **No seat-limit enforcement** | Plan copy advertises "Up to 2 staff accounts" (trial, starter) and "Unlimited" (growth+), but `createInvitation` never checks a count — the limit is marketing text only | `packages/core/src/features/members/member.repository.ts#createInvitation` — no count check |
| **Stripe not configured in production** | No paid upgrade can actually complete right now | `docs/DEPLOY.md`'s env var table has no `STRIPE_*` row at all; `billingService().isConfigured()` gates the upgrade button off when unset |
| **Donation payment gateways are sandboxed** | Even if billing were live, temple donations (Razorpay/SSLCommerz) are still in test mode per the deploy runbook | `docs/DEPLOY.md`: *"test mode until go-live"*, *"defaults to sandbox when unset"* |
| **No public marketing/pricing site** | `templeos.com` root domain renders a two-line placeholder with no pricing, no signup CTA, no feature list | `apps/sites/src/app/page.tsx` |
| **No legal pages** | No Terms of Service, Privacy Policy, or Refund Policy anywhere in either app | repo-wide search, zero matches |
| **No usage/billing alerts** | Nothing emails an org when their trial is about to expire or a payment fails (Stripe emits the events; nothing consumes them for outbound notice beyond the in-app banner) | `handleStripeEvent` updates the DB row only |

None of this is a criticism of prior work — M1–M76 correctly prioritized *product* over *go-to-market plumbing*. This doc is the point where that plumbing gets scoped.

---

## 2. Part A — Platform-editable package management

### 2.1 Design choice ⚑ (needs your decision — see the question set after this doc)

Two shapes this could take, in increasing order of effort:

**Option 1 — Edit the existing 4 plans (recommended starting point).** Move `PLAN_CATALOG` + `PLAN_MODULES` from a TS constant into a `plan_catalog` DB table (one row per plan: name, price, description, feature bullets, module list, active flag). Platform admin gets a `/platform/plans` editor: change a price, edit feature bullet text, toggle which of the 4 `ModuleKey`s a plan includes. The 4 plan *keys* (`trial`/`starter`/`growth`/`pro`) stay fixed — they're wired into Stripe price IDs, the checkout flow, and `PURCHASABLE_PLANS`. This is a content/config edit, not a structural one.

**Option 2 — Fully dynamic catalog (add/remove/rename plan tiers).** Lets platform staff create a 5th tier, retire one, etc. Bigger lift: `PlatformPlan` stops being a fixed union type, every place that switches on plan key (`PLAN_MODULES[row.plan]`, Stripe price-ID lookup, the `PURCHASABLE_PLANS` array, the pricing-page cards) becomes data-driven instead of type-checked. Real risk of a data-entry mistake locking an org out or breaking checkout, with much less compile-time safety.

**Recommendation: Option 1.** It solves the actual stated need (change prices/module assignments without a deploy) without giving up the type safety that's caught real bugs all through this project (`PlatformPlan` as a union, `authorize()`'s permission union, etc.). Option 2 can be revisited later if there's a real need for more than 4 tiers — nothing in Option 1's schema forecloses it.

### 2.2 Scope if Option 1 is confirmed (M77)

- **Schema**: new `plan_catalog` table (`packages/db/src/schema`) — `key` (PK, matches `PlatformPlan`), `name`, `priceUsd`, `description`, `features` (jsonb array), `modules` (jsonb array of `ModuleKey`), `isPurchasable`, timestamps. Migration seeds it from today's `PLAN_CATALOG` constant so behavior doesn't change on deploy day.
- **RLS**: public-readable (the pricing page needs it unauthenticated) with platform-admin-only writes — same additive-policy pattern as M64's `organizations_platform_admin_read`, mirrored for writes this time.
- **Core**: `packages/core/src/features/platform` gets `listPlanCatalog`/`updatePlan`; `billing.service.ts#getEntitledModules` and the admin billing page read from the DB-backed catalog instead of the static import (with the static `PLAN_CATALOG` kept only as `PlatformPlan`'s type source and the seed/fallback if the table is ever empty).
- **UI**: `/platform/plans` — a form per plan (price, description, feature bullets as a repeatable list, module checkboxes, purchasable toggle). Same shape as the M68 override form.
- **Tests**: repository/service tests following the existing `describe.skipIf(!hasDb)` live-DB pattern; a specific test that editing a plan's modules immediately changes `getEntitledModules` for an org on that plan.

---

## 3. Part B — Trial period module limits

### 3.1 The decision this actually hinges on ⚑

"Limited module access in trial" needs a concrete answer to: **limited to what?** Three real options:

- **A — Trial = Starter.** Trial previews only core features (already free forever on Starter); gated modules (worship, community, finance-basic, accounting) are locked from day one, with an upgrade prompt. Cleanest mental model — trial is just "Starter with a countdown to being asked to upgrade" — but a trial signer never sees what Growth/Pro actually do, which weakens the trial's job of demonstrating value.
- **B — Trial = Growth.** Previews the mid-tier (worship + community + finance-basic) but not full accounting. Shows most of the product; withholds the most complex/back-office tier (accounting) as the upsell.
- **C — Trial = one specific module, rotating or fixed** (e.g. always `worship`, since puja/darshan booking is the most visually compelling demo). Smallest preview surface, clearest single upgrade story, but hides the most.

**Recommendation: B (Trial = Growth's module set).** It gives a trial signer enough real usage to get hooked (most modules), while `accounting` — the most complex, most "we're already committed" tier — stays a visible, well-motivated paid upgrade (a temple that needs fund accounting knows it, and by day 10 of a trial they've likely already used Growth-tier features enough to trust the product with their books). This also reuses `PLAN_MODULES.growth` directly — zero new catalog entries needed under Option 1 in §2.

### 3.2 Scope (M78, depends on M77 if the catalog move happens first)

- `billing.service.ts#getEntitledModules`: replace `if (trialing && !expired) return 'all'` with `return new Set(PLAN_MODULES.growth)` (or whichever tier is decided).
- **Existing trial orgs**: this changes behavior for every org currently mid-trial. Needs an explicit decision, not a silent behavior change — see §5.
- `PLAN_CATALOG.trial.description`/`features` copy needs to stop saying "every module unlocked."
- Billing page: trial banner should say what's *not* included and link to the upgrade card for it, not just show a countdown.
- ⚑ Seat limits (from §1.3's gap table) are a natural companion to ship in the same milestone, since both are "advertised limit, not enforced" — `createInvitation`/`acceptInvitation` gets a count check against the plan's seat limit, sourced from the catalog. Recommend bundling unless you'd rather keep milestones single-purpose.

---

## 4. Part C — Full public-launch checklist

Organized by category. **Status**: ✅ done · 🟡 partial/coded-but-not-configured · ⬜ not started. This is the durable tracking surface — check items off here as milestones land, same as the commit log tracks M-numbers.

### Billing & packaging
- 🟡 Stripe subscriptions (code complete, **not configured in production** — needs live keys + price IDs + webhook registered)
- ✅ Package management UI (§2) — `/platform/plans`, fully dynamic catalog (M77)
- ✅ Trial module limiting (§3) — trial seeded to Growth's modules (M77)
- ✅ Seat-limit enforcement (M78) — `plan_catalog.seat_limit`, checked in `createInvitation`
- ⬜ Failed-payment / trial-ending email notices (Stripe webhook already receives the events; nothing sends mail on them yet)
- ⬜ Invoice/receipt history for the org's *own* subscription (distinct from devotee donation receipts, which already exist) — Stripe's customer portal covers this today, so may be low priority

### Payments (devotee-facing, not TempleOS's own billing)
- 🟡 Razorpay — test mode only per deploy runbook; needs live keys + go-live checklist with Razorpay (KYC, settlement account)
- 🟡 SSLCommerz — sandbox only; same live-credential step
- ⬜ Payment failure/retry visibility for temple staff (does a failed devotee payment surface anywhere for staff to notice and follow up?) — worth a quick audit, not scoped in detail here

### Legal & compliance
- ⬜ Terms of Service
- ⬜ Privacy Policy (India + Bangladesh + wherever else orgs sign up from — data residency/PII handling claims need to be true, not boilerplate)
- ⬜ Refund/cancellation policy for TempleOS subscriptions
- ⬜ Cookie/consent notice if EU/UK signups are in scope
- ⬜ Data processing agreement template (temples are themselves data controllers for their devotees' PII — TempleOS is a processor)

**I can draft first-pass Terms/Privacy/Refund text as a starting point, clearly marked as a template requiring your (or a lawyer's) review before it's legally relied on — I won't publish anything as a finished legal document.**

### Public marketing site
- ⬜ Replace the two-line placeholder at the root domain (`apps/sites/src/app/page.tsx`) with an actual marketing page: value prop, feature highlights, pricing (reads the same catalog as §2 once it's DB-backed), signup CTA
- ⬜ `/pricing` page
- ⬜ Link from marketing site to `/signup` on the admin app (currently no path from the root domain to account creation at all)
- ⬜ Basic SEO (meta tags, OG image, sitemap) for the marketing site specifically — tenant sites already have this per-org

### Security & reliability
- ✅ RLS-enforced multi-tenancy, dual-layer (app + Postgres), leakage-tested throughout
- ⬜ Formal pre-launch security review / pen test (flagged as a risk in the original `docs/DEVELOPMENT-PLAN.md` §13, never scheduled)
- ⬜ Rate limiting on public endpoints (login, portal magic-link request, donation checkout, contact forms) — abuse/enumeration surface for a now-public product
- ⬜ Automated DB backups verified + a documented restore drill (Supabase has backups by default; "verified restore works" is different from "backups exist")
- ⬜ Uptime/error monitoring + alerting (Vercel has basic logs; nothing currently pages anyone on an outage)
- ⬜ Structured audit-log retention policy (currently unbounded — fine at current scale, worth a stated policy before public launch)

### Operations & support
- ⬜ Support channel (email/helpdesk) that actually reaches someone — referenced nowhere in-app currently
- ⬜ Status page (even a static one) for incident communication
- ⬜ Onboarding email sequence (signup confirmation exists via Supabase; nothing beyond that — no "how to get started" nudge)
- ⬜ Admin-side changelog/announcement mechanism for shipping new modules to existing customers (they currently just... appear)

### Growth & analytics
- ⬜ Product analytics (which modules get used, trial→paid conversion, churn) — `platform.service.ts#getOverview` gives MRR/org counts today, nothing behavioral
- ⬜ Referral/affiliate mechanics if relevant to the go-to-market plan
- ⬜ Testimonials/case studies section on the marketing site once there are a few live paying temples to feature

---

## 5. Open decisions — needs your input before implementation

These aren't things I should decide unilaterally:

1. **Package management scope**: Option 1 (edit existing 4 plans) vs Option 2 (fully dynamic catalog)? *Recommend Option 1.*
2. **What trial should include**: A (Starter), B (Growth), or C (one module)? *Recommend B.*
3. **Existing mid-trial orgs**: when trial gating tightens, do currently-trialing orgs (a) get grandfathered at full access for the remainder of their original trial, or (b) immediately drop to the new limited set? (a) is kinder but means two code paths for a while; (b) is simpler and matches "this is what trial means now."
4. ~~**Seat limits**: bundle into the trial-gating milestone (§3.2), or its own separate milestone?~~ **Resolved**: shipped as its own milestone, M78.
5. **Legal pages**: want me to draft first-pass ToS/Privacy/Refund templates (clearly marked as drafts needing your/a lawyer's review), or is this being handled outside of engineering entirely?
6. **Launch sequencing**: of the four checklist categories in §4, which is the actual gate for "we're calling this launched" — e.g. is a public marketing site + live Stripe + legal pages the minimum bar, with security/ops hardening allowed to trail behind, or does everything in §4 need to land first?

---

## 6. Milestone sequence (fill in as decisions land)

Following the same `M<n>: <one-line summary>` convention as every prior module in this repo's commit log:

- [x] **M77** — Fully dynamic, platform-editable plan catalog (§2, Option 2) *and* trial module limiting (§3) — shipped together, since a dynamic catalog makes trial-limiting just "seed the trial row with Growth's modules," not a separate code path. `/platform/plans` lets staff create/edit/delete tiers; `isTrialDefault`/`isFallbackDefault` flags replace every hardcoded `'trial'`/`'starter'` literal in provisioning, billing, and the override tool. Applied immediately to already-trialing orgs (no grandfathering, per §5.3's answer).
- [x] **M78** — Seat-limit enforcement. `plan_catalog.seat_limit` (null = unlimited; trial/starter = 2, growth/pro = unlimited, matching the plan copy). `createInvitation` counts active memberships + pending unexpired invitations against it and refuses over-limit invites with a clear conflict message; `/platform/plans` exposes the field per plan; the team page shows a live "X of Y seats used" indicator.
- [ ] **M79** — Stripe live configuration + failed-payment/trial-ending email notices (per-plan Stripe Price ids are now set via `/platform/plans`, not env vars — one less blocker here)
- [ ] **M80** — Public marketing site + pricing page
- [ ] **M81** — Legal pages (ToS, Privacy, Refund policy) — drafting approved (§5.5), not yet started
- [ ] **M82+** — Security review, rate limiting, backup-restore drill, monitoring/alerting, support channel — sequenced once §5.6 is answered
