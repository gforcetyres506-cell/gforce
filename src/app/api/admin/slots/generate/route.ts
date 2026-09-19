import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminErrorResponse, requireAdmin } from '@/lib/auth/admin';
import { generateSlots, recordAudit } from '@/lib/db';

export const runtime = 'nodejs';

const generateSchema = z.object({
  startDate: z.string(),
  weeks: z.number().int().min(1).max(24).default(8),
  days: z.array(z.number().int().min(0).max(6)).default([1, 2, 3, 4, 5, 6]),
  timeWindows: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
    }),
  ).default([
    { start: '08:30:00', end: '11:00:00' },
    { start: '11:30:00', end: '14:00:00' },
    { start: '14:30:00', end: '17:00:00' },
  ]),
  capacity: z.number().int().min(1).max(10).default(2),
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
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'invalid_params', message: parsed.error.errors[0]?.message ?? 'Invalid parameters' },
        { status: 400 },
      );
    }

    const { startDate, weeks, timeWindows, capacity } = parsed.data;

    // Generate in database and local mirror
    const count = await generateSlots(startDate, weeks * 7, timeWindows, capacity);

    await recordAudit(admin.profile.name, 'SLOTS_GENERATED', 'booking_slots', undefined, {
      startDate,
      weeks,
      capacity,
      generatedCount: count,
    });

    return NextResponse.json({
      ok: true,
      data: {
        generated_count: count,
        message: `Successfully created recurring slots for ${weeks} weeks (${capacity} capacity per slot).`,
      },
    });
  } catch (err) {
    console.error('[admin/slots/generate] error:', err);
    return NextResponse.json(
      { ok: false, error: 'server_error', message: 'Failed to generate recurring slots.' },
      { status: 500 },
    );
  }
}
