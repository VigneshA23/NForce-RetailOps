import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminIssues from './AdminIssues';
import * as issuesApi from '../api/issues';
import type { Issue } from '../types/issue';

vi.mock('../api/issues', () => ({
  getIssues: vi.fn(),
  updateIssueStatus: vi.fn(),
}));

vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetIssues = vi.mocked(issuesApi.getIssues);
const mockUpdateIssueStatus = vi.mocked(issuesApi.updateIssueStatus);

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
  mockGetIssues.mockReset();
  mockUpdateIssueStatus.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AdminIssues', () => {
  it('dates cards from createdAt, not the bare raisedDate (which parses as UTC midnight)', async () => {
    // A raisedDate a day off from createdAt proves which one is rendered.
    mockGetIssues.mockResolvedValue([issue({ raisedDate: '2026-01-01', createdAt: '2026-09-24T15:30:00Z' })]);

    render(<AdminIssues storeId={10} />);

    const expected = new Date('2026-09-24T15:30:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/Jan 1, 2026/)).not.toBeInTheDocument();
  });

  it('keeps an acknowledged issue visible under the default Active filter and lets it be resolved from Open', async () => {
    mockGetIssues.mockResolvedValue([
      issue({ id: 1, note: 'Open one', status: 'OPEN' }),
      issue({ id: 2, note: 'Acknowledged one', status: 'ACKNOWLEDGED' }),
      issue({ id: 3, note: 'Resolved one', status: 'RESOLVED' }),
    ]);

    render(<AdminIssues storeId={10} />);

    expect(await screen.findByText('Open one')).toBeInTheDocument();
    expect(screen.getByText('Acknowledged one')).toBeInTheDocument();
    expect(screen.queryByText('Resolved one')).not.toBeInTheDocument();

    const openCard = document.getElementById('admin-issue-row-1')!;
    expect(within(openCard).getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
    expect(within(openCard).getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('resolves with a response through the shared modal', async () => {
    const user = userEvent.setup();
    mockGetIssues.mockResolvedValue([issue({ id: 1, status: 'OPEN' })]);
    mockUpdateIssueStatus.mockResolvedValue(issue({
      id: 1, status: 'RESOLVED', responseText: 'Technician booked', respondedByFullName: 'Owner', respondedAt: '2026-09-24T16:00:00Z',
    }));

    render(<AdminIssues storeId={10} />);
    await user.click(await screen.findByRole('button', { name: 'Resolve' }));
    await user.type(screen.getByLabelText('Response'), 'Technician booked');
    await user.click(screen.getByRole('button', { name: 'Confirm Resolve' }));

    await waitFor(() => expect(mockUpdateIssueStatus).toHaveBeenCalledWith(1, 'RESOLVED', 'Technician booked'));
  });

  it('shows only the error, not the empty state, when loading fails', async () => {
    mockGetIssues.mockRejectedValue(new Error('Server unavailable'));

    render(<AdminIssues storeId={10} />);

    expect(await screen.findByText('Server unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No issues have been raised yet.')).not.toBeInTheDocument();
  });

  it('does not spin forever when there is no store', async () => {
    render(<AdminIssues storeId={null} />);

    expect(await screen.findByText(/No store is linked/)).toBeInTheDocument();
    expect(screen.queryByText('Loading issues…')).not.toBeInTheDocument();
    expect(mockGetIssues).not.toHaveBeenCalled();
  });

  it('refetches when the tab becomes active again', async () => {
    mockGetIssues.mockResolvedValueOnce([issue({ id: 1, note: 'First load' })]);
    const { rerender } = render(<AdminIssues storeId={10} isActive />);
    expect(await screen.findByText('First load')).toBeInTheDocument();

    rerender(<AdminIssues storeId={10} isActive={false} />);
    mockGetIssues.mockResolvedValueOnce([issue({ id: 1, note: 'First load' }), issue({ id: 2, note: 'Raised while away' })]);
    rerender(<AdminIssues storeId={10} isActive />);

    expect(await screen.findByText('Raised while away')).toBeInTheDocument();
    expect(mockGetIssues).toHaveBeenCalledTimes(2);
  });

  it('clears filters and highlights a deep-linked issue', async () => {
    mockGetIssues.mockResolvedValue([issue({ id: 7, note: 'Old resolved issue', status: 'RESOLVED' })]);

    render(<AdminIssues storeId={10} focusIssueId={{ issueId: 7, ts: 1 }} />);

    // Hidden by the default Active filter until the focus request clears it.
    expect(await screen.findByText('Old resolved issue')).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById('admin-issue-row-7')).toHaveClass('issue-card--highlighted'));
  });
});
