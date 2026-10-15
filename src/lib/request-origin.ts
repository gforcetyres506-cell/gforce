/** Public origin behind a reverse proxy; never trust a forwarded host. */
export function getRequestOrigin(request: Pick<Request, 'url' | 'headers'>): string | null {
  const internal = new URL(request.url);
  const host = request.headers.get('host') ?? internal.host;
  const protocol = request.headers.get('x-forwarded-proto') ?? internal.protocol.replace(':', '');
  if (!['http', 'https'].includes(protocol)) return null;
  try {
    const publicUrl = new URL(`${protocol}://${host}`);
    if (publicUrl.username || publicUrl.password || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) return null;
    return publicUrl.origin;
  } catch { return null; }
}
