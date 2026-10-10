import { NextResponse } from 'next/server';
import { requireAdmin, requireSameOrigin, adminErrorResponse } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { ownerImportSchema } from '@/lib/owner-data';

export const runtime = 'nodejs';
export async function GET() {
  try {
    await requireAdmin('owner');
    const db = createAdminClient();
    const [zones, catalogue] = await Promise.all([
      db.from('service_zones').select('id,postcode_prefix,name,callout_fee_pence,priority,active').order('priority'),
      db.from('tyre_products').select('id,sku,brand,model,width,profile,rim,load_index,speed_rating,run_flat,extra_load,season,tier,wet_grip_rating,fuel_efficiency_rating,noise_db,image_url,active,inventory(stock_qty,reserved_qty,selling_price_pence,cost_price_pence,supplier_sku,low_stock_threshold)').order('sku'),
    ]);
    if (zones.error || catalogue.error || !Array.isArray(zones.data) || !Array.isArray(catalogue.data)) throw new Error();
    return NextResponse.json({ ok: true, data: { zones: zones.data, catalogue: catalogue.data } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return adminErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await requireAdmin('owner');
    requireSameOrigin(request);
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 1000000) return NextResponse.json({ ok: false, error: 'batch_too_large' }, { status: 413 });
    const parsed = ownerImportSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_owner_data',
      issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) }, { status: 400 });
    const { data, error } = await createAdminClient().rpc('owner_import_business_data', {
      p_actor_user_id: actor.user.id, p_session_id: actor.sessionId, p_kind: parsed.data.kind, p_rows: parsed.data.rows,
    });
    if (error || data !== parsed.data.rows.length) return NextResponse.json({ ok: false, error: 'import_not_confirmed',
      message: 'Import could not be confirmed. Reload current records before retrying; check fields and reserved stock.' },
      { status: error?.code === '42501' ? 403 : ['23514','23502','22P02','22023','23505'].includes(error?.code ?? '') ? 409 : 503 });
    return NextResponse.json({ ok: true, data: { kind: parsed.data.kind, saved: data } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
    return adminErrorResponse(error);
  }
}
