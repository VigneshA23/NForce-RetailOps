import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePagedList } from './usePagedList';

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('usePagedList', () => {
  it('slices the current page and reports the page count', () => {
    const { result } = renderHook(() => usePagedList(makeItems(25), 10, ''));
    expect(result.current.pageCount).toBe(3);
    expect(result.current.pageItems.map((i) => i.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    act(() => result.current.setPage(3));
    expect(result.current.pageItems.map((i) => i.id)).toEqual([21, 22, 23, 24, 25]);
  });

  it('goes back to page 1 when the reset key changes', () => {
    const { result, rerender } = renderHook(({ key }) => usePagedList(makeItems(25), 10, key), {
      initialProps: { key: 'a' },
    });
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    rerender({ key: 'b' });
    expect(result.current.page).toBe(1);
  });

  it('clamps to the last page when the list shrinks', () => {
    const { result, rerender } = renderHook(({ items }) => usePagedList(items, 10, ''), {
      initialProps: { items: makeItems(25) },
    });
    act(() => result.current.setPage(3));

    rerender({ items: makeItems(12) });
    expect(result.current.page).toBe(2);
    expect(result.current.pageItems.map((i) => i.id)).toEqual([11, 12]);
  });

  it('revealItem jumps to the page holding that item', () => {
    const { result, rerender } = renderHook(({ key }) => usePagedList(makeItems(25), 10, key), {
      initialProps: { key: 'a' },
    });

    act(() => result.current.revealItem(17));
    expect(result.current.page).toBe(2);
    rerender({ key: 'a' });
    expect(result.current.page).toBe(2);
  });

  it('revealItem wins over a reset made in the same update (clearFilters on a deep link)', () => {
    const { result } = renderHook(() => {
      const [key, setKey] = useState('filtered');
      return { ...usePagedList(makeItems(25), 10, key), setKey };
    });

    act(() => {
      result.current.setKey('cleared');
      result.current.revealItem(24);
    });
    expect(result.current.page).toBe(3);
  });
});
