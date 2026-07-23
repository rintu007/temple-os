# TempleOS — Vercel Deployment Runbook

## Current deployment (since 2026-07-23)

- Admin: **https://templeos-admin.vercel.app** (Vercel team `rintu-kumar-chowdhurys-projects`)
- Sites: **https://templeos-sites.vercel.app** — serves the demo org via a
  `domains`-table custom-domain row (interim mode below); `NEXT_PUBLIC_ROOT_DOMAIN`
  is set to `templeos.com` ahead of the real domain purchase.
- Deploys are CLI-driven (`vercel --prod`), not git-triggered — connecting the
  GitHub repo requires installing the Vercel GitHub app (Dashboard → Project →
  Settings → Git → Connect), after which every push to `main` auto-deploys.

Two Vercel projects from one repo (`rintu007/temple-os`):

| Project | Root Directory | Serves |
|---|---|---|
| `templeos-admin` | `apps/admin` | Admin portal (staff sign-in) |
| `templeos-sites` | `apps/sites` | Public tenant websites |

Vercel auto-detects the pnpm/Turborepo monorepo when Root Directory is set —
no custom build or install commands needed.

## Environment variables

Set on **both** projects unless noted. Use *Production* scope (Preview can share).

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://templeos_app.yhrvqeyvyvshofzdtqwh:<app-pw>@aws-1-ap-south-1.pooler.supabase.com:6543/postgres` | **Port 6543** (transaction pooler) on serverless — our client already runs `prepare:false`. The `templeos_app` password is in the local `.env` (port 5432 works but exhausts session slots under burst load). |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yhrvqeyvyvshofzdtqwh.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` | from local `.env` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | your sites domain, e.g. `templeos.com` | Drives subdomain→tenant resolution. Until a custom domain exists, set it to the sites project's `*.vercel.app` hostname (see "No custom domain yet" below). |
| `NEXT_PUBLIC_APP_URL` | `https://<admin>.vercel.app` (admin only) | Invite links + auth redirects |
| `RESEND_API_KEY` | `re_…` | receipts, invites, contact notifications |
| `RESEND_FROM_EMAIL` | optional | after verifying a domain in Resend; sandbox sender otherwise (sandbox only delivers to your own inbox) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `rzp_test_…` | test mode until go-live |
| `SSLCOMMERZ_STORE_ID` / `SSLCOMMERZ_STORE_PASSWORD` | sandbox creds from developer.sslcommerz.com | BDT donations (Bangladesh orgs). Redirect flow via `/api/payments/sslcommerz/callback`. Absent → BDT checkout hidden. |
| `SSLCOMMERZ_SANDBOX` | `false` for go-live | defaults to sandbox when unset |
| `RAZORPAY_WEBHOOK_SECRET` | random string | sites only. Same value entered when registering the webhook in the Razorpay dashboard: URL `https://<sites-host>/api/webhooks/razorpay`, event `payment.captured`. Server-side confirmation fallback when the devotee closes the tab before Checkout's handler runs. |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` | gallery uploads; safe server-side only |

**Never set `DATABASE_URL_ADMIN` on Vercel** — the BYPASSRLS role is for local
migrations only. Run migrations from a dev machine (`pnpm --filter @templeos/db
db:migrate && db:apply-rls`) before deploying schema-dependent code.

## Supabase Auth URLs (once, after first deploy)

Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://<admin>.vercel.app`
- **Redirect URLs**: add `https://<admin>.vercel.app/**`

Without this, email confirmation links keep pointing at localhost.

## Custom domains (Phase 3 target state)

- Admin: `app.templeos.com` → CNAME to Vercel, attach to `templeos-admin`.
- Sites: `templeos.com` + wildcard `*.templeos.com` attached to
  `templeos-sites` (wildcards require the domain to use Vercel DNS or a
  wildcard CNAME). Then `NEXT_PUBLIC_ROOT_DOMAIN=templeos.com` and every
  org's `{slug}.templeos.com` resolves automatically — the `domains` table
  already stores these hostnames.

## No custom domain yet? (interim demo mode)

`*.vercel.app` has no wildcard subdomains, so subdomain tenancy can't work
there. Interim trick: the middleware treats any host that doesn't match
`NEXT_PUBLIC_ROOT_DOMAIN` as a custom domain and looks it up in the
`domains` table — so insert the sites deployment hostname as a domain row
for the demo org and the bare `https://templeos-sites-….vercel.app` serves
that org's site:

```sql
INSERT INTO domains (id, organization_id, hostname, type, is_primary, verified_at)
VALUES (gen_random_uuid(), '<demo-org-id>', 'templeos-sites-….vercel.app', 'custom', false, now());
```

## CLI deploy (what we script)

```bash
npm i -g vercel
vercel login                      # one-time, interactive
cd apps/admin  && vercel link --project templeos-admin  && vercel --prod
cd apps/sites  && vercel link --project templeos-sites  && vercel --prod
```

Afterwards, every `git push` to `main` auto-deploys both projects once the
projects are connected to the GitHub repo (Vercel dashboard → Project →
Settings → Git), or keep deploying via `vercel --prod` from CI/local.

## Post-deploy smoke checklist

1. `https://<admin>.vercel.app/login` renders; sign in works (after Supabase
   URL config).
2. Dashboard loads (proves `DATABASE_URL` + RLS role work from Vercel).
3. `https://<sites>.vercel.app` serves the mapped demo org (interim mode) —
   schedule, events, About/Gallery/Contact render.
4. Test donation via Razorpay test card `4111 1111 1111 1111` → receipt row +
   email.
5. Invite flow: create invite → email arrives → accept.
