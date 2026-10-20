import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';
export const uploadDirectory = resolve(env.UPLOAD_DIR ?? '.data/uploads');
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
}).single('image');
export async function saveProductImage(file: Express.Multer.File | undefined) {
  if (!file) throw new AppError(400, 'IMAGE_REQUIRED', 'Оберіть фото товару');
  const data = file.buffer;
  const extension =
    data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? 'png'
      : data.length >= 4 &&
          data[0] === 255 &&
          data[1] === 216 &&
          data[2] === 255 &&
          data.at(-2) === 255 &&
          data.at(-1) === 217
        ? 'jpg'
        : data.length >= 12 &&
            data.toString('ascii', 0, 4) === 'RIFF' &&
            data.toString('ascii', 8, 12) === 'WEBP'
          ? 'webp'
          : null;
  if (!extension)
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'Дозволені лише фото PNG, JPEG або WebP до 5 МБ',
    );
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(resolve(uploadDirectory, filename), data, { flag: 'wx' });
  return { imageUrl: `/uploads/${filename}` };
}
