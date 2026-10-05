import { useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ImageOff, Search } from 'lucide-react';
import { searchInventoryImages } from '../api/inventoryImages';
import { useInventoryImageUrl } from '../hooks/useInventoryImageUrl';
import type { UnsplashPhoto } from '../types/inventoryImage';
import './InventoryImagePicker.css';

export interface InventoryImageSelection {
  // The item's stored image (edit mode), shown until replaced or removed.
  imageId: number | null;
  // A newly picked Unsplash photo, downloaded server-side on save.
  imagePhotoId: string | null;
  imagePreviewUrl: string | null;
  removeImage: boolean;
}

interface InventoryImagePickerProps {
  id: string;
  // The inventory name typed so far -- the default search term.
  itemName: string;
  value: InventoryImageSelection;
  onChange: (value: InventoryImageSelection) => void;
}

const UNSPLASH_REFERRAL = '?utm_source=nforce_retailops&utm_medium=referral';

// Dropdown under the item form's name field: searches Unsplash for the
// inventory name (10 results) and shows them in a horizontally scrolling
// strip with prev/next buttons. Picking one only records its id -- the
// backend downloads and stores the photo when the item is saved.
function InventoryImagePicker({ id, itemName, value, onChange }: InventoryImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const storedUrl = useInventoryImageUrl(value.removeImage ? null : value.imageId);

  const previewUrl = value.imagePreviewUrl ?? storedUrl;

  async function runSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) {
      setError('Enter an inventory name to search for images.');
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      const photos = await searchInventoryImages(trimmed);
      setResults(photos);
      setSearchedFor(trimmed);
      stripRef.current?.scrollTo({ left: 0 });
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Image search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }

  function toggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (!next) return;
    // Search on open only when the name changed since the last search --
    // the Unsplash key has an hourly request cap, so never search per keystroke.
    const name = itemName.trim();
    if (name && name !== searchedFor) {
      setQuery(name);
      void runSearch(name);
    } else if (!query) {
      setQuery(name);
    }
  }

  function scrollStrip(direction: 1 | -1) {
    const strip = stripRef.current;
    if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  }

  function select(photo: UnsplashPhoto) {
    onChange({ ...value, imagePhotoId: photo.id, imagePreviewUrl: photo.thumbUrl, removeImage: false });
    setIsOpen(false);
  }

  function remove() {
    onChange({ ...value, imagePhotoId: null, imagePreviewUrl: null, removeImage: value.imageId != null });
  }

  return (
    <div className="inventory-image-picker">
      <div className="inventory-image-picker__current">
        <span className="inventory-image-picker__preview">
          {previewUrl ? <img src={previewUrl} alt="Selected item image" /> : <ImageOff size={18} aria-hidden="true" />}
        </span>
        <button
          id={id}
          type="button"
          className="btn btn--secondary inventory-image-picker__trigger"
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          onClick={toggleOpen}
        >
          {previewUrl ? 'Change image' : 'Choose image'}
          <ChevronDown size={16} className={isOpen ? 'inventory-image-picker__chevron--open' : undefined} aria-hidden="true" />
        </button>
        {previewUrl && (
          <button type="button" className="inventory-image-picker__remove" onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {isOpen && (
        <div id={`${id}-panel`} className="inventory-image-picker__panel">
          {/* Not a nested <form> -- that's invalid inside the item form, and
              Enter here must search rather than submit the item. */}
          <div className="inventory-image-picker__search" role="search">
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void runSearch(query);
                }
              }}
              placeholder="Search images"
              aria-label="Search images"
            />
            <button type="button" className="btn btn--secondary" onClick={() => void runSearch(query)} disabled={isSearching}>
              <Search size={16} aria-hidden="true" />
              Search
            </button>
          </div>

          {isSearching && <p className="inventory-image-picker__status">Searching Unsplash...</p>}
          {!isSearching && error && <p className="form-field__error">{error}</p>}
          {!isSearching && !error && searchedFor && results.length === 0 && (
            <p className="inventory-image-picker__status">No images found for &ldquo;{searchedFor}&rdquo;.</p>
          )}

          {!isSearching && results.length > 0 && (
            <div className="inventory-image-picker__carousel">
              <button
                type="button"
                className="inventory-image-picker__nav"
                aria-label="Scroll images left"
                onClick={() => scrollStrip(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="inventory-image-picker__strip" ref={stripRef} role="listbox" aria-label="Image results">
                {results.map((photo) => {
                  const selected = value.imagePhotoId === photo.id;
                  return (
                    <div key={photo.id} className="inventory-image-picker__tile">
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`inventory-image-picker__option${selected ? ' inventory-image-picker__option--selected' : ''}`}
                        onClick={() => select(photo)}
                        title={photo.description ?? undefined}
                      >
                        {photo.thumbUrl && <img src={photo.thumbUrl} alt={photo.description ?? 'Unsplash photo'} loading="lazy" />}
                      </button>
                      {photo.photographerName && (
                        <a
                          className="inventory-image-picker__credit"
                          href={`${photo.photographerUrl ?? 'https://unsplash.com'}${UNSPLASH_REFERRAL}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {photo.photographerName}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="inventory-image-picker__nav"
                aria-label="Scroll images right"
                onClick={() => scrollStrip(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          <p className="inventory-image-picker__attribution">
            Photos from{' '}
            <a href={`https://unsplash.com/${UNSPLASH_REFERRAL}`} target="_blank" rel="noreferrer">
              Unsplash
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

export default InventoryImagePicker;
