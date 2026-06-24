// Catalogue service — product lookups and stock reservation. Sits between the API
// and the product repository.
import { Product } from '../domain/product';
import { ProductRepository } from '../data/product-repository';

export class CatalogService {
  constructor(private readonly products: ProductRepository) {}

  getProduct(productId: string): Product {
    const product = this.products.findById(productId);
    if (!product) throw new Error(`No such product: ${productId}`);
    return product;
  }

  listByCategory(categoryId: string): Product[] {
    return this.products.findByCategory(categoryId);
  }

  /** Reserve stock for a product; persists the decremented stock. */
  reserve(productId: string, quantity: number): Product {
    const product = this.getProduct(productId);
    product.reserve(quantity);
    this.products.save(product);
    return product;
  }
}
