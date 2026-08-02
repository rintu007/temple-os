-- =============================================================================
-- Changelog policies
--
-- changelog_entries is platform-wide "what's new" content written by
-- TempleOS staff, not tenant-scoped. Any signed-in app user should be able
-- to read it (every temple's staff, not just platform admins) — mirrors the
-- public-read/admin-write split in 0005_plan_catalog_policies.sql, except
-- read is scoped to "has a verified session" rather than genuinely public,
-- since this content isn't meant for anonymous site visitors.
--
-- changelog_reads tracks how far each user has read, same self-scoped shape
-- as platform_admins_self_read (0004) but FOR ALL since users write here too.
-- Idempotent: safe to re-apply.
-- =============================================================================

ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS changelog_entries_authenticated_read ON public.changelog_entries;
CREATE POLICY changelog_entries_authenticated_read ON public.changelog_entries FOR SELECT
  USING (app_current_user_id() IS NOT NULL);

DROP POLICY IF EXISTS changelog_entries_platform_admin_write ON public.changelog_entries;
CREATE POLICY changelog_entries_platform_admin_write ON public.changelog_entries FOR ALL
  USING (app_is_platform_admin())
  WITH CHECK (app_is_platform_admin());

ALTER TABLE public.changelog_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_reads FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS changelog_reads_self ON public.changelog_reads;
CREATE POLICY changelog_reads_self ON public.changelog_reads FOR ALL
  USING (user_id = app_current_user_id())
  WITH CHECK (user_id = app_current_user_id());
