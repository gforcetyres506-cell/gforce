import type { ReactNode } from 'react';

interface HeroTyreMotionProps {
  children: ReactNode;
}

export default function HeroTyreMotion({ children }: HeroTyreMotionProps) {
  return (
    <div className="hero-tyre-motion" data-in-view="true">
      <div className="hero-tyre-aura" aria-hidden="true" />
      <div className="hero-tyre-ground-shadow" aria-hidden="true" />
      <div className="hero-tyre-tilt" data-active="false">
        <div className="hero-tyre-spin">
          <div className="hero-tyre-wrap">
            {children}
            <div className="hero-tyre-sheen" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="hero-tyre-scanline" aria-hidden="true" />
    </div>
  );
}
