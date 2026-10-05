import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import InventoryImagePicker, { type InventoryImageSelection } from './InventoryImagePicker';
import * as inventoryImagesApi from '../api/inventoryImages';

vi.mock('../api/inventoryImages', () => ({
  searchInventoryImages: vi.fn(),
  getInventoryImageUrl: vi.fn(),
}));

const mockSearch = vi.mocked(inventoryImagesApi.searchInventoryImages);

const EMPTY: InventoryImageSelection = { imageId: null, imagePhotoId: null, imagePreviewUrl: null, removeImage: false };

describe('InventoryImagePicker', () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it('searches Unsplash for the item name on open and records the picked photo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    mockSearch.mockResolvedValue([
      { id: 'abc', description: 'Coffee beans', thumbUrl: 'https://images.unsplash.com/t1', smallUrl: null, photographerName: 'Ana', photographerUrl: null },
      { id: 'def', description: 'Roasted beans', thumbUrl: 'https://images.unsplash.com/t2', smallUrl: null, photographerName: 'Ben', photographerUrl: null },
    ]);

    render(<InventoryImagePicker id="img" itemName="Coffee Beans" value={EMPTY} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /choose image/i }));

    expect(mockSearch).toHaveBeenCalledWith('Coffee Beans');
    await user.click(await screen.findByRole('option', { name: 'Roasted beans' }));
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY,
      imagePhotoId: 'def',
      imagePreviewUrl: 'https://images.unsplash.com/t2',
    });
  });

  it('shows the server error when search fails', async () => {
    const user = userEvent.setup();
    mockSearch.mockRejectedValue(new Error('Image search is not configured.'));

    render(<InventoryImagePicker id="img" itemName="Milk" value={EMPTY} onChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /choose image/i }));

    expect(await screen.findByText('Image search is not configured.')).toBeInTheDocument();
  });

  it('flags removal of a stored image', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    vi.mocked(inventoryImagesApi.getInventoryImageUrl).mockResolvedValue('blob:stored');

    render(<InventoryImagePicker id="img" itemName="Milk" value={{ ...EMPTY, imageId: 7 }} onChange={onChange} />);
    await user.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(onChange).toHaveBeenCalledWith({ ...EMPTY, imageId: 7, removeImage: true });
  });
});
