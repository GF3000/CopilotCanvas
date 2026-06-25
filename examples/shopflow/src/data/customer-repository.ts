// Customer persistence — extends BaseRepository with an email lookup.
import { BaseRepository } from './base-repository';
import { db } from './db';
import { Customer } from '../domain/customer';

export class CustomerRepository extends BaseRepository<Customer> {
  constructor() {
    super(db, 'customers');
  }

  protected idOf(customer: Customer): string {
    return customer.id;
  }

  findByEmail(email: string): Customer | undefined {
    return this.findAll().find((c) => c.email === email);
  }
}
