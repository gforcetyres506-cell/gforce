// Per-response nonces authorize Next.js hydration without unsafe-inline scripts.
// Styles need inline support for React/Next image sizing and the Turnstile widget.
export function contentSecurityPolicy(nonce: string, production: boolean, supabaseUrl?: string, upgradeInsecureRequests = production): string {
  const connect = ["'self'", 'https://challenges.cloudflare.com'];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol === 'https:' && !url.username && !url.password) {
        connect.push(url.origin, `wss://${url.host}`);
      }
    } catch { /* Invalid provider configuration must not widen the policy. */ }
  }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${production ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "font-src 'self'", `connect-src ${connect.join(' ')}${production ? '' : ' ws://localhost:* ws://127.0.0.1:*'}`,
    "frame-src https://challenges.cloudflare.com", "frame-ancestors 'none'",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    ...(upgradeInsecureRequests ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function isUtilityPath(path: string) {
  return /^\/(?:admin|api|account|booking|manage|confirmation|prototype|preview|test)(?:\/|$)/.test(path)
    || ['/tyres', '/privacy', '/terms', '/cancellation', '/refund'].includes(path);
}
