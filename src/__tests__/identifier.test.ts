import { formatDuration, maskIdentifier, normalizeIdentifier, validateIdentifier, validateOtp } from '@/lib/identifier';

// Cases mirror backend/src/auth/dto/dto-validation.spec.ts.
describe('identifier rules', () => {
  it('normalizes like the backend', () => {
    expect(normalizeIdentifier('email', '  Jane@Example.COM ')).toBe('jane@example.com');
    expect(normalizeIdentifier('phone', '+91 98765-43210')).toBe('+919876543210');
  });

  it('validates phone numbers as E.164', () => {
    expect(validateIdentifier('phone', '+91 98765-43210')).toBeNull();
    expect(validateIdentifier('phone', '9876543210')).toMatch(/country code/);
    expect(validateIdentifier('phone', 'jane@example.com')).not.toBeNull();
    expect(validateIdentifier('phone', '')).toMatch(/Enter your phone/);
  });

  it('validates email', () => {
    expect(validateIdentifier('email', 'jane@example.com')).toBeNull();
    expect(validateIdentifier('email', '+919876543210')).not.toBeNull();
    expect(validateIdentifier('email', 'jane@')).not.toBeNull();
    expect(validateIdentifier('email', `${'a'.repeat(250)}@x.com`)).not.toBeNull();
  });

  it('validates OTP digits and length', () => {
    expect(validateOtp('012345', 6)).toBeNull();
    expect(validateOtp('12ab56', 6)).not.toBeNull();
    expect(validateOtp('123', 6)).toMatch(/all 6/);
  });

  it('masks like the backend and formats countdowns', () => {
    expect(maskIdentifier('email', 'jane@example.com')).toBe('j***@example.com');
    expect(maskIdentifier('phone', '+919876543210')).toBe('+91******3210');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(-3)).toBe('0:00');
  });
});
