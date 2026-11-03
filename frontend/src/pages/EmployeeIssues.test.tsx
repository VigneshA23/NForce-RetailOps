import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeIssues from './EmployeeIssues';
import * as issuesApi from '../api/issues';
import type { Issue } from '../types/issue';
import type { StoreSummary } from '../types/store';

vi.mock('../api/issues', () => ({
  getMyIssues: vi.fn(),
  raiseIssue: vi.fn(),
}));

vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetMyIssues = vi.mocked(issuesApi.getMyIssues);

const STORE = { id: 10, name: 'Downtown' } as StoreSummary;

function issue(overrides: Partial<Issue>): Issue {
  return {
    id: 1,
    storeId: 10,
    storeName: 'Downtown',
    employeeUserId: 42,
    employeeFullName: 'Jane Doe',
    note: 'Freezer is leaking',
    status: 'OPEN',
    raisedDate: '2026-09-24',
    responseText: null,
    respondedByFullName: null,
    respondedBySuperAdmin: false,
    respondedAt: null,
    createdAt: '2026-09-24T15:30:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetMyIssues.mockReset();
});

describe('EmployeeIssues — Raise Issue placement', () => {
  it('places Raise Issue beside the page title on desktop/tablet', async () => {
    mockGetMyIssues.mockResolvedValue([issue({})]);

    const { container } = render(<EmployeeIssues store={STORE} />);
    const button = await screen.findByRole('button', { name: /raise issue/i });

    expect(container.querySelector('.emp-issues-page__header')).toContainElement(button);
  });

  it('offers Raise Issue inside the empty state when there are no issues', async () => {
    mockGetMyIssues.mockResolvedValue([]);

    const { container } = render(<EmployeeIssues store={STORE} />);
    await screen.findByText('No issues raised yet');

    const empty = container.querySelector('.emp-issues-page__empty') as HTMLElement;
    expect(within(empty).getByRole('button', { name: /raise issue/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /raise issue/i })).toHaveLength(1);
  });
});
