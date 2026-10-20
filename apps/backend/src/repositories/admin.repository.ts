import { prisma } from '../config/database.js';
import { Prisma } from '@prisma/client';
import type { AdminOrderQuery, CreateProductInput } from '@tovarka/shared';
const orderSelect = {
  id: true,
  orderNumber: true,
  customerName: true,
  phone: true,
  email: true,
  deliveryMethod: true,
  deliveryAddress: true,
  comment: true,
  status: true,
  total: true,
  createdAt: true,
  notification: { select: { status: true } },
  items: {
    select: {
      id: true,
      productName: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
  },
} satisfies Prisma.OrderSelect;
export const adminRepository = {
  async setPassword(username: string, passwordHash: string) {
    return prisma.$transaction(async (tx) => {
      const admin = await tx.adminUser.upsert({
        where: { username },
        create: { username, passwordHash },
        update: { passwordHash },
      });
      await tx.adminSession.deleteMany({ where: { adminId: admin.id } });
    });
  },
  user: (username: string) =>
    prisma.adminUser.findUnique({ where: { username } }),
  async session(tokenHash: string) {
    return prisma.adminSession.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { admin: { select: { username: true } } },
    });
  },
  async createSession(adminId: string, tokenHash: string, expiresAt: Date) {
    await prisma.adminSession.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return prisma.adminSession.create({
      data: { adminId, tokenHash, expiresAt },
    });
  },
  revokeSession: (tokenHash: string) =>
    prisma.adminSession.deleteMany({ where: { tokenHash } }),
  async stats() {
    const [orders, recentOrders, products, amount] = await prisma.$transaction(
      [
        prisma.order.count(),
        prisma.order.count({
          where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
        }),
        prisma.product.count(),
        prisma.order.aggregate({ _sum: { total: true } }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      orders,
      recentOrders,
      products,
      orderTotal: amount._sum.total?.toFixed(2) ?? '0.00',
    };
  },
  async orders(query: AdminOrderQuery) {
    const where: Prisma.OrderWhereInput = query.search
      ? {
          OR: ['orderNumber', 'customerName', 'phone'].map((field) => ({
            [field]: { contains: query.search, mode: 'insensitive' },
          })),
        }
      : {};
    const [orders, total] = await prisma.$transaction(
      [
        prisma.order.findMany({
          where,
          select: orderSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit,
          skip: (query.page - 1) * query.limit,
        }),
        prisma.order.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      orders,
      total,
      page: query.page,
      pages: Math.ceil(total / query.limit),
    };
  },
  category: (id: string) => prisma.category.findUnique({ where: { id } }),
  createProduct: (input: CreateProductInput, slug: string) =>
    prisma.product.create({
      data: { ...input, slug },
      include: { category: true },
    }),
  createCategory: (name: string, slug: string) =>
    prisma.category.create({ data: { name, slug } }),
};
