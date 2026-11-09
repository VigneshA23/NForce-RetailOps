import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CashTargetForm from './CashTargetForm';
import * as targetApi from '../api/storeCashTarget';
import { ApiError } from '../api/client';
import { nfToast } from '../utils/toast';
import type { StoreCashTarget } from '../types/storeCashTarget';

vi.mock('../api/storeCashTarget', () => ({
  getCashTarget: vi.fn(),
  saveCashTarget: vi.fn(),
  getSuperAdminCashTarget: vi.fn(),
  saveSuperAdminCashTarget: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function target(overrides: Partial<StoreCashTarget> = {}): StoreCashTarget {
  return {
    storeId: 7,
    targetAmount: 150,
    updatedByUserId: null,
    updatedBySuperAdminId: null,
    updatedAt: '2026-11-09T10:00:00Z',
    ...overrides,
  };
}

function current() {
  return screen.getByTestId('cash-target-current');
}

function input() {
  return screen.getByLabelText(/^New target amount/) as HTMLInputElement;
}

beforeEach(() => {
  vi.mocked(targetApi.getCashTarget).mockReset().mockResolvedValue(target());
  vi.mocked(targetApi.saveCashTarget).mockReset();
  vi.mocked(targetApi.getSuperAdminCashTarget).mockReset();
  vi.mocked(targetApi.saveSuperAdminCashTarget).mockReset();
  vi.mocked(nfToast.success).mockReset();
  vi.mocked(nfToast.error).mockReset();
  vi.mocked(nfToast.info).mockReset();
});

describe('CashTargetForm', () => {
  it('shows a store still on the default target with a Default badge', async () => {
    render(<CashTargetForm scope="owner" />);

    expect(await screen.findByTestId('cash-target-current')).toHaveTextContent('$150.00');
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('This store has not set its own target yet.')).toBeInTheDocument();
    expect(input()).toHaveValue('150.00');
  });

  it('shows a target someone set explicitly without the Default badge', async () => {
    vi.mocked(targetApi.getCashTarget).mockResolvedValue(target({ targetAmount: 1200, updatedByUserId: 3 }));
    render(<CashTargetForm scope="owner" />);

    expect(await screen.findByTestId('cash-target-current')).toHaveTextContent('$1,200.00');
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    expect(screen.getByText(/^Last changed/)).toBeInTheDocument();
  });

  it('saves a new target and shows it straight away', async () => {
    const user = userEvent.setup();
    vi.mocked(targetApi.saveCashTarget).mockResolvedValue(target({ targetAmount: 175.5, updatedByUserId: 3 }));
    render(<CashTargetForm scope="owner" />);
    await screen.findByTestId('cash-target-current');

    await user.clear(input());
    await user.type(input(), '175.5');
    await user.click(screen.getByRole('button', { name: 'Save Target' }));

    expect(targetApi.saveCashTarget).toHaveBeenCalledWith(175.5);
    expect(current()).toHaveTextContent('$175.50');
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    expect(nfToast.success).toHaveBeenCalledWith('Cash drawer target set to $175.50.');
  });

  it('blocks negative, non-numeric and blank values with a message', async () => {
    const user = userEvent.setup();
    render(<CashTargetForm scope="owner" />);
    await screen.findByTestId('cash-target-current');

    await user.clear(input());
    await user.type(input(), '-20');
    await user.click(screen.getByRole('button', { name: 'Save Target' }));
    expect(screen.getByText('Target amount cannot be negative')).toBeInTheDocument();

    await user.clear(input());
    await user.type(input(), 'abc');
    expect(screen.getByText('Target amount must be a number, e.g. 125.50')).toBeInTheDocument();

    await user.clear(input());
    expect(screen.getByText('Target amount is required')).toBeInTheDocument();

    expect(targetApi.saveCashTarget).not.toHaveBeenCalled();
    expect(current()).toHaveTextContent('$150.00');
  });

  it('keeps the previous target in effect when the save fails', async () => {
    const user = userEvent.setup();
    vi.mocked(targetApi.saveCashTarget).mockRejectedValue(new ApiError(500, 'Server unavailable'));
    render(<CashTargetForm scope="owner" />);
    await screen.findByTestId('cash-target-current');

    await user.clear(input());
    await user.type(input(), '200');
    await user.click(screen.getByRole('button', { name: 'Save Target' }));

    expect(await screen.findByText('Not saved: Server unavailable The target is still $150.00.')).toBeInTheDocument();
    expect(current()).toHaveTextContent('$150.00');
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(nfToast.error).toHaveBeenCalled();
    expect(nfToast.success).not.toHaveBeenCalled();
  });

  it('does not call the server when the amount is unchanged', async () => {
    const user = userEvent.setup();
    render(<CashTargetForm scope="owner" />);
    await screen.findByTestId('cash-target-current');

    await user.click(screen.getByRole('button', { name: 'Save Target' }));

    expect(targetApi.saveCashTarget).not.toHaveBeenCalled();
    expect(nfToast.info).toHaveBeenCalledWith('The target is already $150.00.');
  });

  it('reads and saves a specific store through the Super Admin API', async () => {
    const user = userEvent.setup();
    vi.mocked(targetApi.getSuperAdminCashTarget).mockResolvedValue(target({ storeId: 4, targetAmount: 90, updatedByUserId: 8 }));
    vi.mocked(targetApi.saveSuperAdminCashTarget).mockResolvedValue(target({ storeId: 4, targetAmount: 120, updatedBySuperAdminId: 1 }));
    render(<CashTargetForm scope="super-admin" storeId={4} />);

    expect(await screen.findByTestId('cash-target-current')).toHaveTextContent('$90.00');
    expect(targetApi.getSuperAdminCashTarget).toHaveBeenCalledWith(4, expect.anything());
    expect(targetApi.getCashTarget).not.toHaveBeenCalled();

    await user.clear(input());
    await user.type(input(), '120');
    await user.click(screen.getByRole('button', { name: 'Save Target' }));

    expect(targetApi.saveSuperAdminCashTarget).toHaveBeenCalledWith(4, 120);
    expect(current()).toHaveTextContent('$120.00');
  });

  it('offers a retry when the target cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(targetApi.getCashTarget)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(target());
    render(<CashTargetForm scope="owner" />);

    expect(await screen.findByText('Network down')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('cash-target-current')).toHaveTextContent('$150.00');
  });
});
