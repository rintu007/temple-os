import { describe, expect, it } from 'vitest';
import { toWhatsAppNumber } from './phone';

describe('toWhatsAppNumber', () => {
  it('passes through an already-international number', () => {
    expect(toWhatsAppNumber('+91 98765 43210', 'IN')).toBe('+919876543210');
  });

  it('prepends the org calling code to a local number', () => {
    expect(toWhatsAppNumber('98765 43210', 'IN')).toBe('+919876543210');
  });

  it('drops a leading trunk zero before prepending the calling code', () => {
    expect(toWhatsAppNumber('01711-223344', 'BD')).toBe('+8801711223344');
  });

  it('does not double the calling code if already present without a plus', () => {
    expect(toWhatsAppNumber('919876543210', 'IN')).toBe('+919876543210');
  });

  it('returns null for empty or unusably short input', () => {
    expect(toWhatsAppNumber('', 'IN')).toBeNull();
    expect(toWhatsAppNumber('123', 'IN')).toBeNull();
  });

  it('falls back to a bare + for an unknown org country', () => {
    expect(toWhatsAppNumber('123456789', 'FR')).toBe('+123456789');
  });
});
