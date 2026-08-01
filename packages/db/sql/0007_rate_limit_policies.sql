-- =============================================================================
-- rate_limits: written from public, unauthenticated Server Actions (login,
-- magic-link requests, contact forms, checkout initiation) that run with NO
-- app.current_org_id/app.current_user_id set at all — there is no tenant or
-- user context to scope against. Mirrors domains_public_resolve
-- (0002_identity_policies.sql), the existing precedent for a table that must
-- be reachable before any session context exists: a fully permissive policy,
-- not left unprotected (the templeos_app role always has RLS enforced).
-- Idempotent: safe to re-apply.
-- =============================================================================

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limits_open ON public.rate_limits;
CREATE POLICY rate_limits_open ON public.rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);
