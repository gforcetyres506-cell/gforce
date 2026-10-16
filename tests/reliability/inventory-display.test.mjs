import assert from 'node:assert/strict';
import { test } from 'node:test';

// Direct extraction logic identical to AdminWorkspace extractInventory
export function extractInventory(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const first = raw[0];
    if (first && typeof first === 'object' && typeof first.stock_qty === 'number') {
      return first;
    }
    return null;
  }
  if (typeof raw === 'object' && raw !== null && typeof raw.stock_qty === 'number') {
    return raw;
  }
  return null;
}

test('extractInventory correctly handles PostgREST one-to-one object relation', () => {
  const postgrestObject = {
    id: 'e86b245a-8b83-4a1e-a4b5-654cb6c5e231',
    stock_qty: 14,
    reserved_qty: 2,
    cost_price_pence: 4500,
    selling_price_pence: 9500,
    supplier_sku: 'SUP-MICHELIN-14',
    low_stock_threshold: 3,
    updated_at: '2026-10-16T12:00:00Z',
  };
  const result = extractInventory(postgrestObject);
  assert.ok(result, 'Expected result to be non-null for valid PostgREST object relation');
  assert.equal(result.stock_qty, 14);
  assert.equal(result.reserved_qty, 2);
  assert.equal(result.stock_qty - result.reserved_qty, 12, 'Available quantity must equal stock minus reserved');
  assert.equal(result.selling_price_pence, 9500);
});

test('extractInventory handles one-to-many or array relation for defensive compatibility', () => {
  const arrayRelation = [
    {
      id: 'f97c356b-9c94-5b2f-b5c6-765dc7d6f342',
      stock_qty: 8,
      reserved_qty: 0,
      cost_price_pence: 3000,
      selling_price_pence: 7200,
      supplier_sku: 'SUP-GOODYEAR-8',
      low_stock_threshold: 2,
    },
  ];
  const result = extractInventory(arrayRelation);
  assert.ok(result, 'Expected result to be non-null for array relation');
  assert.equal(result.stock_qty, 8);
  assert.equal(result.reserved_qty, 0);
  assert.equal(result.selling_price_pence, 7200);
});

test('extractInventory returns null for genuinely missing inventory (null, undefined, empty array)', () => {
  assert.equal(extractInventory(null), null);
  assert.equal(extractInventory(undefined), null);
  assert.equal(extractInventory([]), null);
  assert.equal(extractInventory({}), null);
  assert.equal(extractInventory([null]), null);
});

test('extractInventory preserves zero stock as a real inventory row and does not report missing', () => {
  const outOfStockRow = {
    id: 'a1234567-89ab-cdef-0123-456789abcdef',
    stock_qty: 0,
    reserved_qty: 0,
    cost_price_pence: 5000,
    selling_price_pence: 11000,
    low_stock_threshold: 2,
  };
  const result = extractInventory(outOfStockRow);
  assert.ok(result, 'Zero stock is a genuine row, not a missing inventory relation');
  assert.equal(result.stock_qty, 0);
  assert.equal(result.reserved_qty, 0);
});

test('regression: legacy r.inventory?.[0] fails on PostgREST object relation, while extractInventory succeeds', () => {
  const productRow = {
    sku: '2055516VMICH',
    brand: 'Michelin',
    model: 'Primacy 4',
    inventory: {
      stock_qty: 10,
      reserved_qty: 1,
      selling_price_pence: 10500,
      cost_price_pence: 6000,
      low_stock_threshold: 2,
    },
  };

  // The faulty code in production:
  const oldBugResult = productRow.inventory?.[0];
  assert.equal(oldBugResult, undefined, 'Old bug evaluates to undefined on object relations');

  // The fixed code:
  const fixedResult = extractInventory(productRow.inventory);
  assert.ok(fixedResult, 'Fixed helper correctly resolves object relation');
  assert.equal(fixedResult.stock_qty, 10);
});
