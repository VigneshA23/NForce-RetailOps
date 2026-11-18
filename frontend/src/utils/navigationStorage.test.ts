import { beforeEach, describe, expect, it } from 'vitest';
import { getOwnerTab, setOwnerTab } from './navigationStorage';
import type { NavTabKey } from '../types/navigation';

beforeEach(() => localStorage.clear());

describe('owner tab persistence', () => {
  it('ignores a saved tab for the removed Cash Target page so the shell uses its default', () => {
    localStorage.setItem('nforce-retailops-owner-tab', 'cash-target');
    expect(getOwnerTab()).toBeNull();
  });

  it('still restores a valid saved tab', () => {
    setOwnerTab('cash' as NavTabKey);
    expect(getOwnerTab()).toBe('cash');
  });
});
