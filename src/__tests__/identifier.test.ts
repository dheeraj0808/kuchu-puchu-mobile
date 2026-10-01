import {
  formatNationalPhone,
  formatPhone,
  isValidEmail,
  nationalDigits,
  normalizeEmail,
  normalizePhone,
  phoneProblem,
} from '@/lib/identifier';

describe('phone normalisation (+91, spaces)', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['(+91) 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['0 98765 43210', '+919876543210'],
    [' 98765 43210 ', '+919876543210'],
  ])('%p → %p', (raw, e164) => {
    expect(normalizePhone(raw)).toBe(e164);
  });

  it('rejects numbers that are not Indian mobiles', () => {
    expect(normalizePhone('12345 67890')).toBeNull(); // must start 6–9
    expect(normalizePhone('98765 4321')).toBeNull(); // 9 digits
    expect(normalizePhone('')).toBeNull();
  });

  it('keeps a real number that starts with 91', () => {
    expect(normalizePhone('9198765432')).toBe('+919198765432');
  });

  it('caps input at 10 national digits', () => {
    expect(nationalDigits('98765432101234')).toBe('9876543210');
  });

  it('reports what is wrong, for the button and helper text', () => {
    expect(phoneProblem('')).toBe('empty');
    expect(phoneProblem('98765')).toBe('incomplete');
    expect(phoneProblem('1234567890')).toBe('invalid');
    expect(phoneProblem('9876543210')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatNationalPhone('9876543210')).toBe('98765 43210');
    expect(formatNationalPhone('987')).toBe('987');
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });
});

describe('email', () => {
  it('normalises and validates', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com');
    expect(isValidEmail('jane@example.com')).toBe(true);
    expect(isValidEmail('jane@example')).toBe(false);
    expect(isValidEmail('jane example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
