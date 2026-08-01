'use client';

import { Select } from '@templeos/ui';
import { switchOrganizationAction } from '../actions';

interface OrgOption {
  organizationId: string;
  organizationName: string;
}

export function OrgSwitcher({
  memberships,
  activeOrgId,
}: {
  memberships: OrgOption[];
  activeOrgId: string;
}) {
  return (
    <form action={switchOrganizationAction}>
      <Select
        name="organizationId"
        defaultValue={activeOrgId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 max-w-48 text-sm font-medium"
        aria-label="Switch organization"
      >
        {memberships.map((m) => (
          <option key={m.organizationId} value={m.organizationId}>
            {m.organizationName}
          </option>
        ))}
      </Select>
    </form>
  );
}
