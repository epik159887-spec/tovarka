import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { adminApi } from './routes/admin.js';
import { uploadDirectory } from './services/upload.service.js';
import { api } from './routes/api.js';
import { errorHandler } from './middleware/errors.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Admin-Request'],
  }),
);
app.use(express.json({ limit: '24kb' }));
app.use(
  '/uploads',
  express.static(uploadDirectory, {
    index: false,
    dotfiles: 'deny',
    maxAge: '7d',
  }),
);
app.use('/api/admin', adminApi);
app.use('/api', api);
app.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Сторінку не знайдено' } }),
);
app.use(errorHandler);
