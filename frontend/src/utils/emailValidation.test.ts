import { describe, expect, it } from 'vitest';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from './emailValidation';

// RTS-582: the one rule Login, Forgot Password, Owner, Employee and Profile
// all use. backend EmailFormatTest checks the same cases against the server.
describe('isValidEmail', () => {
  it.each(['jane@nforceone.com', 'jane.doe+cash@store.co.uk', 'a@b.io'])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    'notanemail',
    'jane@',
    '@nforceone.com',
    'jane@nforceone',
    'jane@nforceone.c',
    'jane doe@nforceone.com',
    'jane@@nforceone.com',
    ' jane@nforceone.com',
    '',
  ])('rejects "%s"', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('uses the Login page message', () => {
    expect(INVALID_EMAIL_MESSAGE).toBe('Please enter a valid email address');
  });
});
