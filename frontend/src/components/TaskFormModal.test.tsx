import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskFormModal from './TaskFormModal';
import type { Category } from '../types/category';
import type { OwnerStore } from '../types/ownerStore';
import type { AdminTask } from '../types/adminTask';

const categories: Category[] = [{
  id: 1,
  name: 'Cleaning',
  displayOrder: 0,
  active: true,
  taskCount: 0,
  appliesToAllStores: true,
  stores: [],
  createdByOwnerId: null,
  createdByOwnerName: 'Super Admin',
  badgeColor: 'blue',
  startDate: null,
}];
const stores: OwnerStore[] = [{ id: 1, storeCode: 10001, name: 'Store 1', active: true, employeeCount: 0, taskCount: 0 }];

function renderModal() {
  return render(
    <TaskFormModal
      isOpen
      mode="create"
      categories={categories}
      categoriesLoading={false}
      categoriesError={null}
      onRetryCategories={() => {}}
      onManageCategories={() => {}}
      stores={stores}
      onClose={() => {}}
      onSubmit={vi.fn()}
    />,
  );
}

async function selectShortTextResponseType(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Response Type/i));
  await user.click(screen.getByRole('button', { name: 'Short Text' }));
  return screen.getByLabelText(/Short Text/i) as HTMLInputElement;
}

const cleaningCategory: Category = categories[0];
const stockingCategory: Category = { ...cleaningCategory, id: 2, name: 'Stocking' };
const store2 = { id: 2, name: 'Store 2' };

function editableTask(overrides: Partial<AdminTask> = {}): AdminTask {
  return {
    id: 1,
    name: 'Wipe counters',
    description: null,
    categoryId: 1,
    categoryName: 'Cleaning',
    displayOrder: 0,
    appliesToAllStores: false,
    stores: [{ id: 1, name: 'Store 1' }],
    responseType: 'DONE_NOT_DONE',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
    maxCompletions: null,
    scheduleType: 'EVERY_DAY',
    selectedDays: [],
    startDate: '2026-01-01',
    endDate: null,
    timeMode: 'ANYTIME',
    startTime: null,
    endTime: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// Mirrors SuperAdminTasks.tsx's real state wiring: categories/categoriesLoading
// are owned by the parent and refetched asynchronously via onStoreScopeChange,
// so a regression test needs a harness that reproduces that async round trip
// rather than passing static props straight to TaskFormModal.
function EditHarness({ nextCategoriesForNewScope }: { nextCategoriesForNewScope: Category[] }) {
  const [formCategories, setFormCategories] = useState<Category[]>([cleaningCategory]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  async function loadCategoriesForScope() {
    setCategoriesLoading(true);
    await Promise.resolve();
    setFormCategories(nextCategoriesForNewScope);
    setCategoriesLoading(false);
  }

  return (
    <TaskFormModal
      isOpen
      mode="edit"
      initialTask={editableTask()}
      categories={formCategories}
      categoriesLoading={categoriesLoading}
      categoriesError={null}
      onRetryCategories={() => {}}
      onManageCategories={() => {}}
      stores={[stores[0], store2]}
      storeScopeSelectable
      onStoreScopeChange={loadCategoriesForScope}
      onClose={() => {}}
      onSubmit={vi.fn()}
    />
  );
}

// Regression tests for the reported bug: changing/adding to an existing
// task's store scope must not blindly clear its already-selected category.
describe('TaskFormModal store-scope change preserves a still-valid category', () => {
  it('keeps the selected category when it is still applicable to the new store scope', async () => {
    const user = userEvent.setup();
    render(<EditHarness nextCategoriesForNewScope={[cleaningCategory, stockingCategory]} />);

    expect(screen.getByLabelText('Category *')).toHaveTextContent('Cleaning');

    await user.click(screen.getByLabelText('Store *'));
    await user.click(screen.getByRole('button', { name: 'Store 2' }));

    await waitFor(() => expect(screen.getByLabelText('Category *')).toHaveTextContent('Cleaning'));
  });

  it('clears the selected category once it is no longer applicable to the new store scope', async () => {
    const user = userEvent.setup();
    render(<EditHarness nextCategoriesForNewScope={[stockingCategory]} />);

    expect(screen.getByLabelText('Category *')).toHaveTextContent('Cleaning');

    await user.click(screen.getByLabelText('Store *'));
    await user.click(screen.getByRole('button', { name: 'Store 2' }));

    await waitFor(() => expect(screen.getByLabelText('Category *')).toHaveTextContent('Select Category'));
  });
});

describe('TaskFormModal Short Text response', () => {
  it('caps typed input at 25 characters and shows a matching counter', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = await selectShortTextResponseType(user);

    await user.type(input, 'a'.repeat(40));

    expect(input.value).toHaveLength(25);
    expect(screen.getByText('25 / 25')).toBeInTheDocument();
  });

  it('truncates a pasted value longer than 25 characters to the first 25 characters', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = await selectShortTextResponseType(user);

    await user.click(input);
    await user.paste('b'.repeat(50));

    expect(input.value).toHaveLength(25);
    expect(input.value).toBe('b'.repeat(25));
  });

  it('accepts exactly 25 characters and leaves the counter at 25 / 25', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = await selectShortTextResponseType(user);

    await user.type(input, 'c'.repeat(25));

    expect(input.value).toHaveLength(25);
    expect(screen.getByText('25 / 25')).toBeInTheDocument();
  });

  it('leaves the Short Text field empty and optional with no required marker', async () => {
    const user = userEvent.setup();
    renderModal();
    const input = await selectShortTextResponseType(user);

    expect(input.value).toBe('');
    expect(screen.getByText('0 / 25')).toBeInTheDocument();
    expect(screen.getByText(/Short Text \(optional\)/)).toBeInTheDocument();
  });
});
