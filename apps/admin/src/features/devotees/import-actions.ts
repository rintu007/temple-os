'use server';

import { revalidatePath } from 'next/cache';
import type { ImportRowError } from '@templeos/core';
import { devoteeService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

export interface ImportFormState {
  error?: string;
  imported?: number;
  duplicates?: number;
  rowErrors?: ImportRowError[];
}

const MAX_FILE_BYTES = 1_000_000;

export async function importDevoteesAction(
  _prev: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const { ctx } = await requireTenantContext();

  let csvText = '';
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return { error: 'File is too large (max 1 MB / 500 rows)' };
    }
    csvText = await file.text();
  } else {
    const pasted = formData.get('csv');
    csvText = typeof pasted === 'string' ? pasted : '';
  }
  if (csvText.trim() === '') {
    return { error: 'Choose a CSV file or paste CSV data first' };
  }

  const result = await devoteeService().importDevoteesFromCsv(ctx, csvText);
  if (!result.ok) return { error: result.error.message };

  revalidatePath('/devotees');
  return {
    imported: result.value.imported,
    duplicates: result.value.duplicates,
    rowErrors: result.value.errors,
  };
}
