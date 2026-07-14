-- =============================================================================
-- TempleOS Row Level Security policies
--
-- Applied manually after `drizzle-kit migrate` (or via a custom migration).
-- The application connects with a NON-BYPASS role and sets the tenant per
-- transaction:
--
--   SET LOCAL app.current_org_id = '<organization uuid>';
--
-- The service_role / postgres superuser bypasses RLS and must only be used by
-- migrations and explicitly-audited cross-tenant jobs.
-- =============================================================================

-- Dedicated application role (create once per environment; password managed in env)
-- CREATE ROLE templeos_app LOGIN PASSWORD '...' NOBYPASSRLS;
-- GRANT USAGE ON SCHEMA public TO templeos_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO templeos_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO templeos_app;

-- Helper: current tenant from the transaction-local setting (NULL-safe).
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Tenant tables: isolate by organization_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'temples',
    'branches',
    'domains',
    'roles',
    'memberships',
    'audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING (organization_id = app_current_org_id()) WITH CHECK (organization_id = app_current_org_id())',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;

-- organizations: a tenant can only see its own row
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON public.organizations
  USING (id = app_current_org_id())
  WITH CHECK (id = app_current_org_id());

-- role_permissions: scoped through the owning role
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY role_permissions_tenant_isolation ON public.role_permissions
  USING (EXISTS (
    SELECT 1 FROM public.roles r
    WHERE r.id = role_id AND r.organization_id = app_current_org_id()
  ));

-- users: global identities; readable when they share an org with the current tenant
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_same_org_read ON public.users FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = users.id AND m.organization_id = app_current_org_id()
  ));

-- permissions catalog: global, read-only reference data
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissions_read_all ON public.permissions FOR SELECT USING (true);

-- audit_logs: append-only — no UPDATE/DELETE policies exist, so both are denied by RLS.
