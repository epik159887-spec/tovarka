import { useState, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, ImagePlus, X, Star } from 'lucide-react';
import { maxProductImages, productImageSchema } from '@tovarka/shared';
import { adminApi } from './api';
import { Button, Input } from '../components/ui';
import { getErrorMessage } from '../utils/format';
export function ProductPhotos({
  value,
  onChange,
  onBusyChange,
  disabled,
  error,
}: {
  value: string[];
  onChange: (photos: string[]) => void;
  onBusyChange: (busy: boolean) => void;
  disabled: boolean;
  error?: string;
}) {
  const [url, setUrl] = useState('');
  const [localError, setLocalError] = useState('');
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      onBusyChange(true);
      let next = [...value];
      try {
        for (const file of files) {
          const photo = await adminApi.upload(file);
          next = [...next, photo.imageUrl];
          // Keep successful uploads if a subsequent file fails.
          onChange(next);
        }
      } finally {
        onBusyChange(false);
      }
    },
  });
  const selectFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setLocalError('');
    upload.reset();
    if (!files.length) return;
    if (value.length + files.length > maxProductImages) {
      setLocalError(
        `Дозволено до ${maxProductImages} фото. Зараз додано ${value.length}.`,
      );
      return;
    }
    if (
      files.some(
        (file) =>
          file.size > 5 * 1024 * 1024 ||
          !['image/png', 'image/jpeg', 'image/webp'].includes(file.type),
      )
    ) {
      setLocalError('Оберіть PNG, JPEG або WebP до 5 МБ кожне.');
      return;
    }
    upload.mutate(files);
  };
  const addLink = () => {
    const parsed = productImageSchema.safeParse(url);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Перевірте посилання');
      return;
    }
    if (value.includes(parsed.data)) {
      setLocalError('Це фото вже додано.');
      return;
    }
    if (value.length >= maxProductImages) {
      setLocalError(`Дозволено до ${maxProductImages} фото.`);
      return;
    }
    onChange([...value, parsed.data]);
    setUrl('');
    setLocalError('');
  };
  return (
    <div className="admin-photo-column">
      <label htmlFor="admin-photo" className="admin-photo-upload">
        {value[0] ? (
          <img src={value[0]} alt="Попередній перегляд фото товару" />
        ) : (
          <>
            <ImagePlus size={36} strokeWidth={1.2} />
            <strong>Фото товару</strong>
            <span>До 10 фото · PNG, JPEG або WebP · до 5 МБ кожне</span>
          </>
        )}
        <span className="admin-upload-action">
          <Upload size={16} />
          {upload.isPending ? 'Завантажуємо…' : 'Обрати фото з комп’ютера'}
        </span>
      </label>
      <input
        className="admin-file-input"
        id="admin-photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={disabled || value.length >= maxProductImages}
        onChange={selectFiles}
      />
      {value.length > 0 && (
        <div className="admin-photo-list" aria-label="Фото товару">
          {value.map((photo, index) => (
            <div className="admin-photo-item" key={photo}>
              <img src={photo} alt={`Фото товару ${index + 1}`} />
              <button
                type="button"
                className="admin-photo-remove"
                disabled={disabled}
                aria-label={`Прибрати фото ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <X size={15} />
              </button>
              <button
                type="button"
                className="admin-photo-cover"
                disabled={disabled || index === 0}
                aria-label={`Зробити фото ${index + 1} головним`}
                onClick={() =>
                  onChange([photo, ...value.filter((_, i) => i !== index)])
                }
              >
                <Star size={13} fill={index === 0 ? 'currentColor' : 'none'} />
                {index === 0 ? 'Головне' : 'На обкладинку'}
              </button>
            </div>
          ))}
        </div>
      )}
      <Input
        label="Або посилання на зображення"
        placeholder="https://…"
        value={url}
        maxLength={2000}
        onChange={(event) => setUrl(event.target.value)}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || value.length >= maxProductImages}
        onClick={addLink}
      >
        Додати фото за посиланням
      </Button>
      <p className="muted">
        Додано {value.length} / {maxProductImages}. Перше фото — головне. Решту
        покупці зможуть переглянути в галереї.
      </p>
      {(localError || error || upload.isError) && (
        <p className="form-error" role="alert">
          {localError || error || getErrorMessage(upload.error)}
        </p>
      )}
    </div>
  );
}
