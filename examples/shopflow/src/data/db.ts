// A trivial in-memory store standing in for a database. The repositories depend on
// this; nothing in the domain layer does.

export class InMemoryDb {
  private readonly tables = new Map<string, Map<string, unknown>>();

  table<T>(name: string): Map<string, T> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t as Map<string, T>;
  }
}

/** The single shared database instance for the app. */
export const db = new InMemoryDb();
