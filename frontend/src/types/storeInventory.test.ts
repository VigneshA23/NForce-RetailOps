import { describe, expect, it } from 'vitest';
import { categoryMatches, distinctCategories } from './storeInventory';

// RTS-586: a category picked from a store's category list is saved as typed
// there (e.g. "Dairy"), while the built-in one is saved as "DAIRY".
describe('categoryMatches', () => {
  it('matches regardless of case and surrounding spaces', () => {
    expect(categoryMatches('Dairy', 'DAIRY')).toBe(true);
    expect(categoryMatches(' dairy ', 'DAIRY')).toBe(true);
    expect(categoryMatches('Snacks', 'snacks')).toBe(true);
  });

  it('does not match a different category or a missing one', () => {
    expect(categoryMatches('Daily', 'DAIRY')).toBe(false);
    expect(categoryMatches('CLEANING', 'DAIRY')).toBe(false);
    expect(categoryMatches(null, 'DAIRY')).toBe(false);
    expect(categoryMatches(undefined, 'DAIRY')).toBe(false);
  });
});

describe('distinctCategories', () => {
  it('collapses spellings of the same category into one entry', () => {
    expect(distinctCategories(['Dairy', 'DAIRY', 'dairy'])).toEqual(['DAIRY']);
    expect(distinctCategories(['Snacks', 'snacks'])).toEqual(['Snacks']);
  });

  it('skips empty values and sorts by label', () => {
    expect(distinctCategories(['CLEANING', null, '', 'Dairy', undefined, 'Bakery'])).toEqual(['Bakery', 'CLEANING', 'DAIRY']);
  });
});
