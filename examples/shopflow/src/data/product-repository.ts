// Product persistence — extends BaseRepository with a category query.
import { BaseRepository } from './base-repository';
import { db } from './db';
import { Product } from '../domain/product';

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super(db, 'products');
  }

  protected idOf(product: Product): string {
    return product.id;
  }

  findByCategory(categoryId: string): Product[] {
    return this.findAll().filter((p) => p.categoryId === categoryId);
  }
}
