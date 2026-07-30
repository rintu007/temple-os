/** Calling codes for TempleOS's supported org countries (packages/db countryEnum). */
const CALLING_CODES: Record<string, string> = {
  IN: '91',
  BD: '880',
  US: '1',
  GB: '44',
  CA: '1',
  AU: '61',
};

/**
 * Devotee phone numbers are freeform text with no format enforced anywhere
 * in the app (see packages/validators — every phone field is just an
 * optional trimmed string). This is a best-effort normalizer, not real E.164
 * validation: strips formatting characters, and if the number has no
 * country code, prepends the org's own calling code and drops a leading
 * trunk '0' (common in IN/BD/GB local formatting). Returns null when there's
 * nothing plausible to send to.
 */
export function toWhatsAppNumber(rawPhone: string, orgCountry: string): string | null {
  const stripped = rawPhone.replace(/[^\d+]/g, '');
  if (!stripped) return null;

  if (stripped.startsWith('+')) {
    return stripped.length >= 8 ? stripped : null;
  }

  const code = CALLING_CODES[orgCountry];
  if (!code) return stripped.length >= 8 ? `+${stripped}` : null;
  if (stripped.startsWith(code)) return `+${stripped}`;

  const local = stripped.replace(/^0+/, '');
  return local.length >= 6 ? `+${code}${local}` : null;
}
