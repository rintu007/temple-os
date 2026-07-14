-- =============================================================================
-- Identity-aware RLS policies (Phase 0 signup/onboarding flow)
--
-- Adds a second transaction-local setting, app.current_user_id, set alongside
-- app.current_org_id by the application's withTenantContext() helper. It is
-- derived ONLY from the verified Supabase session server-side.
-- Idempotent: safe to re-apply.
-- =============================================================================

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

-- users: a user manages their own mirror row; org members can read each other.
DROP POLICY IF EXISTS users_same_org_read ON public.users;
DROP POLICY IF EXISTS users_self_read ON public.users;
DROP POLICY IF EXISTS users_self_insert ON public.users;
DROP POLICY IF EXISTS users_self_update ON public.users;

CREATE POLICY users_self_read ON public.users FOR SELECT
  USING (id = app_current_user_id());

CREATE POLICY users_same_org_read ON public.users FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = users.id AND m.organization_id = app_current_org_id()
  ));

CREATE POLICY users_self_insert ON public.users FOR INSERT
  WITH CHECK (id = app_current_user_id());

CREATE POLICY users_self_update ON public.users FOR UPDATE
  USING (id = app_current_user_id())
  WITH CHECK (id = app_current_user_id());

-- memberships: a user can always list their own memberships (needed to find
-- their organizations before any org context exists).
DROP POLICY IF EXISTS memberships_own_read ON public.memberships;
CREATE POLICY memberships_own_read ON public.memberships FOR SELECT
  USING (user_id = app_current_user_id());

-- organizations / roles: readable by their members (org switcher, role labels).
DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
CREATE POLICY organizations_member_read ON public.organizations FOR SELECT
  USING (id IN (
    SELECT m.organization_id FROM public.memberships m
    WHERE m.user_id = app_current_user_id() AND m.status = 'active'
  ));

DROP POLICY IF EXISTS roles_member_read ON public.roles;
CREATE POLICY roles_member_read ON public.roles FOR SELECT
  USING (organization_id IN (
    SELECT m.organization_id FROM public.memberships m
    WHERE m.user_id = app_current_user_id() AND m.status = 'active'
  ));

-- domains: hostnames are public by nature (they live in DNS); the sites app
-- must resolve host → organization before any tenant context exists.
DROP POLICY IF EXISTS domains_public_resolve ON public.domains;
CREATE POLICY domains_public_resolve ON public.domains FOR SELECT
  USING (true);
