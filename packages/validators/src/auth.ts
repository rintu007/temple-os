import { z } from 'zod';

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Please enter your name').max(120),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Enter a valid email address'),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const changeAccountPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangeAccountPasswordInput = z.infer<typeof changeAccountPasswordSchema>;
