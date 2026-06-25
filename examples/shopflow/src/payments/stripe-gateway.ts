// Stripe gateway — realizes PaymentGateway.
import { Money } from '../domain/money';
import { PaymentMethod } from '../domain/payment';
import { PaymentGateway, PaymentResult } from './payment-gateway';

export class StripeGateway implements PaymentGateway {
  readonly name = 'stripe';

  charge(method: PaymentMethod, amount: Money): PaymentResult {
    const token = method.authorize(amount);
    return { ok: true, reference: `stripe_${token}` };
  }
}
