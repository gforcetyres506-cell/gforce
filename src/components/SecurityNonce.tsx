'use client';
import { createContext, useContext } from 'react';
const SecurityNonce = createContext<string | undefined>(undefined);
export const useSecurityNonce = () => useContext(SecurityNonce);
export function SecurityNonceProvider({ nonce, children }: { nonce?: string; children: React.ReactNode }) {
  return <SecurityNonce.Provider value={nonce}>{children}</SecurityNonce.Provider>;
}
