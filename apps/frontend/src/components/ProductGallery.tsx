import { useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Product } from '@tovarka/shared';
import { Modal } from './ui';
export function ProductGallery({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const photos = [...new Set([product.imageUrl, ...(product.imageUrls ?? [])])];
  const [index, setIndex] = useState(0);
  const previous = () =>
    setIndex((current) => (current - 1 + photos.length) % photos.length);
  const next = () => setIndex((current) => (current + 1) % photos.length);
  const keyboard = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).tagName === 'INPUT') return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      previous();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      next();
    }
  };
  return (
    <Modal title={product.name} onClose={onClose}>
      <div className="product-gallery" onKeyDown={keyboard}>
        <div className="product-gallery-stage">
          <img
            src={photos[index]}
            alt={`${product.name} — фото ${index + 1}`}
          />
          {photos.length > 1 && (
            <>
              <button
                className="gallery-arrow gallery-previous"
                aria-label="Попереднє фото"
                onClick={previous}
              >
                <ChevronLeft />
              </button>
              <button
                autoFocus
                className="gallery-arrow gallery-next"
                aria-label="Наступне фото"
                onClick={next}
              >
                <ChevronRight />
              </button>
            </>
          )}
        </div>
        <p className="muted" aria-live="polite">
          Фото {index + 1} із {photos.length}
        </p>
        {photos.length > 1 && (
          <div
            className="product-gallery-thumbnails"
            aria-label="Мініатюри фото"
          >
            {photos.map((photo, position) => (
              <button
                key={photo}
                onClick={() => setIndex(position)}
                aria-label={`Переглянути фото ${position + 1}`}
                aria-pressed={index === position}
              >
                <img src={photo} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
