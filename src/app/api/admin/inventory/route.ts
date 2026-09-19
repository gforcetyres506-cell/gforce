import { NextResponse } from 'next/server';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';
import { getAllTyresAdmin, updateTyreStock, updateTyrePrice, createTyre, recordAudit } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/admin/inventory
 * List all tyres in inventory with full stock and pricing details.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const tyres = await getAllTyresAdmin();
    return NextResponse.json({ ok: true, data: tyres });
  } catch (err) {
    console.error('[admin/inventory/get] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to fetch inventory.' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/inventory
 * Update tyre stock quantity or selling price.
 */
export async function PATCH(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const body = await req.json();
    const { id, stock, sellPrice } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: 'missing_id', message: 'Tyre ID is required.' }, { status: 400 });
    }

    if (stock !== undefined) {
      await updateTyreStock(id, Math.max(0, Number(stock)));
      await recordAudit(admin.profile.name, 'STOCK_UPDATED', 'tyre_inventory', id, { newStock: stock });
    }

    if (sellPrice !== undefined) {
      await updateTyrePrice(id, Number(sellPrice));
      await recordAudit(admin.profile.name, 'PRICE_UPDATED', 'tyre_inventory', id, { newSellPrice: sellPrice });
    }

    return NextResponse.json({ ok: true, message: 'Tyre updated successfully.' });
  } catch (err) {
    console.error('[admin/inventory/patch] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to update tyre.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/inventory
 * Add a new tyre product to inventory.
 */
export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const body = await req.json();
    const {
      brand,
      model,
      width,
      profile,
      rim,
      load_index,
      speed_rating,
      is_run_flat,
      is_xl,
      season,
      tier,
      cost_price,
      sell_price,
      stock,
      wet_grip,
      fuel_economy,
      noise_db,
    } = body;

    if (!brand || !model || !width || !profile || !rim || sell_price === undefined) {
      return NextResponse.json({ ok: false, error: 'invalid_tyre', message: 'Missing required tyre specifications.' }, { status: 400 });
    }

    const sku = `${brand.slice(0, 4).toUpperCase()}-${model.slice(0, 3).toUpperCase()}-${width}${profile}${rim}`;

    const created = await createTyre({
      brand,
      model,
      sku,
      width: Number(width),
      profile: Number(profile),
      rim: Number(rim),
      load_index: load_index || '95',
      speed_rating: speed_rating || 'Y',
      is_run_flat: Boolean(is_run_flat),
      is_xl: Boolean(is_xl),
      season: season || 'summer',
      tier: tier || 'premium',
      cost_price: Number(cost_price) || 8000,
      sell_price: Number(sell_price),
      stock: Number(stock) || 0,
      wet_grip: wet_grip || 'A',
      fuel_economy: fuel_economy || 'C',
      noise_db: noise_db ? Number(noise_db) : 71,
      active: true,
    });

    await recordAudit(admin.profile.name, 'TYRE_CREATED', 'tyre_inventory', created?.id, { sku });

    return NextResponse.json({ ok: true, data: created });
  } catch (err) {
    console.error('[admin/inventory/post] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error', message: 'Failed to create tyre.' }, { status: 500 });
  }
}
