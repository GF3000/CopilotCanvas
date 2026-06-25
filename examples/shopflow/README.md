# ShopFlow — example project for Canvas for Copilot

A small but realistic **order-management service** (TypeScript) that exists purely to
**exercise the Canvas for Copilot diagram tools**. It is intentionally structured so
that every diagram type, the dependency *scope* option, the drill-down (Expand/Back),
and the code-link features all have meaningful material to render.

> This project is **not** part of the monorepo build/lint/test (it's outside the npm
> workspaces and ignored by ESLint). It's reference material to point Copilot at.
> Optional: `cd examples/shopflow && npm install && npm run typecheck`.

👉 **See [`TEST_PROMPTS.md`](./TEST_PROMPTS.md) for copy-paste prompts** that test each
feature, with what to expect on the canvas.

## What it does

A customer fills a cart and checks out; the service reserves stock, charges a payment
gateway, creates an order, advances the order through its lifecycle, and emails a
receipt.

## Architecture (layers → packages)

```
api ──▶ services ──▶ data ──▶ domain
              └────▶ payments ──▶ domain
                     data ──────▶ domain
```

| Layer (`src/…`) | Responsibility | Key files |
|-----------------|----------------|-----------|
| `api` | HTTP entrypoint + routes (composition root) | `api/server.ts` (`bootstrap`), `api/routes/orders.ts`, `api/routes/products.ts` |
| `services` | Business logic / orchestration | `checkout-service.ts`, `order-service.ts`, `catalog-service.ts`, `notification-service.ts` |
| `payments` | Payment gateway strategy | `payment-gateway.ts` (interface), `stripe-gateway.ts`, `paypal-gateway.ts` |
| `data` | Repositories over an in-memory DB | `base-repository.ts`, `order-repository.ts`, `product-repository.ts`, `customer-repository.ts`, `db.ts` |
| `domain` | Entities + value objects + state machine | `order.ts`, `product.ts`, `customer.ts`, `payment.ts`, `money.ts` |

## Ground truth for the diagrams

These are the relationships the diagram tools should reproduce — handy for checking
the generated diagrams are correct.

### Dependency graph (package scope)
`api → services`, `services → data`, `services → payments`, `services → domain`,
`payments → domain`, `data → domain`. (Acyclic at the package level.)

### Checkout call graph (function scope)
`CheckoutService.checkout()` →
`validate()`, `CatalogService.reserve()` → `Product.reserve()`,
`OrderService.createOrder()` / `addItem()` / `transition()`,
`Order.total()`, `PaymentGateway.charge()` → `PaymentMethod.authorize()`,
`NotificationService.sendReceipt()`.

### Checkout flowchart
`start → validate cart →` **(empty? → fail/end)** `→ reserve stock →`
**(in stock? → fail/end)** `→ charge payment →` **(approved? → fail/end)**
`→ create & place order → send receipt → end`.

### Order state machine (`domain/order.ts`)
States: `cart` (initial), `pending`, `paid`, `shipped`, `delivered` (final),
`cancelled` (final), `refunded` (final).
Transitions (event): `cart --place--> pending`, `pending --pay--> paid`,
`pending --cancel--> cancelled`, `paid --ship--> shipped`, `paid --refund--> refunded`,
`shipped --deliver--> delivered`.

### Class model (UML)
- `PaymentMethod` (interface) ◁┄ `CreditCardPayment`, `PayPalPayment` (**realization**).
- `PaymentGateway` (interface) ◁┄ `StripeGateway`, `PayPalGateway` (**realization**).
- `BaseRepository<T>` (abstract) ◁— `OrderRepository`, `ProductRepository`,
  `CustomerRepository` (**inheritance**).
- `Order` ◆— `OrderLine` (**composition** — lines belong to the order).
- `Order` ◇— `Customer` (**aggregation** — references a customer by id).
- `OrderLine` —▶ `Product` (**association**).
- `CheckoutService` ┄▶ `PaymentGateway` (**dependency** — uses the interface).

### Data model (ER)
- `Customer` **1:N** `Order`
- `Order` **1:N** `OrderLine`
- `Product` **1:N** `OrderLine`  (so `Order` **M:N** `Product` through `OrderLine`)
- `Category` **1:N** `Product`
- `Order` **1:1** `Payment`

## Layout

```
examples/shopflow/
├── README.md          ← you are here (architecture + ground truth)
├── TEST_PROMPTS.md    ← copy-paste prompts to test every feature
├── package.json       ← standalone (not a workspace)
├── tsconfig.json
└── src/
    ├── api/            server.ts (entrypoint), routes/{orders,products}.ts
    ├── services/       checkout / order / catalog / notification
    ├── payments/       payment-gateway (interface) + stripe / paypal
    ├── data/           base-repository + per-entity repos + db
    └── domain/         order (state machine) / product / customer / payment / money
```
