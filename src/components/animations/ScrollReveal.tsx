import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  stagger?: number;
}

type RevealStyle = CSSProperties & {
  '--reveal-delay': string;
  '--reveal-y': string;
};

/**
 * Visible-by-default Server Component eliminating IntersectionObserver and React hydration work.
 */
export default function ScrollReveal({ children, delay = 0, y = 28, className, stagger }: Props) {
  const style: RevealStyle = {
    '--reveal-delay': `${Math.max(0, delay) * 1000}ms`,
    '--reveal-y': `${Math.max(0, y)}px`,
  };

  return (
    <div
      className={`reveal-shell ${className ?? ''}`}
      data-motion="false"
      data-visible="true"
      data-stagger={stagger ? 'true' : 'false'}
      style={style}
    >
      {children}
    </div>
  );
}
