import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usageTrend, stockStatus, categoryActivity } from './inventory.mjs';

test('compares equal periods for one product across a month boundary', () => {
  const trend = usageTrend([
    { product_id: 1, taken_date: '2026-10-28', quantity: 8 },
    { product_id: 1, taken_date: '2026-11-04', quantity: 10 },
    { product_id: 2, taken_date: '2026-11-04', quantity: 99 },
  ], 1, '2026-11-04');
  assert.equal(trend.points.length, 7);
  assert.deepEqual([trend.previous, trend.current, trend.rising], [8, 10, true]);
});

test('unrecorded counts and zero counts have distinct statuses', () => {
  assert.equal(stockStatus({ stock: null, minimum: 5 }), 'Belum dihitung');
  assert.equal(stockStatus({ stock: 0, minimum: 5 }), 'Habis');
});

test('category activity counts transactions within the period without adding mixed units', () => {
  const products = [{ id: 1, category: 'Bumbu' }, { id: 2, category: 'Bumbu' }];
  const receipt = { product_id: 1, taken_date: '2026-11-03', quantity: 40 };
  const withdrawals = [
    { ...receipt, product_id: 2 },
    { ...receipt, taken_date: '2026-11-01' },
    { ...receipt, product_id: 3 },
  ];
  assert.deepEqual(categoryActivity(products, [receipt], withdrawals, '2026-11-02', '2026-11-03'), [
    { category: 'Bumbu', products: 2, incoming: 1, outgoing: 1 },
  ]);
});
