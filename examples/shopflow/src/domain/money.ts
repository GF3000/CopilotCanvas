// Money value object — an immutable amount in minor units (cents) with a currency.
// Shared by Product, OrderLine, Order and the payment gateways.

export class Money {
  private constructor(
    public readonly cents: number,
    public readonly currency: string,
  ) {}

  static of(amount: number, currency = 'USD'): Money {
    return new Money(Math.round(amount * 100), currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  times(quantity: number): Money {
    return new Money(this.cents * quantity, this.currency);
  }

  get amount(): number {
    return this.cents / 100;
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
