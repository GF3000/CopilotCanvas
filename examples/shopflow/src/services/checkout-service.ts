// Checkout service — orchestrates the whole purchase. Its `checkout` method is the
// canonical FLOWCHART for this app and the root of the checkout CALL GRAPH:
//
//   checkout()
//     ├─ validate cart           (decision: empty? → fail)
//     ├─ catalog.reserve()       (decision: in stock? → fail)  [per line]
//     ├─ order.total()
//     ├─ gateway.charge()        (decision: paid? → fail)
//     ├─ orderService.createOrder() + addItem() + transition('place'/'pay')
//     └─ notifications.sendReceipt()
//
// It depends on the CatalogService, OrderService, NotificationService and the
// PaymentGateway interface (not a concrete gateway).
import { Money } from '../domain/money';
import { PaymentMethod } from '../domain/payment';
import { Order } from '../domain/order';
import { PaymentGateway } from '../payments/payment-gateway';
import { CatalogService } from './catalog-service';
import { OrderService } from './order-service';
import { NotificationService } from './notification-service';

export interface CartItem {
  productId: string;
  quantity: number;
}

export interface CheckoutRequest {
  customerId: string;
  items: CartItem[];
  method: PaymentMethod;
}

export interface CheckoutResult {
  order: Order;
  paymentRef: string;
}

export class CheckoutService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly orders: OrderService,
    private readonly notifications: NotificationService,
    private readonly gateway: PaymentGateway,
  ) {}

  /** The end-to-end checkout flow (see the flowchart in the header comment). */
  checkout(request: CheckoutRequest): CheckoutResult {
    this.validate(request);

    const order = this.orders.createOrder(request.customerId);
    for (const item of request.items) {
      // Reserve stock first; this throws if the product is out of stock.
      const product = this.catalog.reserve(item.productId, item.quantity);
      this.orders.addItem(order, product, item.quantity);
    }
    this.orders.transition(order, 'place');

    const amount: Money = order.total();
    const result = this.gateway.charge(request.method, amount);
    if (!result.ok) {
      throw new Error('Payment failed');
    }
    this.orders.transition(order, 'pay');

    this.notifications.sendReceipt(order);
    return { order, paymentRef: result.reference };
  }

  private validate(request: CheckoutRequest): void {
    if (request.items.length === 0) {
      throw new Error('Cart is empty');
    }
  }
}
