/** @type {import('next').NextConfig} */
const appEnvironment = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
const mockDataEnabled = process.env.ENABLE_MOCK_DATA === 'true';
const isProduction = process.env.NODE_ENV === 'production' || appEnvironment === 'production';
const approvedImageHosts = (process.env.TYRE_IMAGE_HOSTS ?? '').split(',').map(s => s.trim()).filter(Boolean);
if (approvedImageHosts.some(host => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(host))) {
  throw new Error('TYRE_IMAGE_HOSTS must contain only explicitly approved DNS hostnames.');
}

if (isProduction && mockDataEnabled) {
  throw new Error(
    'Unsafe configuration: ENABLE_MOCK_DATA=true is forbidden when NODE_ENV or APP_ENV is production.',
  );
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    authInterrupts: true,
  },
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: String(mockDataEnabled),
  },
  images: {
    // Exact supplier hosts only; the browser receives same-origin optimised images.
    remotePatterns: approvedImageHosts.map(hostname => ({ protocol: 'https', hostname })),
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    ] }];
  },
  // three.js ships untranspiled ESM in places; keep it in the server bundle
  transpilePackages: ['three'],
};

export default nextConfig;
