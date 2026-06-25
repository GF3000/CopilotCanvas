// Payment methods — the Strategy pattern. PaymentMethod is the interface; concrete
// methods (credit card, PayPal) realize it. Each authorizes a Money amount.
import { Money } from './money';

export interface PaymentMethod {
  /** A short label for receipts, e.g. "Visa ****4242". */
  readonly label: string;
  /** Authorize a charge; returns an authorization token. */
  authorize(amount: Money): string;
}

export class CreditCardPayment implements PaymentMethod {
  constructor(
    private readonly cardNumber: string,
    private readonly expiry: string,
  ) {}

  get label(): string {
    return `Card ****${this.cardNumber.slice(-4)}`;
  }

  authorize(amount: Money): string {
    return `cc-auth-${amount.cents}-${this.expiry}`;
  }
}

export class PayPalPayment implements PaymentMethod {
  constructor(private readonly account: string) {}

  get label(): string {
    return `PayPal ${this.account}`;
  }

  authorize(amount: Money): string {
    return `pp-auth-${amount.cents}-${this.account}`;
  }
}
