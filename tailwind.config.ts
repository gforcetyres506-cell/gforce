import type { Config } from 'tailwindcss';

/**
 * Tailwind maps onto the CSS custom properties defined in globals.css.
 * Single source of truth for colour is DESIGN.md -> globals.css.
 * Never hardcode a hex value in a component.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: 'var(--void)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
          4: 'var(--surface-4)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-2)',
          brand: 'var(--border-brand)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          dim: 'var(--brand-dim)',
          subtle: 'var(--brand-subtle)',
          glow: 'var(--brand-glow)',
        },
        ink: {
          1: 'var(--text-1)',
          2: 'var(--text-2)',
          3: 'var(--text-3)',
          4: 'var(--text-4)',
          inverse: 'var(--text-inverse)',
        },
        ok: 'var(--success)',
        warn: 'var(--warning)',
        bad: 'var(--danger)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        info: 'var(--info)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      maxWidth: {
        container: '1400px',
        readable: '68ch',
      },
    },
  },
  plugins: [],
};

export default config;
