import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { startNotificationWorker } from './services/notification.service.js';
await prisma.$connect();
const stopWorker = startNotificationWorker();
const server = app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`API listening on port ${env.PORT}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stopWorker();
    server.close(() => {
      void prisma.$disconnect().then(() => process.exit(0));
    });
  });
}
