import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';
import { getMonthlyCashSummary, getSuperAdminMonthlyCashSummary } from './cashSummary';

vi.mock('./client', () => ({ apiRequest: vi.fn() }));

describe('cash summary API', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('loads the owner summary for a month', () => {
    const signal = new AbortController().signal;
    getMonthlyCashSummary('2026-10', signal);

    expect(apiRequest).toHaveBeenCalledWith('/stores/cash/monthly-summary?month=2026-10', { signal });
  });

  it('loads Combined totals when no Super Admin store is selected', () => {
    const signal = new AbortController().signal;
    getSuperAdminMonthlyCashSummary('2026-10', signal);

    expect(apiRequest).toHaveBeenCalledWith('/super-admin/cash/monthly-summary?month=2026-10', { signal });
  });

  it('sends the selected store ID to the Super Admin summary endpoint', () => {
    const signal = new AbortController().signal;
    getSuperAdminMonthlyCashSummary('2026-10', signal, 42);

    expect(apiRequest).toHaveBeenCalledWith(
      '/super-admin/cash/monthly-summary?month=2026-10&storeIds=42',
      { signal },
    );
  });
});
