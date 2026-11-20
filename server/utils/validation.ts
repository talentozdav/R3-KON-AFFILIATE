/**
 * Server-side international validation & formatting helpers.
 */

export function validateInternationalPhone(rawPhone: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return { valid: false, normalized: '', error: 'Telephone number is required.' };
  }

  if (!/^[+\d][\d\s().-]*$/.test(trimmed)) {
    return {
      valid: false,
      normalized: '',
      error: 'Please provide a valid international telephone number with digits and calling code (e.g. +44 20 7946 0958 or +234 803 123 4567).'
    };
  }

  if (trimmed.indexOf('+', 1) !== -1) {
    return {
      valid: false,
      normalized: '',
      error: 'Invalid "+" placement in telephone number.'
    };
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      error: 'Telephone numbers must include between 7 and 15 digits (including international calling code).'
    };
  }

  const normalized = trimmed.startsWith('+')
    ? `+${digits}`
    : trimmed.startsWith('00') && digits.length > 9
    ? `+${digits.slice(2)}`
    : trimmed;

  return { valid: true, normalized };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
