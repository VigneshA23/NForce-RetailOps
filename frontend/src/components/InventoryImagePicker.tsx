import { useRef, useState, type ChangeEvent } from 'react';
import { ChevronDown, ImageOff, Search, Upload } from 'lucide-react';
import { searchInventoryImages } from '../api/inventoryImages';
import { useInventoryImageUrl } from '../hooks/useInventoryImageUrl';
import type { UnsplashPhoto } from '../types/inventoryImage';
import './InventoryImagePicker.css';

export interface InventoryImageSelection {
  // The item's stored image (edit mode), shown until replaced or removed.
  imageId: number | null;
  // A newly picked Unsplash photo, downloaded server-side on save.
  imagePhotoId: string | null;
  // The user's own uploaded photo as a base64 data URL, stored on save.
  imageUploadData?: string | null;
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

// Dropdown under the item form's name field: searches Unsplash for the
// inventory name (10 results) and shows them in a vertically scrolling
// grid of portrait tiles. Picking one only records its id -- the
// backend downloads and stores the photo when the item is saved.
const MAX_UPLOAD_EDGE = 900;
const MAX_UPLOAD_SOURCE_BYTES = 15 * 1024 * 1024;

// Downscales the chosen file and re-encodes it as JPEG, so uploads stay small
// regardless of what the camera or the file produced.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not process this image.'));
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = objectUrl;
  });
}

function InventoryImagePicker({ id, itemName, value, onChange }: InventoryImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
      stripRef.current?.scrollTo({ top: 0 });
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

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_UPLOAD_SOURCE_BYTES) {
      setUploadError('Image must be 15 MB or smaller.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange({ ...value, imagePhotoId: null, imageUploadData: dataUrl, imagePreviewUrl: dataUrl, removeImage: false });
      setIsOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
  }

  function select(photo: UnsplashPhoto) {
    onChange({ ...value, imagePhotoId: photo.id, imageUploadData: null, imagePreviewUrl: photo.thumbUrl, removeImage: false });
    setIsOpen(false);
  }

  function remove() {
    onChange({ ...value, imagePhotoId: null, imageUploadData: null, imagePreviewUrl: null, removeImage: value.imageId != null });
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
        <button type="button" className="btn btn--secondary inventory-image-picker__trigger" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          Upload photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          aria-label="Upload your own photo"
          onChange={(event) => void handleFile(event)}
        />
        {previewUrl && (
          <button type="button" className="inventory-image-picker__remove" onClick={remove}>
            Remove
          </button>
        )}
      </div>

      {uploadError && <p className="form-field__error">{uploadError}</p>}

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
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InventoryImagePicker;
