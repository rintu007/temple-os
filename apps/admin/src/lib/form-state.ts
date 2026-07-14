/** Shared shape for useActionState-driven forms. */
export interface FormState {
  error?: string;
  message?: string;
}

export const initialFormState: FormState = {};
