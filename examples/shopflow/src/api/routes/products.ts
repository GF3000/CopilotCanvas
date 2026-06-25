// Product API routes — thin HTTP handlers over the catalogue service.
import { CatalogService } from '../../services/catalog-service';

export class ProductRoutes {
  constructor(private readonly catalog: CatalogService) {}

  /** GET /products/:id */
  getProduct(productId: string): { id: string; name: string; price: number } {
    const p = this.catalog.getProduct(productId);
    return { id: p.id, name: p.name, price: p.price.amount };
  }

  /** GET /categories/:id/products */
  listByCategory(categoryId: string): string[] {
    return this.catalog.listByCategory(categoryId).map((p) => p.id);
  }
}
