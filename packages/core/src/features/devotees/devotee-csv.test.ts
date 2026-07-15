import { describe, expect, it } from 'vitest';
import { mapCsvToDevoteeInputs, parseCsv } from './devotee-csv';

describe('parseCsv', () => {
  it('parses simple rows and trims trailing newline', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas, newlines and escaped quotes', () => {
    const text = 'name,notes\n"Roy, Anita","Says ""hello""\nsecond line"\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'notes'],
      ['Roy, Anita', 'Says "hello"\nsecond line'],
    ]);
  });

  it('handles CRLF endings (Excel exports)', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('skips blank lines', () => {
    expect(parseCsv('a,b\n\n1,2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('mapCsvToDevoteeInputs', () => {
  it('maps flexible header aliases', () => {
    const { candidates } = mapCsvToDevoteeInputs(
      'Full Name,Mobile,E-mail,Family,PINCODE\nAnita Roy,9876543210,anita@example.com,Roy Family,700001\n',
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.input).toMatchObject({
      fullName: 'Anita Roy',
      phone: '9876543210',
      email: 'anita@example.com',
      familyName: 'Roy Family',
      postalCode: '700001',
    });
    expect(candidates[0]?.line).toBe(2);
  });

  it('normalizes gender and Indian-style dates', () => {
    const { candidates } = mapCsvToDevoteeInputs(
      'name,sex,dob\nRavi,M,15/08/1975\nMita,Female,1980-01-02\n',
    );
    expect(candidates[0]?.input.gender).toBe('male');
    expect(candidates[0]?.input.dateOfBirth).toBe('1975-08-15');
    expect(candidates[1]?.input.gender).toBe('female');
    expect(candidates[1]?.input.dateOfBirth).toBe('1980-01-02');
  });

  it('errors when there is no name column', () => {
    const { headerError } = mapCsvToDevoteeInputs('phone,email\n123,a@b.c\n');
    expect(headerError).toMatch(/name column/i);
  });

  it('errors on empty input', () => {
    const { headerError } = mapCsvToDevoteeInputs('');
    expect(headerError).toBeTruthy();
  });
});
