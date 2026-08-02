import { z } from 'zod';

export const createChangelogEntrySchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(120),
  body: z.string().trim().min(1, 'Enter a description').max(2000),
});
export type CreateChangelogEntryInput = z.infer<typeof createChangelogEntrySchema>;
