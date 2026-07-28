import type { Permission } from '../../shared';

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissionCount: number;
  memberCount: number;
}

export interface RoleDetail extends RoleSummary {
  permissionKeys: Permission[];
}
