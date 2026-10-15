import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { SITE_NAME } from '@/lib/site';

export const runtime = 'nodejs';
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default async function SocialImage() {
  // Satori's image decoder needs PNG; preserve the approved logo pixels.
  const logo = await sharp(await readFile(join(process.cwd(), 'public/brand/g-force-tyres-logo.webp'))).png().toBuffer();
  return new ImageResponse(<div style={{ width: '100%', height: '100%', background: '#0D0D0D', color: '#f5f5f5', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, borderBottom: '12px solid #38bdf8' }}>
    {/* Approved artwork is displayed unchanged. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/png;base64,${logo.toString('base64')}`} width={380} height={163} alt="" />
    <div style={{ display: 'flex', marginTop: 35, fontSize: 64, fontWeight: 700 }}>Mobile tyre fitting</div>
    <div style={{ display: 'flex', marginTop: 22, fontSize: 30, color: '#c4c4c4' }}>Check your postcode. Find your tyre size.</div>
    <div style={{ display: 'flex', marginTop: 34, fontSize: 24, color: '#38bdf8' }}>www.gforcetyres-mobile.co.uk</div>
  </div>, size);
}
