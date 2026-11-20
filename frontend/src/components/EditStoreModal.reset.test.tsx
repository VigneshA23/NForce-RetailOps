import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditStoreModal from './EditStoreModal';

vi.mock('../api/owners', () => ({ getNextStoreCode: vi.fn().mockResolvedValue(1001) }));

// initialValues is a fresh object on every parent render (background polls).
function modal(onSubmit: (values: unknown) => void) {
  return (
    <EditStoreModal
      isOpen
      initialValues={{ name: 'Uptown', location: 'Main St', cashTarget: 100 }}
      onClose={() => {}}
      onSubmit={onSubmit}
    />
  );
}

describe('Edit Store keeps unsaved edits', () => {
  it('does not reset typed changes when the page re-renders', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(modal(onSubmit));

    const name = screen.getByLabelText(/store name/i);
    await user.clear(name);
    await user.type(name, 'Uptown Plaza');
    rerender(modal(onSubmit));

    expect(screen.getByLabelText(/store name/i)).toHaveValue('Uptown Plaza');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Uptown Plaza' }));
  });
});
