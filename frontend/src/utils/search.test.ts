import { describe, expect, it } from 'vitest';
import { matchesSearch } from './search';

describe('matchesSearch', () => {
  it('matches everything when the query is empty or whitespace', () => {
    expect(matchesSearch('', ['Category', 'Task'])).toBe(true);
    expect(matchesSearch('   ', ['Category', 'Task'])).toBe(true);
  });

  it('matches case-insensitively against any field', () => {
    expect(matchesSearch('jane', ['Opening Checks', 'Check float', 'Jane Doe'])).toBe(true);
    expect(matchesSearch('OPENING', ['Opening Checks', 'Check float'])).toBe(true);
  });

  it('returns false when no field contains the query', () => {
    expect(matchesSearch('nomatch', ['Opening Checks', 'Check float', 'Jane Doe'])).toBe(false);
  });

  it('treats null/undefined fields as empty rather than throwing', () => {
    expect(matchesSearch('jane', ['Opening Checks', null, undefined, 'Jane Doe'])).toBe(true);
    expect(matchesSearch('nomatch', [null, undefined])).toBe(false);
  });
});
