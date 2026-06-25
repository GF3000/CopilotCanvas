// Product catalogue entities: a Category groups many Products. Prices are Money.
import { Money } from './money';

export interface Category {
  id: string;
  name: string;
}

export class Product {
  constructor(
    public readonly id: string,
    public readonly categoryId: string,
    public readonly name: string,
    public readonly price: Money,
    public stock: number,
  ) {}

  inStock(quantity: number): boolean {
    return this.stock >= quantity;
  }

  reserve(quantity: number): void {
    if (!this.inStock(quantity)) {
      throw new Error(`Insufficient stock for ${this.name}`);
    }
    this.stock -= quantity;
  }
}
