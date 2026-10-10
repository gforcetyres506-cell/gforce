import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadSource, databaseDouble } from './loader.mjs';

const tyre = { image_url: null, sku: 'TEST', season: 'summer', tier: 'standard', load_index: null, speed_rating: null, run_flat: false, extra_load: false, wet_grip_rating: null, fuel_efficiency_rating: null, noise_db: null, created_at: '2030-01-01', inventory: { stock_qty: 4, reserved_qty: 0, selling_price_pence: 12300 }, id: 'test-tyre', brand: 'Test only', model: 'Fixture', width: 205, profile: 55, rim: 16, sell_price: 12300, stock: 4, active: true };
const settings = { pricing_configured: true, deposit_value: 13, fitting_fee_pence: 1700, job_duration_minutes: 70, phone: null, deposit_mode: 'percent', deposit_fixed: 0, deposit_percent: 13, fitting_fee: 1700,
  job_duration_mins: 70, cancellation_policy: 'Test policy', business_phone: null };
const slot = { id: 'test-slot', slot_date: '2030-01-02', start_time: '10:00:00', end_time: '12:00:00', max_bookings: 2, active: true };
const dbResult = (data) => ({ data, error: null });
const failed = { data: null, error: { message: 'Simulated database outage' } };
const source = (path, db, extra = {}) => loadSource('src/lib/' + path + '.ts', { db, ...extra });

