import type { Journal } from './journal.js';

/**
 * Transitional storage port. The legacy SQLite implementation is synchronous;
 * the SurrealDB implementation is asynchronous. Callers must await every method.
 * SQLite remains available for migration and legacy tests, not a DB fallback.
 */
export type JournalStore = {
  [K in Exclude<keyof Journal, 'db'>]: Journal[K] extends (...args: infer A) => infer R
    ? (...args: A) => R | Promise<R> : never;
};
