// Generic repository base class. Concrete repositories (orders, products,
// customers) INHERIT from this and specialise the table name + id accessor.
import { InMemoryDb } from './db';

export abstract class BaseRepository<T> {
  protected constructor(
    private readonly database: InMemoryDb,
    private readonly tableName: string,
  ) {}

  /** How to read an entity's id — each subclass knows its own entity shape. */
  protected abstract idOf(entity: T): string;

  findById(id: string): T | undefined {
    return this.database.table<T>(this.tableName).get(id);
  }

  findAll(): T[] {
    return [...this.database.table<T>(this.tableName).values()];
  }

  save(entity: T): void {
    this.database.table<T>(this.tableName).set(this.idOf(entity), entity);
  }

  delete(id: string): void {
    this.database.table<T>(this.tableName).delete(id);
  }
}
