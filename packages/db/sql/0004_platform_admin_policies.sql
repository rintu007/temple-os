-- =============================================================================
-- Platform admin policies
--
-- platform_admins identifies TempleOS staff (not tenant staff) who can see
-- across every organization from apps/admin's /platform section. Membership
-- is granted by inserting a row directly in the database — there is no
-- self-service UI for this in v1.
--
-- A platform-admin request calls withTenantContext(db, { userId }) with
-- organizationId omitted, so app_current_org_id() is NULL and none of the
-- ordinary tenant-isolation policies match — only the additive, SELECT-only
-- policies below grant it cross-tenant read access.
-- Idempotent: safe to re-apply.
-- =============================================================================

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;

-- A user can only check whether THEY are a platform admin — not list the roster.
DROP POLICY IF EXISTS platform_admins_self_read ON public.platform_admins;
CREATE POLICY platform_admins_self_read ON public.platform_admins FOR SELECT
  USING (user_id = app_current_user_id());

-- Not SECURITY DEFINER: this runs under the caller's own RLS, and the query
-- it performs is exactly what platform_admins_self_read already allows, so
-- it returns true only for a genuine platform admin's own session.
CREATE OR REPLACE FUNCTION app_is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = app_current_user_id()
  )
$$;

DROP POLICY IF EXISTS organizations_platform_admin_read ON public.organizations;
CREATE POLICY organizations_platform_admin_read ON public.organizations FOR SELECT
  USING (app_is_platform_admin());

DROP POLICY IF EXISTS platform_subscriptions_platform_admin_read ON public.platform_subscriptions;
CREATE POLICY platform_subscriptions_platform_admin_read ON public.platform_subscriptions FOR SELECT
  USING (app_is_platform_admin());
