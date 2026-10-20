import { prisma } from '../config/database.js';
import type { DeliveryOutcome } from '../services/telegram.service.js';
export const notificationRepository = {
  async claim() {
    await prisma.notification.updateMany({
      where: {
        status: 'PROCESSING',
        lockedAt: { lt: new Date(Date.now() - 120000) },
      },
      data: { status: 'UNKNOWN' },
    });
    const candidate = await prisma.notification.findFirst({
      where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
    });
    if (!candidate) return null;
    const result = await prisma.notification.updateMany({
      where: { id: candidate.id, status: 'PENDING' },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!result.count) return null;
    return prisma.notification.findUnique({
      where: { id: candidate.id },
      include: { order: { include: { items: true } } },
    });
  },
  finish(
    id: string,
    attempts: number,
    outcome: DeliveryOutcome,
    hasMore: boolean,
  ) {
    return prisma.notification.update({
      where: { id },
      data: {
        status:
          outcome.status === 'SENT' && hasMore
            ? 'PENDING'
            : outcome.status === 'RETRY'
              ? attempts < 5
                ? 'PENDING'
                : 'FAILED'
              : outcome.status,
        nextAttemptAt: new Date(
          Date.now() +
            (outcome.status === 'SENT' ? 0 : (outcome.delay ?? 300000)),
        ),
        ...(outcome.status === 'SENT'
          ? { nextPart: { increment: 1 }, attempts: 0 }
          : {}),
        sentAt: outcome.status === 'SENT' && !hasMore ? new Date() : null,
        lockedAt: null,
      },
    });
  },
};
