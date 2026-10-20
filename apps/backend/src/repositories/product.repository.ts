import { prisma } from '../config/database.js';
import type { ProductQuery } from '@tovarka/shared';
import type { Prisma } from '@prisma/client';
export const productRepository = {
  async list(query: ProductQuery) {
    const where: Prisma.ProductWhereInput = {
      active: true,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === 'price-asc'
        ? [{ price: 'asc' }, { id: 'asc' }]
        : query.sort === 'price-desc'
          ? [{ price: 'desc' }, { id: 'asc' }]
          : query.sort === 'name'
            ? [{ name: 'asc' }, { id: 'asc' }]
            : [{ createdAt: 'desc' }, { id: 'asc' }];
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
    ]);
    return {
      products,
      total,
      page: query.page,
      pages: Math.ceil(total / query.limit),
    };
  },
  find: (id: string) =>
    prisma.product.findFirst({
      where: { id, active: true },
      include: { category: true },
    }),
  categories: () => prisma.category.findMany({ orderBy: { name: 'asc' } }),
};
