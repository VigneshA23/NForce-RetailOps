import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Notifications from './Notifications';
import * as notificationsApi from '../api/notifications';
import type { Notification } from '../types/notification';
import type { StoreSummary } from '../types/store';

vi.mock('../api/notifications', () => ({
  deleteNotification: vi.fn(),
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const mockGetNotifications = vi.mocked(notificationsApi.getNotifications);
const mockGetUnreadCount = vi.mocked(notificationsApi.getUnreadCount);

const assignedStores: StoreSummary[] = [
  { id: 1, name: 'Store Alpha', location: null, status: 'Open' },
  { id: 2, name: 'Store Beta', location: null, status: 'Open' },
];

function makeNotification({
  id,
  title,
  ...overrides
}: Partial<Notification> & Pick<Notification, 'id' | 'title'>): Notification {
  return {
    id,
    title,
    message: 'A checklist update is available.',
    category: 'TASK_ASSIGNED',
    priority: 'MEDIUM',
    read: true,
    linkPath: null,
    relatedIssueId: null,
    relatedIssueNote: null,
    relatedStoreName: null,
    relatedIssueStatus: null,
    storeId: null,
    createdAt: '2026-10-13T12:00:00Z',
    ...overrides,
  };
}

function renderNotifications(props: { stores?: StoreSummary[]; activeStoreId?: number } = {}) {
  return render(
    <Notifications
      onUnreadChange={vi.fn()}
      assignedStores={props.stores}
      activeStoreId={props.activeStoreId}
    />,
  );
}

beforeEach(() => {
  mockGetNotifications.mockReset();
  mockGetUnreadCount.mockReset();
  mockGetUnreadCount.mockResolvedValue(0);
});

describe('Notifications employee store scope', () => {
  it('defaults to the active store and includes null or missing store IDs without inventing a store', async () => {
    mockGetNotifications.mockResolvedValue([
      makeNotification({ id: 1, title: 'Alpha task', storeId: 1 }),
      makeNotification({ id: 2, title: 'Beta task', storeId: 2 }),
      makeNotification({ id: 3, title: 'Unspecified task', storeId: null }),
      makeNotification({ id: 4, title: 'Missing ID task', storeId: undefined }),
      makeNotification({ id: 5, title: 'Unassigned store task', storeId: 99 }),
    ]);

    renderNotifications({ stores: assignedStores, activeStoreId: 1 });

    expect(await screen.findByText('Alpha task')).toBeInTheDocument();
    expect(screen.queryByText('Beta task')).not.toBeInTheDocument();
    expect(screen.getByText('Unspecified task')).toBeInTheDocument();
    expect(screen.getByText('Missing ID task')).toBeInTheDocument();
    expect(screen.queryByText('Unassigned store task')).not.toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('.nfp-row__msg')).map((element) => element.textContent))
      .toContain('Store Alpha · A checklist update is available.');
    expect(screen.getAllByText('Store Alpha', { selector: 'strong' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Store not specified', { selector: 'strong' })).toHaveLength(2);
    expect(Array.from(document.querySelectorAll('.nfp-row__msg')).filter(
      (element) => element.textContent === 'Store not specified · A checklist update is available.',
    )).toHaveLength(2);
  });

  it('shows assigned stores and unresolved notifications in All Stores, without duplicate notifications', async () => {
    const user = userEvent.setup();
    mockGetNotifications.mockResolvedValue([
      makeNotification({ id: 1, title: 'Alpha task', storeId: 1 }),
      makeNotification({ id: 2, title: 'Beta task', storeId: 2 }),
      makeNotification({ id: 3, title: 'Unspecified task', storeId: null }),
      makeNotification({ id: 4, title: 'Unassigned store task', storeId: 99 }),
    ]);

    renderNotifications({ stores: assignedStores, activeStoreId: 1 });
    await screen.findByText('Alpha task');
    const storeFilter = screen.getByLabelText('Filter by store');
    await user.selectOptions(storeFilter, '2');

    expect(screen.getByText('Beta task')).toBeInTheDocument();
    expect(screen.queryByText('Alpha task')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filter by store')).toHaveValue('2');

    await user.selectOptions(storeFilter, 'all');

    expect(screen.getByText('Alpha task')).toBeInTheDocument();
    expect(screen.getByText('Beta task')).toBeInTheDocument();
    expect(screen.getByText('Unspecified task')).toBeInTheDocument();
    expect(screen.queryByText('Unassigned store task')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unspecified task')).toHaveLength(1);
  });

  it('does not show a store filter for single-store employees', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ id: 1, title: 'Alpha task', storeId: 1 })]);

    renderNotifications({ stores: assignedStores.slice(0, 1), activeStoreId: 1 });

    expect(await screen.findByText('Alpha task')).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter by store')).not.toBeInTheDocument();
  });

  it('uses and bolds the store name supplied by the response outside employee store context', async () => {
    mockGetNotifications.mockResolvedValue([
      makeNotification({
        id: 1,
        title: 'Store update',
        message: 'A new task was added at Central Market.',
        relatedStoreName: 'Central Market',
        storeId: 3,
      }),
    ]);

    renderNotifications();

    expect(await screen.findByText('Store update')).toBeInTheDocument();
    expect(screen.getByText('Central Market', { selector: 'strong' })).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('.nfp-row__msg')).map((element) => element.textContent))
      .toContain('A new task was added at Central Market.');
  });

  it('renders the assigned store name for inventory, stock-check, task, checklist, and other events', async () => {
    mockGetNotifications.mockResolvedValue([
      makeNotification({ id: 1, title: 'Inventory', category: 'INVENTORY', storeId: 1 }),
      makeNotification({ id: 2, title: 'Stock check', category: 'STOCK_CHECK', storeId: 1 }),
      makeNotification({ id: 3, title: 'Task', category: 'TASK_ASSIGNED', storeId: 1 }),
      makeNotification({ id: 4, title: 'Checklist', category: 'CHECKLIST', storeId: 1 }),
      makeNotification({ id: 5, title: 'Other event', category: 'OTHER', storeId: 1 }),
      makeNotification({ id: 6, title: 'Name already present', storeId: 1, message: 'Store Alpha: task updated.' }),
    ]);

    renderNotifications({ stores: assignedStores, activeStoreId: 1 });

    await screen.findByText('Inventory');
    const rows = Array.from(document.querySelectorAll('.nfp-row__msg'))
      .filter((element) => element.textContent === 'Store Alpha · A checklist update is available.');
    expect(rows).toHaveLength(5);
    expect(Array.from(document.querySelectorAll('.nfp-row__msg')).map((element) => element.textContent))
      .toContain('Store Alpha: task updated.');
    expect(screen.getAllByText('Store Alpha', { selector: 'strong' })).toHaveLength(6);
  });
});
