import { z } from 'zod';

export const roleSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  permissionKeys: z.array(z.string()).min(1, 'Select at least one permission'),
});
export type RoleInput = z.infer<typeof roleSchema>;
