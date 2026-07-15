/**
 * CSV parsing + header mapping for devotee import. Pure functions — unit
 * tested without a database. Handles quoted fields, embedded commas/newlines,
 * escaped quotes and CRLF endings (RFC 4180-ish, as exported by Excel and
 * Google Sheets).
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.length > 1 || (row[0] ?? '').trim() !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\r') {
      if (text.charAt(i + 1) === '\n') i += 1;
      pushRow();
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  pushRow();
  return rows;
}

const HEADER_ALIASES: Record<string, readonly string[]> = {
  fullName: ['name', 'full name', 'fullname', 'devotee name', 'devotee'],
  phone: ['phone', 'mobile', 'phone number', 'mobile number', 'contact', 'contact number'],
  email: ['email', 'e-mail', 'email address'],
  familyName: ['family', 'family name', 'household'],
  gender: ['gender', 'sex'],
  dateOfBirth: ['dob', 'date of birth', 'birthdate', 'birth date'],
  addressLine1: ['address', 'address line 1', 'street'],
  city: ['city', 'town', 'village'],
  state: ['state', 'division', 'province'],
  postalCode: ['postal code', 'pincode', 'pin code', 'pin', 'zip', 'zip code'],
  notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
};

function normalizeGender(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === '' ) return '';
  if (v === 'm' || v === 'male') return 'male';
  if (v === 'f' || v === 'female') return 'female';
  return 'other';
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY → YYYY-MM-DD ('' if unrecognized). */
function normalizeDate(raw: string): string {
  const v = raw.trim();
  if (v === '') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d = '', m = '', y = ''] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

export interface CsvDevoteeCandidate {
  /** 1-based line number in the file (header = line 1). */
  line: number;
  input: Record<string, string>;
}

export interface CsvMapResult {
  candidates: CsvDevoteeCandidate[];
  headerError?: string;
}

export function mapCsvToDevoteeInputs(text: string): CsvMapResult {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header || rows.length < 2) {
    return { candidates: [], headerError: 'The file needs a header row and at least one data row' };
  }

  const normalized = header.map((h) => h.trim().toLowerCase());
  const columnFor: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) columnFor[field] = idx;
  }
  if (columnFor.fullName === undefined) {
    return {
      candidates: [],
      headerError: 'No name column found — add a header like "name" or "full name"',
    };
  }

  const candidates: CsvDevoteeCandidate[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r] ?? [];
    const value = (field: string) => {
      const idx = columnFor[field];
      return idx === undefined ? '' : (cells[idx] ?? '').trim();
    };
    candidates.push({
      line: r + 1,
      input: {
        fullName: value('fullName'),
        phone: value('phone'),
        email: value('email'),
        familyName: value('familyName'),
        gender: normalizeGender(value('gender')),
        dateOfBirth: normalizeDate(value('dateOfBirth')),
        addressLine1: value('addressLine1'),
        city: value('city'),
        state: value('state'),
        postalCode: value('postalCode'),
        notes: value('notes'),
      },
    });
  }
  return { candidates };
}
