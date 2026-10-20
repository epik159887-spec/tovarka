import type { ErrorRequestHandler } from 'express';
import { ZodError } from '@tovarka/shared';
import { MulterError } from 'multer';
import { AppError } from '../utils/errors.js';
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  if (error instanceof MulterError) {
    res
      .status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Оберіть одне фото PNG, JPEG або WebP до 5 МБ',
        },
      });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Перевірте введені дані',
        fields: error.flatten().fieldErrors,
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Некоректний формат запиту' },
    });
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    res.status(413).json({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Запит надто великий' },
    });
    return;
  }
  console.error('Request failed', {
    type: error instanceof Error ? error.name : 'UnknownError',
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Не вдалося виконати запит. Спробуйте пізніше.',
    },
  });
};
