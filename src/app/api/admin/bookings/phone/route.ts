import { adminErrorResponse, requireAdmin, requireSameOrigin } from '@/lib/auth/admin';
import { handleReservationRequest } from '@/lib/reservation-request';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const actor = await requireAdmin();
    return await handleReservationRequest(request, actor);
  } catch (error) { return adminErrorResponse(error); }
}
