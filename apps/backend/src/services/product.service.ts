import { productRepository } from '../repositories/product.repository.js';
import { AppError } from '../utils/errors.js';
export const productService = {
  list: productRepository.list,
  categories: productRepository.categories,
  async find(id: string) {
    const product = await productRepository.find(id);
    if (!product)
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Товар не знайдено');
    return product;
  },
};
