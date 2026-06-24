// PayPal gateway — realizes PaymentGateway.
import { Money } from '../domain/money';
import { PaymentMethod } from '../domain/payment';
import { PaymentGateway, PaymentResult } from './payment-gateway';

export class PayPalGateway implements PaymentGateway {
  readonly name = 'paypal';

  charge(method: PaymentMethod, amount: Money): PaymentResult {
    const token = method.authorize(amount);
    return { ok: true, reference: `paypal_${token}` };
  }
}
