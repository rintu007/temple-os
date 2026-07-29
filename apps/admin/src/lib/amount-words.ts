/**
 * Amount in words using the Indian numbering system (lakh/crore) — printed on
 * receipts and vouchers as committees and auditors expect.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = TENS[Math.floor(n / 10)] ?? '';
  const o = ONES[n % 10] ?? '';
  return o ? `${t} ${o}` : t;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h ? `${ONES[h]} Hundred` : '';
  const tail = twoDigits(rest);
  return [head, tail].filter(Boolean).join(' ');
}

/** Integer part in South Asian groups: crore, lakh, thousand, hundred-units. */
function integerInWordsSouthAsian(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const rest = n % 1_000;
  return [
    crore ? `${integerInWordsSouthAsian(crore)} Crore` : '',
    lakh ? `${twoDigits(lakh)} Lakh` : '',
    thousand ? `${twoDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Integer part in international groups: billion, million, thousand, hundred-units. */
function integerInWordsInternational(n: number): string {
  if (n === 0) return 'Zero';
  const billion = Math.floor(n / 1_000_000_000);
  const million = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousand = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;
  return [
    billion ? `${threeDigits(billion)} Billion` : '',
    million ? `${threeDigits(million)} Million` : '',
    thousand ? `${threeDigits(thousand)} Thousand` : '',
    rest ? threeDigits(rest) : '',
  ]
    .filter(Boolean)
    .join(' ');
}

type Currency = 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';

/** India and Bangladesh both use the lakh/crore grouping; everywhere else uses thousand/million/billion. */
const SOUTH_ASIAN_CURRENCIES: ReadonlySet<Currency> = new Set(['INR', 'BDT']);

const UNITS: Record<Currency, { unit: string; subunit: string }> = {
  INR: { unit: 'Rupees', subunit: 'Paise' },
  BDT: { unit: 'Taka', subunit: 'Poisha' },
  USD: { unit: 'Dollars', subunit: 'Cents' },
  GBP: { unit: 'Pounds', subunit: 'Pence' },
  CAD: { unit: 'Dollars', subunit: 'Cents' },
  AUD: { unit: 'Dollars', subunit: 'Cents' },
};

/** "1250.50", "INR" → "Rupees One Thousand Two Hundred Fifty and Paise Fifty Only" */
export function amountInWords(amount: string, currency: Currency): string {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return '';
  const { unit, subunit } = UNITS[currency];
  const integerInWords = SOUTH_ASIAN_CURRENCIES.has(currency)
    ? integerInWordsSouthAsian
    : integerInWordsInternational;
  const whole = Math.floor(value);
  const fraction = Math.round((value - whole) * 100);

  const parts = [`${unit} ${integerInWords(whole)}`];
  if (fraction > 0) parts.push(`and ${subunit} ${twoDigits(fraction)}`);
  return `${parts.join(' ')} Only`;
}
