// Order service — creates and advances orders. Wraps the order repository and the
// Order aggregate's state machine.
import { Order, OrderEvent, OrderLine } from '../domain/order';
import { Money } from '../domain/money';
import { Product } from '../domain/product';
import { OrderRepository } from '../data/order-repository';

let counter = 0;

export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  createOrder(customerId: string): Order {
    const order = new Order(`order-${++counter}`, customerId);
    this.orders.save(order);
    return order;
  }

  addItem(order: Order, product: Product, quantity: number): void {
    const price: Money = product.price;
    order.addLine(new OrderLine(product, quantity, price));
    this.orders.save(order);
  }

  /** Drive the order's state machine and persist the new state. */
  transition(order: Order, event: OrderEvent): void {
    order.apply(event);
    this.orders.save(order);
  }

  getOrder(orderId: string): Order | undefined {
    return this.orders.findById(orderId);
  }

  ordersFor(customerId: string): Order[] {
    return this.orders.findByCustomer(customerId);
  }
}
