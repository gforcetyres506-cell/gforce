import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const toolRequire = createRequire(resolve('package.json'));
// Reuse the esbuild runtime supplied by the already-declared Wrangler tool.
const { build } = toolRequire(toolRequire.resolve('esbuild', { paths: [dirname(toolRequire.resolve('wrangler/package.json'))] }));
export async function buildGate3Harness() {
  await build({ entryPoints: ['tests/ui/gate3-harness.tsx'], bundle: true, platform: 'browser', format: 'iife',
    jsx: 'automatic', outfile: '.local-postgres/gate3-harness-' + process.pid + '.js', define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'test-only-next-router', setup(b) {
      b.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'gate3-test' }));
      b.onLoad({ filter: /.*/, namespace: 'gate3-test' }, args => ({ loader: 'jsx', resolveDir: resolve('.'), contents: args.path === 'next/link'
        ? "import React from 'react';export default function Link({children,href,...props}){return <a href={href} {...props}>{children}</a>}"
        : "const router={push:url=>window.location.assign(url),replace:url=>window.location.replace(url)};export function useRouter(){return router};export function useSearchParams(){return new URLSearchParams(window.location.search)};export function usePathname(){return window.location.pathname}" }));
    } }],
  });
}