test('unconfigured database never returns a catalogue', async () => {
  await assert.rejects(source('db').getTyres());
});
test('a real empty catalogue remains empty', async () => {
  const db = databaseDouble(() => dbResult([]));
  assert.deepEqual(await source('db', db).getTyres(), []);
  assert.ok(db.calls.every((call) => call.operation === 'read'));
});
test('inventory database failures never become stock', async () => {
  await assert.rejects(source('db', databaseDouble(() => failed)).getTyres());
});
test('missing tyre ID remains absent', async () => {
  assert.equal(await source('db', databaseDouble(() => dbResult(null))).getTyreById('missing'), null);
});
for (const invalid of [{ inventory: { stock_qty: 4, reserved_qty: 0, selling_price_pence: 0 } }, { inventory: null }, { inventory: { stock_qty: 4, reserved_qty: 5, selling_price_pence: 12300 } }, { width: null }]) {
  test('invalid inventory data fails closed: ' + JSON.stringify(invalid), async () => {
    await assert.rejects(source('db', databaseDouble(() => dbResult([{ ...tyre, ...invalid }]))).getTyres());
  });
}
test('price and deposit use actual supplied settings', async () => {
  const db = databaseDouble(({ table }) => dbResult(table === 'business_settings' ? settings : [tyre]));
  const price = await source('pricing', db).calculatePrice([{ tyre_id: tyre.id, quantity: 2 }], 900);
  assert.equal(price.tyres_total, 24600);
  assert.equal(price.fitting_fee, 1700);
  assert.equal(price.total_amount, 27200);
  assert.equal(price.deposit_amount, 3536);
  assert.equal(price.balance_due, 23664);
});
test('missing pricing settings cannot quote', async () => {
  const db = databaseDouble(({ table }) => dbResult(table === 'business_settings' ? null : [tyre]));
  await assert.rejects(source('pricing', db).calculatePrice([{ tyre_id: tyre.id, quantity: 1 }], 0));
});
test('partial pricing settings have no monetary defaults', async () => {
  const db = databaseDouble(() => dbResult({ deposit_mode: 'fixed' }));
  await assert.rejects(source('pricing', db).calculatePrice([{ tyre_id: tyre.id, quantity: 1 }], 0));
});
test('pricing query failure cannot quote', async () => {
  const db = databaseDouble(({ table }) => table === 'business_settings' ? dbResult(settings) : failed);
  await assert.rejects(source('pricing', db).calculatePrice([{ tyre_id: tyre.id, quantity: 1 }], 0));
});
test('missing selected tyre never picks another product', async () => {
  const db = databaseDouble(({ table }) => dbResult(table === 'business_settings' ? settings : [tyre]));
  await assert.rejects(source('pricing', db).calculatePrice([{ tyre_id: 'wrong-id', quantity: 1 }], 0), { code: 'TYRE_NOT_FOUND' });
});
test('duplicate lines cannot hide an out of stock quantity', async () => {
  const db = databaseDouble(({ table }) => dbResult(table === 'business_settings' ? settings : [tyre]));
  await assert.rejects(source('pricing', db).calculatePrice([{ tyre_id: tyre.id, quantity: 3 }, { tyre_id: tyre.id, quantity: 3 }], 0), { code: 'OUT_OF_STOCK' });
});
for (const table of ['bookings', 'slot_holds']) {
  test('availability fails if occupancy query fails: ' + table, async () => {
    const db = databaseDouble((call) => call.table === table ? failed : dbResult(call.table === 'booking_slots' ? [slot] : []));
    await assert.rejects(source('db', db).getSlots());
  });
}
test('empty schedule is read-only and never generates slots', async () => {
  const db = databaseDouble(() => dbResult([]));
  assert.deepEqual(await source('db', db).getSlots(), []);
  assert.ok(db.calls.every((call) => call.operation === 'read'));
});
test('availability uses confirmed occupancy and actual holds', async () => {
  const db = databaseDouble(({ table }) => dbResult(table === 'booking_slots' ? [slot] : table === 'slot_holds' ? [{ slot_id: slot.id }] : []));
  const result = await source('db', db).getSlots();
  assert.equal(result[0].remaining, 1);
  assert.equal(result[0].available, true);
});
test('incomplete fitting schedule cannot imply availability', async () => {
  const db = databaseDouble(() => dbResult([{ ...slot, start_time: null }]));
  await assert.rejects(source('db', db).getSlots());
});
test('failed atomic hold never attempts a manual or local insert', async () => {
  const db = databaseDouble(() => { throw new Error('Unexpected database query after failed RPC'); });
  await assert.rejects(source('db', db).createSlotHold(slot.id, 'test-session'), /could not be reserved/);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].rpc, 'create_slot_hold');
});
test('hold must be read back from persistent session-owned row', async () => {
  const db = databaseDouble(() => failed, () => dbResult([{ hold_id: 'test-hold' }]));
  await assert.rejects(source('db', db).createSlotHold(slot.id, 'test-session'), /could not be reserved/);
});
test('confirmed hold exposes the persisted expiry', async () => {
  const expires_at = '2030-01-02T10:00:00Z';
  const db = databaseDouble(() => dbResult({ id: 'test-hold', slot_id: slot.id, expires_at }), () => dbResult([{ hold_id: 'test-hold' }]));
  assert.deepEqual(await source('db', db).createSlotHold(slot.id, 'test-session'), { hold_id: 'test-hold', slot_id: slot.id, expires_at });
  assert.ok(db.calls[1].filters.some((filter) => filter[0] === 'eq' && filter[1] === 'token'));
});
test('failed release never reports released', async () => {
  await assert.rejects(source('db', databaseDouble(() => failed)).releaseSlotHold('test-session'));
});
test('empty coverage has no default zone', async () => {
  assert.equal((await source('postcodes', databaseDouble(() => dbResult([]))).checkCoverage('E14 8PX')).covered, false);
});
test('coverage database failure cannot imply coverage', async () => {
  await assert.rejects(source('postcodes', databaseDouble(() => failed)).checkCoverage('E14 8PX'));
});
test('postcode provider timeout cannot imply validity', async () => {
  const helper = source('postcodes', undefined, { fetch: async () => { throw new Error('Timeout'); } });
  await assert.rejects(helper.validatePostcode('E14 8PX'));
});
test('unconfigured OneAuto never returns a sandbox plate', async () => {
  assert.equal(await source('oneauto').lookupVRM('AB21ABC'), null);
});
test('an API key cannot enable an unverified provider contract', async () => {
  let calls = 0;
  const helper = source('oneauto', undefined, { env: { ONEAUTO_API_KEY: 'test-only' }, fetch: async () => { calls++; throw new Error('Unexpected provider call'); } });
  assert.equal(await helper.lookupVRM('AB21ABC'), null);
  assert.equal(calls, 0);
});
test('expired persistent hold is not reported reserved', async () => {
  const db = databaseDouble(() => dbResult({ id: 'test-hold', slot_id: slot.id, expires_at: '2000-01-01' }), () => dbResult([{ hold_id: 'test-hold' }]));
  await assert.rejects(source('db', db).createSlotHold(slot.id, 'test-session'), /could not be reserved/);
});
test('booking requires explicit tyre and all three valid dimensions', () => {
  const { validBookingEntry } = source('journey');
  assert.equal(validBookingEntry(null, null, null, null), false);
  assert.equal(validBookingEntry(tyre.id, '205', null, '16'), false);
  assert.equal(validBookingEntry(tyre.id, '205', '55', '16'), true);
});
test('pending, cancelled and refunded statuses never become confirmed by exclusion', () => {
  const { bookingHeading, hasRecordedDeposit } = source('booking-state');
  const booking = { status: 'pending_payment', deposit_paid_at: null, stripe_payment_intent_id: null, stripe_charge_id: null };
  assert.equal(hasRecordedDeposit(booking), false);
  assert.equal(bookingHeading(booking), 'Payment pending');
  assert.equal(bookingHeading({ ...booking, status: 'cancelled' }), 'Booking cancelled');
  assert.equal(bookingHeading({ ...booking, status: 'refunded' }), 'Refund recorded');
  assert.equal(bookingHeading({ ...booking, status: 'confirmed' }), 'Payment confirmation unavailable');
});
test('runtime cannot import seed data or confirm synthetic payments', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
  for (const file of walk('src').filter((path) => /\.(ts|tsx)$/.test(path))) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /localStore|MOCK_TYRES|MOCK_FITTERS|MOCK_SETTINGS|demo_secret|phone_staff_|hold-\$\{Date\.now/);
  }
});
