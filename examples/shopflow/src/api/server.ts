// Composition root + entrypoint. `bootstrap()` wires the repositories, services,
// gateway and routes together — so this file's imports map the app's top-level
// DEPENDENCY graph (api → services → data/payments → domain).
import { OrderRepository } from '../data/order-repository';
import { ProductRepository } from '../data/product-repository';
import { CustomerRepository } from '../data/customer-repository';
import { CatalogService } from '../services/catalog-service';
import { OrderService } from '../services/order-service';
import { NotificationService } from '../services/notification-service';
import { CheckoutService } from '../services/checkout-service';
import { StripeGateway } from '../payments/stripe-gateway';
import { OrderRoutes } from './routes/orders';
import { ProductRoutes } from './routes/products';

export interface App {
  orderRoutes: OrderRoutes;
  productRoutes: ProductRoutes;
}

/** Build the object graph and return the HTTP routes. */
export function bootstrap(): App {
  const orderRepo = new OrderRepository();
  const productRepo = new ProductRepository();
  const customerRepo = new CustomerRepository();

  const catalog = new CatalogService(productRepo);
  const orders = new OrderService(orderRepo);
  const notifications = new NotificationService(customerRepo);
  const gateway = new StripeGateway();
  const checkout = new CheckoutService(catalog, orders, notifications, gateway);

  return {
    orderRoutes: new OrderRoutes(checkout, orders),
    productRoutes: new ProductRoutes(catalog),
  };
}
