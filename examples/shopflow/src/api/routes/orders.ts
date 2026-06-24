// Order API routes — thin HTTP handlers over the checkout + order services.
import { CheckoutService, CheckoutRequest } from '../../services/checkout-service';
import { OrderService } from '../../services/order-service';

export class OrderRoutes {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly orders: OrderService,
  ) {}

  /** POST /orders — run a checkout. */
  postCheckout(request: CheckoutRequest): { orderId: string; paymentRef: string } {
    const { order, paymentRef } = this.checkout.checkout(request);
    return { orderId: order.id, paymentRef };
  }

  /** GET /customers/:id/orders — list a customer's orders. */
  getCustomerOrders(customerId: string): string[] {
    return this.orders.ordersFor(customerId).map((o) => o.id);
  }
}
