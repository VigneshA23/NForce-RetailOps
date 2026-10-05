import { useEffect, useState } from 'react';
import { getInventoryImageUrl } from '../api/inventoryImages';

// Resolves a stored inventory image id to a displayable object URL; null
// while loading, on failure, or when there's no image.
export function useInventoryImageUrl(imageId: number | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (imageId == null) return undefined;
    let cancelled = false;
    getInventoryImageUrl(imageId)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        // Falls back to the placeholder icon.
      });
    return () => {
      cancelled = true;
    };
  }, [imageId]);

  return url;
}
