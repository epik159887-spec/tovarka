import '../src/config/env.js';
import { prisma as db } from '../src/config/database.js';
const categories = [
  {
    slug: 'ceramics',
    name: 'Кераміка',
    description: 'Фактура, яку хочеться відчувати',
  },
  { slug: 'textiles', name: 'Текстиль', description: 'М’які акценти для дому' },
  {
    slug: 'details',
    name: 'Деталі затишку',
    description: 'Маленькі щоденні радощі',
  },
];
const products = [
  {
    slug: 'morning-cup',
    name: 'Горнятко «Теплий ранок»',
    description:
      'Керамічне горнятко теракотового відтінку. Для кави, чаю та кількох хвилин для себе. Об’єм 350 мл.',
    price: '480.00',
    imageUrl: '/images/cup.svg',
    stock: 24,
    category: 'ceramics',
  },
  {
    slug: 'quiet-vase',
    name: 'Ваза «Тиха форма»',
    description:
      'Лаконічна керамічна ваза пісочного кольору. Гарна з сухоцвітами й сама по собі. Висота 22 см.',
    price: '890.00',
    imageUrl: '/images/vase.svg',
    stock: 12,
    category: 'ceramics',
  },
  {
    slug: 'forest-candle',
    name: 'Свічка «Лісова тиша»',
    description:
      'Соєва свічка в зеленому склі з деревним ароматом. Тепле світло для неквапливого вечора. 180 г.',
    price: '620.00',
    imageUrl: '/images/candle.svg',
    stock: 18,
    category: 'details',
  },
  {
    slug: 'everyday-bag',
    name: 'Шопер «Щодня»',
    description:
      'Місткий бавовняний шопер із рослинним мотивом. Для покупок, книжок і прогулянок. 38 × 42 см.',
    price: '390.00',
    imageUrl: '/images/bag.svg',
    stock: 30,
    category: 'textiles',
  },
  {
    slug: 'sand-plate',
    name: 'Тарілка «Пісок»',
    description:
      'Керамічна тарілка з м’яким матовим відтінком. Прості сніданки стають трохи особливішими. Діаметр 24 см.',
    price: '540.00',
    imageUrl: '/images/plate.svg',
    stock: 16,
    category: 'ceramics',
  },
  {
    slug: 'home-blanket',
    name: 'Плед «Обійми дому»',
    description:
      'Фактурний бавовняний плед у природних відтінках. Для дивана, улюбленого крісла й прохолодних вечорів. 140 × 200 см.',
    price: '1490.00',
    imageUrl: '/images/blanket.svg',
    stock: 0,
    category: 'textiles',
  },
];
try {
  for (const item of categories)
    await db.category.upsert({
      where: { slug: item.slug },
      create: item,
      update: { name: item.name, description: item.description },
    });
  for (const { category, ...product } of products) {
    const parent = await db.category.findUniqueOrThrow({
      where: { slug: category },
    });
    // Re-seeding never replenishes stock consumed by real orders.
    await db.product.upsert({
      where: { slug: product.slug },
      create: { ...product, categoryId: parent.id },
      update: {},
    });
  }
  console.log('Seeded 3 categories and 6 demonstration products.');
} finally {
  await db.$disconnect();
}
