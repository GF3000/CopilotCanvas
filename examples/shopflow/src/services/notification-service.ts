// Notification service — sends transactional messages (e.g. order receipts).
import { Order } from '../domain/order';
import { CustomerRepository } from '../data/customer-repository';

export class NotificationService {
  constructor(private readonly customers: CustomerRepository) {}

  sendReceipt(order: Order): void {
    const customer = this.customers.findById(order.customerId);
    if (!customer) return;
    // A real implementation would send an email; here we just log.
    console.log(
      `Receipt for order ${order.id} (${order.total().amount}) -> ${customer.email}`,
    );
  }
}
