import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { errorHandler } from './middleware/errors.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key'],
  }),
);
app.use(express.json({ limit: '24kb' }));
app.use('/api', api);
app.use((_req, res) =>
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Сторінку не знайдено' } }),
);
app.use(errorHandler);
