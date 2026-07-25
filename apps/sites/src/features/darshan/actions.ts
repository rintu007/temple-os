'use server';

import { darshanService } from '@/lib/services';

export interface DarshanBookState {
  ok?: boolean;
  error?: string;
  tokenNumber?: number;
  devoteeName?: string;
}

export async function bookTokenAction(
  organizationId: string,
  _prev: DarshanBookState,
  formData: FormData,
): Promise<DarshanBookState> {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await darshanService().bookToken(organizationId, {
    slotId: field('slotId'),
    devoteeName: field('devoteeName'),
    phone: field('phone'),
    email: field('email'),
    partySize: field('partySize') || 1,
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };
  return { ok: true, tokenNumber: result.value.tokenNumber, devoteeName: field('devoteeName') };
}
