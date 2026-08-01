-- =============================================================================
-- Plan catalog policies
--
-- plan_catalog has no organization_id — it's a platform-global reference
-- table, not tenant data. Everyone (including unauthenticated visitors, for a
-- future public pricing page) can read it; only platform admins can write.
-- Idempotent: safe to re-apply.
-- =============================================================================

ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_catalog FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_catalog_public_read ON public.plan_catalog;
CREATE POLICY plan_catalog_public_read ON public.plan_catalog FOR SELECT
  USING (true);

DROP POLICY IF EXISTS plan_catalog_platform_admin_write ON public.plan_catalog;
CREATE POLICY plan_catalog_platform_admin_write ON public.plan_catalog FOR ALL
  USING (app_is_platform_admin())
  WITH CHECK (app_is_platform_admin());
