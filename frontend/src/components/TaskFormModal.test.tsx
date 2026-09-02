import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskFormModal from './TaskFormModal';
import type { Category } from '../types/category';
import type { OwnerStore } from '../types/ownerStore';

<<<<<<< HEAD
const categories: Category[] = [{ id: 1, name: 'Cleaning', displayOrder: 0, active: true }];
=======
const categories: Category[] = [{ id: 1, name: 'Cleaning', displayOrder: 0, active: true, taskCount: 0 }];
>>>>>>> dev
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
      storesLoading={false}
      storesError={null}
      onRetryStores={() => {}}
      onClose={() => {}}
      onSubmit={vi.fn()}
    />,
  );
}

async function selectShortTextResponseType(user: ReturnType<typeof userEvent.setup>) {
  const select = screen.getByLabelText(/Response Type/i);
  await user.selectOptions(select, 'TEXT');
  return screen.getByLabelText(/Short Text/i) as HTMLInputElement;
}

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
