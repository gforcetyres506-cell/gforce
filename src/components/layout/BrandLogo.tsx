import Image from 'next/image';
import clsx from 'clsx';

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  sizes?: string;
};

export default function BrandLogo({
  className,
  priority = false,
  sizes = '160px',
}: BrandLogoProps) {
  return (
    <Image
      src="/brand/g-force-tyres-logo.webp"
      alt="G Force Tyres Mobile"
      width={1914}
      height={822}
      priority={priority}
      sizes={sizes}
      draggable={false}
      className={clsx('h-auto object-contain mix-blend-screen select-none', className)}
    />
  );
}
