import { handleReservationRequest } from '@/lib/reservation-request';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handleReservationRequest(request); }
