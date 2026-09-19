import { NextResponse } from 'next/server';
import { localStore } from '@/lib/mockData';
import { z } from 'zod';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';
import { updateSlotCapacity, recordAudit } from '@/lib/db';

export const runtime = 'nodejs';

const updateSchema = z.object({
  action: z.enum(['set_capacity', 'toggle_active', 'block_date', 'unblock_date']),
  slotId: z.string().optional(),
  date: z.string().optional(),
  capacity: z.number().int().min(1).max(10).optional(),
  reason: z.string().optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return adminErrorResponse(error);
  }

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'invalid_params', message: parsed.error.errors[0]?.message ?? 'Invalid parameters' },
        { status: 400 },
      );
    }

    const { action, slotId, date, capacity } = parsed.data;

    if (action === 'set_capacity' && slotId && capacity) {
      await updateSlotCapacity(slotId, capacity);
      await recordAudit(admin.profile.name, 'SLOT_CAPACITY_CHANGED', 'booking_slots', slotId, { capacity });
      return NextResponse.json({ ok: true, message: `Capacity updated to ${capacity}.` });
    }

    if (action === 'toggle_active' && slotId) {
      localStore.toggleSlotActive(slotId);
      await recordAudit(admin.profile.name, 'SLOT_TOGGLED', 'booking_slots', slotId, {});
      return NextResponse.json({ ok: true, message: 'Slot status updated.' });
    }

    if (action === 'block_date' && date) {
      localStore.blockDate(date);
      await recordAudit(admin.profile.name, 'DATE_BLOCKED', 'blocked_dates', undefined, { date });
      return NextResponse.json({ ok: true, message: `Blocked all slots for ${date}.` });
    }

    if (action === 'unblock_date' && date) {
      localStore.unblockDate(date);
      await recordAudit(admin.profile.name, 'DATE_UNBLOCKED', 'blocked_dates', undefined, { date });
      return NextResponse.json({ ok: true, message: `Re-opened slots for ${date}.` });
    }

    return NextResponse.json({ ok: false, error: 'unhandled_action' }, { status: 400 });
  } catch (err) {
    console.error('[admin/slots/update] error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
