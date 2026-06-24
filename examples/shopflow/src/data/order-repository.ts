// Order persistence — extends BaseRepository and adds an order-specific query.
import { BaseRepository } from './base-repository';
import { db } from './db';
import { Order } from '../domain/order';

export class OrderRepository extends BaseRepository<Order> {
  constructor() {
    super(db, 'orders');
  }

  protected idOf(order: Order): string {
    return order.id;
  }

  findByCustomer(customerId: string): Order[] {
    return this.findAll().filter((o) => o.customerId === customerId);
  }
}
