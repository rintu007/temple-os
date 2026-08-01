-- =============================================================================
-- Billing notice support: a scheduled job needs to find every trialing
-- organization whose trial ends soon, across ALL tenants — inherently a
-- cross-tenant read that ordinary RLS (scoped to one app.current_org_id at a
-- time) cannot serve, and there is deliberately no bypass-RLS credential
-- available in production (DATABASE_URL_ADMIN is local/migration-only — see
-- docs/DEPLOY.md).
--
-- Unlike app_is_platform_admin() (NOT SECURITY DEFINER — it only checks the
-- caller's own membership), this function IS SECURITY DEFINER: it genuinely
-- needs to read across tenants. To keep that narrow, it: returns only the
-- specific columns a reminder email needs, filters to organizations that
-- actually qualify (trialing, trial ending within the window, not already
-- reminded), pins search_path to prevent hijacking, and its EXECUTE grant is
-- restricted to the application role — nothing here is callable by a
-- browser-facing session, and callers get no ability to broaden the query.
-- Idempotent: safe to re-apply.
-- =============================================================================

CREATE OR REPLACE FUNCTION app_list_trials_ending_soon(days_ahead integer)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  trial_ends_at timestamptz,
  owner_email text,
  owner_name text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ps.organization_id,
    o.name,
    ps.trial_ends_at,
    u.email,
    u.full_name
  FROM platform_subscriptions ps
  JOIN organizations o ON o.id = ps.organization_id
  JOIN memberships m ON m.organization_id = ps.organization_id AND m.status = 'active'
  JOIN roles r ON r.id = m.role_id AND r.key = 'owner'
  JOIN users u ON u.id = m.user_id
  WHERE ps.status = 'trialing'
    AND ps.trial_ends_at IS NOT NULL
    AND ps.trial_ends_at BETWEEN now() AND now() + make_interval(days => days_ahead)
    AND ps.trial_reminder_sent_at IS NULL
$$;

REVOKE ALL ON FUNCTION app_list_trials_ending_soon(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_list_trials_ending_soon(integer) TO templeos_app;
