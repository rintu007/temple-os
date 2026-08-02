-- =============================================================================
-- Health monitoring support
--
-- health_checks is an internal operational table (last known up/down state
-- per monitored service), touched only by the health-check cron — not
-- tenant data and not exposed to any user-facing read path. Same fully-open
-- policy shape as rate_limits (0007_rate_limit_policies.sql), for the same
-- reason: the app's Postgres role always has RLS enforced, even for
-- internal bookkeeping tables with no per-tenant meaning.
--
-- app_list_platform_admin_emails() lets the cron (no browser session, no
-- app.current_user_id) find who to alert on a state change. SECURITY
-- DEFINER for the same reason as app_list_trials_ending_soon
-- (0006_billing_notice_function.sql): a scheduled job has no session to run
-- platform_admins_self_read under. Kept narrow: no parameters, fixed
-- return columns, search_path pinned, EXECUTE restricted to the app role.
-- Idempotent: safe to re-apply.
-- =============================================================================

ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_checks_open ON public.health_checks;
CREATE POLICY health_checks_open ON public.health_checks FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION app_list_platform_admin_emails()
RETURNS TABLE (email text, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email, u.full_name
  FROM platform_admins pa
  JOIN users u ON u.id = pa.user_id
$$;

REVOKE ALL ON FUNCTION app_list_platform_admin_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_list_platform_admin_emails() TO templeos_app;
