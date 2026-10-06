import { API_BASE_URL, apiRequest, fetchWithTimeout } from './client';
import { authHeaders } from '../utils/authStorage';
import type { UnsplashPhoto } from '../types/inventoryImage';

// Unsplash search for the inventory item image picker (Owner/Admin + Super
// Admin). The server holds the API key and caps results; we ask for 10.
export async function searchInventoryImages(query: string, perPage = 10): Promise<UnsplashPhoto[]> {
  const params = new URLSearchParams({ query, perPage: String(perPage) });
  return apiRequest<UnsplashPhoto[]>(`/inventory-images/search?${params.toString()}`);
}

// Stored images sit behind the bearer token, so a plain <img src> can't load
// them. Each one is fetched once as a blob and kept as an object URL for the
// session -- image ids are immutable (a new pick gets a new id), so a cached
// URL never goes stale. Failed loads are evicted so a later render retries.
const objectUrls = new Map<number, Promise<string>>();

export function getInventoryImageUrl(imageId: number): Promise<string> {
  let pending = objectUrls.get(imageId);
  if (!pending) {
    pending = fetchWithTimeout(`${API_BASE_URL}/inventory-images/${imageId}`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Image ${imageId} failed to load (${response.status})`);
        return URL.createObjectURL(await response.blob());
      })
      .catch((error) => {
        objectUrls.delete(imageId);
        throw error;
      });
    objectUrls.set(imageId, pending);
  }
  return pending;
}
