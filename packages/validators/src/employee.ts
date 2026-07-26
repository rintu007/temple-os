import { z } from 'zod';

export const EMPLOYMENT_TYPES = ['salaried', 'priest', 'wage', 'honorary'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const employeeSchema = z.object({
  name: z.string().trim().min(2, 'Enter the staff name').max(120),
  designation: optionalTrimmed(120),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  monthlySalary: z
    .union([z.coerce.number().nonnegative('Salary cannot be negative').max(100_000_000), z.literal('')])
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalTrimmed(30),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  joinedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  note: optionalTrimmed(500),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const employeeListQuerySchema = z.object({
  scope: z.enum(['active', 'all']).default('active'),
});
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
