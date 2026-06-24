// Order aggregate. An Order is COMPOSED of OrderLines (they live and die with it)
// and references a Customer. Its lifecycle is a finite state machine:
//
//        place        pay         ship        deliver
//   cart ─────▶ pending ─────▶ paid ─────▶ shipped ─────▶ delivered (final)
//                 │              │
//          cancel │       refund │
//                 ▼              ▼
//            cancelled       refunded   (both final)
//
// `cart` is the initial state; `delivered`, `cancelled` and `refunded` are final.
import { Money } from './money';
import { Product } from './product';

export type OrderStatus =
  | 'cart'
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type OrderEvent =
  | 'place'
  | 'pay'
  | 'ship'
  | 'deliver'
  | 'cancel'
  | 'refund';

/** Allowed transitions: from-state → event → to-state. */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  cart: { place: 'pending' },
  pending: { pay: 'paid', cancel: 'cancelled' },
  paid: { ship: 'shipped', refund: 'refunded' },
  shipped: { deliver: 'delivered' },
  delivered: {},
  cancelled: {},
  refunded: {},
};

export const INITIAL_STATUS: OrderStatus = 'cart';
export const FINAL_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

/** Apply an event to a status, returning the next status or throwing if illegal. */
export function nextStatus(status: OrderStatus, event: OrderEvent): OrderStatus {
  const to = TRANSITIONS[status][event];
  if (!to) {
    throw new Error(`Illegal transition: ${status} cannot ${event}`);
  }
  return to;
}

/** A single line of an order: a product, a quantity, and the unit price snapshot. */
export class OrderLine {
  constructor(
    public readonly product: Product,
    public readonly quantity: number,
    public readonly unitPrice: Money,
  ) {}

  get subtotal(): Money {
    return this.unitPrice.times(this.quantity);
  }
}

export class Order {
  status: OrderStatus = INITIAL_STATUS;
  private readonly lines: OrderLine[] = [];

  constructor(
    public readonly id: string,
    public readonly customerId: string,
  ) {}

  addLine(line: OrderLine): void {
    this.lines.push(line);
  }

  get items(): readonly OrderLine[] {
    return this.lines;
  }

  total(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.subtotal), Money.zero());
  }

  /** Drive the state machine; throws on an illegal transition. */
  apply(event: OrderEvent): void {
    this.status = nextStatus(this.status, event);
  }

  isFinal(): boolean {
    return FINAL_STATUSES.includes(this.status);
  }
}
