-- =============================================================================
-- Invitation token policies
--
-- An invitation link carries a high-entropy token. The acceptance flow runs
-- before the invitee has any org membership, so a token-scoped RLS policy
-- lets the holder read exactly the one invitation their token matches:
-- the app sets app.invite_token per transaction via withInviteToken().
-- Idempotent: safe to re-apply.
-- =============================================================================

CREATE OR REPLACE FUNCTION app_invite_token() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.invite_token', true), '')
$$;

DROP POLICY IF EXISTS invitations_token_read ON public.invitations;
CREATE POLICY invitations_token_read ON public.invitations FOR SELECT
  USING (token = app_invite_token());
