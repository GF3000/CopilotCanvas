// Payment gateway abstraction — a second Strategy interface, realized by the
// Stripe and PayPal gateways. CheckoutService depends on this interface, not on a
// concrete gateway (dependency inversion).
import { Money } from '../domain/money';
import { PaymentMethod } from '../domain/payment';

export interface PaymentResult {
  ok: boolean;
  reference: string;
}

export interface PaymentGateway {
  readonly name: string;
  charge(method: PaymentMethod, amount: Money): PaymentResult;
}
