-- =============================================================================
-- Onboarding drip sequence support (M83 follow-up): a scheduled job needs to
-- find every organization due for its next day-1/3/7 nudge, across ALL
-- tenants — same cross-tenant-read need as app_list_trials_ending_soon
-- (0006_billing_notice_function.sql), and the same reasoning applies for why
-- this is SECURITY DEFINER while app_is_platform_admin() is not: this
-- genuinely reads across tenants, so it's kept narrow — fixed columns, a
-- bounded 30-day creation window (no reason to scan older orgs; nudges are
-- meaningless after a month), search_path pinned, EXECUTE restricted to the
-- application role. Idempotency (never re-sending a day-N nudge) is enforced
-- by the caller checking the onboarding_dayN_sent_at columns this returns,
-- not by this function. Idempotent to re-apply.
-- =============================================================================

CREATE OR REPLACE FUNCTION app_list_orgs_for_onboarding_nudges()
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  created_at timestamptz,
  owner_email text,
  owner_name text,
  onboarding_day1_sent_at timestamptz,
  onboarding_day3_sent_at timestamptz,
  onboarding_day7_sent_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.name,
    o.created_at,
    u.email,
    u.full_name,
    ps.onboarding_day1_sent_at,
    ps.onboarding_day3_sent_at,
    ps.onboarding_day7_sent_at
  FROM organizations o
  JOIN platform_subscriptions ps ON ps.organization_id = o.id
  JOIN memberships m ON m.organization_id = o.id AND m.status = 'active'
  JOIN roles r ON r.id = m.role_id AND r.key = 'owner'
  JOIN users u ON u.id = m.user_id
  WHERE o.created_at > now() - interval '30 days'
    AND ps.onboarding_day7_sent_at IS NULL
$$;

REVOKE ALL ON FUNCTION app_list_orgs_for_onboarding_nudges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_list_orgs_for_onboarding_nudges() TO templeos_app;
