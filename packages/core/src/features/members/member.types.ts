export interface MemberSummary {
  membershipId: string;
  userId: string;
  fullName: string | null;
  email: string;
  roleKey: string;
  roleName: string;
  status: 'invited' | 'active' | 'disabled';
}

export interface InvitationSummary {
  id: string;
  email: string;
  roleKey: string;
  roleName: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: Date;
}

/** What the /invite/[token] page shows before acceptance. */
export interface InvitationPreview {
  organizationName: string;
  email: string;
  roleName: string;
  state: 'valid' | 'expired' | 'revoked' | 'accepted';
}
