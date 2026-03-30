import Dexie, { type Table } from 'dexie';
import type { Subscription } from './types';
import { SCHEMA_VERSION } from './constants';

export { SCHEMA_VERSION };

export class SubGuardDB extends Dexie {
  subscriptions!: Table<Subscription, string>;

  constructor() {
    super('SubGuardDB');

    // Version history must be kept in full for users upgrading from any prior version.
    // Each new version adds a .upgrade() callback for migrations.
    this.version(1).stores({
      subscriptions: 'id, service, status, renewalDate, category, createdAt',
    });

    // Catch migration errors and re-throw with context (Req 16.5)
    this.on('versionchange', () => {
      console.warn('[SubGuard] Database version change detected — closing connection.');
      this.close();
    });
  }
}

// Singleton instance
export const db = new SubGuardDB();

// ─── Wrapped write helpers (all writes use transactions) ─────────────────────

export async function addSubscription(subscription: Subscription): Promise<string> {
  try {
    return await db.transaction('rw', db.subscriptions, async () => {
      return await db.subscriptions.add(subscription);
    });
  } catch (err) {
    throw new Error(`[SubGuard] Failed to add subscription "${subscription.service}": ${String(err)}`);
  }
}

export async function updateSubscription(id: string, changes: Partial<Subscription>): Promise<void> {
  try {
    await db.transaction('rw', db.subscriptions, async () => {
      await db.subscriptions.update(id, { ...changes, updatedAt: new Date().toISOString() });
    });
  } catch (err) {
    throw new Error(`[SubGuard] Failed to update subscription "${id}": ${String(err)}`);
  }
}

export async function deleteSubscription(id: string): Promise<void> {
  try {
    await db.transaction('rw', db.subscriptions, async () => {
      await db.subscriptions.delete(id);
    });
  } catch (err) {
    throw new Error(`[SubGuard] Failed to delete subscription "${id}": ${String(err)}`);
  }
}

export async function getSubscription(id: string): Promise<Subscription | undefined> {
  return db.subscriptions.get(id);
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  return db.subscriptions.toArray();
}
