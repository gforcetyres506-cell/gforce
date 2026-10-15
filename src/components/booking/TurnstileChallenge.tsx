'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { useSecurityNonce } from '@/components/SecurityNonce';

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
export default function TurnstileChallenge({ onToken }: { onToken: (token: string) => void }) {
  const nonce = useSecurityNonce();
  const element = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!ready || !api || !sitekey || !element.current) return;
    const widget = api.render(element.current, {
      sitekey, action: 'vrm_lookup', size: 'flexible',
      callback: (token: string) => { setFailed(false); onToken(token); },
      'expired-callback': () => onToken(''),
      'error-callback': () => { onToken(''); setFailed(true); },
    });
    return () => { api.remove(widget); onToken(''); };
  }, [ready, sitekey, onToken]);
  if (!sitekey) return <p className="text-xs text-ink-2">Registration lookup is unavailable. Enter the tyre size from your sidewall.</p>;
  return <>
    <Script nonce={nonce} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      onReady={() => setReady(true)} onError={() => { onToken(''); setFailed(true); }} />
    <div ref={element} className="min-w-0 w-full" aria-label="Registration lookup security check" />
    {failed && <p role="alert" className="text-xs text-danger">Security check unavailable. Use manual tyre size entry.</p>}
  </>;
}
