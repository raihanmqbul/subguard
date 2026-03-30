import { describe, it, expect, beforeEach } from 'vitest';
import {
  addSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscription,
  getAllSubscriptions,
  SCHEMA_VERSION,
  db,
} from '../shared/db';
import type { Subscription } from '../shared/types';

beforeEach(async () => {
  // Clear all subscriptions between tests using the shared singleton
  await db.subscriptions.clear();
});

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: crypto.randomUUID(),
    service: 'Netflix',
    cost: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    renewalDate: '2099-01-01',
    status: 'active',
    category: 'streaming',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });
});

describe('addSubscription / getSubscription', () => {
  it('adds and retrieves a subscription by id', async () => {
    const sub = makeSub();
    await addSubscription(sub);
    const result = await getSubscription(sub.id);
    expect(result).toEqual(sub);
  });

  it('returns undefined for a non-existent id', async () => {
    const result = await getSubscription('does-not-exist');
    expect(result).toBeUndefined();
  });
});

describe('getAllSubscriptions', () => {
  it('returns empty array when no subscriptions exist', async () => {
    const all = await getAllSubscriptions();
    expect(all).toEqual([]);
  });

  it('returns all added subscriptions', async () => {
    const a = makeSub({ id: 'a', service: 'Netflix' });
    const b = makeSub({ id: 'b', service: 'Spotify' });
    await addSubscription(a);
    await addSubscription(b);
    const all = await getAllSubscriptions();
    expect(all).toHaveLength(2);
  });
});

describe('updateSubscription', () => {
  it('updates specified fields', async () => {
    const sub = makeSub();
    await addSubscription(sub);
    await updateSubscription(sub.id, { cost: 19.99 });
    const updated = await getSubscription(sub.id);
    expect(updated?.cost).toBe(19.99);
  });

  it('does not affect other fields', async () => {
    const sub = makeSub();
    await addSubscription(sub);
    await updateSubscription(sub.id, { cost: 20 });
    const updated = await getSubscription(sub.id);
    expect(updated?.service).toBe(sub.service);
    expect(updated?.currency).toBe(sub.currency);
  });
});

describe('deleteSubscription', () => {
  it('removes the subscription', async () => {
    const sub = makeSub();
    await addSubscription(sub);
    await deleteSubscription(sub.id);
    expect(await getSubscription(sub.id)).toBeUndefined();
  });

  it('does not throw when deleting a non-existent id', async () => {
    await expect(deleteSubscription('ghost-id')).resolves.not.toThrow();
  });
});
