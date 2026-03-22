import React from 'react';

type BGVariantType = 'dots' | 'diagonal-stripes' | 'grid' | 'horizontal-lines' | 'vertical-lines' | 'checkerboard';
type BGMaskType =
  | 'fade-center' | 'fade-edges' | 'fade-top' | 'fade-bottom'
  | 'fade-left' | 'fade-right' | 'fade-x' | 'fade-y' | 'none';

type BGPatternProps = React.ComponentProps<'div'> & {
  variant?: BGVariantType;
  mask?: BGMaskType;
  size?: number;
  fill?: string;
};

const maskStyles: Record<BGMaskType, string> = {
  'fade-edges': 'radial-gradient(ellipse at center, var(--bg, #09090b), transparent)',
  'fade-center': 'radial-gradient(ellipse at center, transparent, var(--bg, #09090b))',
  'fade-top': 'linear-gradient(to bottom, transparent, var(--bg, #09090b))',
  'fade-bottom': 'linear-gradient(to bottom, var(--bg, #09090b), transparent)',
  'fade-left': 'linear-gradient(to right, transparent, var(--bg, #09090b))',
  'fade-right': 'linear-gradient(to right, var(--bg, #09090b), transparent)',
  'fade-x': 'linear-gradient(to right, transparent, var(--bg, #09090b), transparent)',
  'fade-y': 'linear-gradient(to bottom, transparent, var(--bg, #09090b), transparent)',
  none: '',
};

function getBgImage(variant: BGVariantType, fill: string, size: number) {
  switch (variant) {
    case 'dots': return `radial-gradient(${fill} 1px, transparent 1px)`;
    case 'grid': return `linear-gradient(to right, ${fill} 1px, transparent 1px), linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
    case 'diagonal-stripes': return `repeating-linear-gradient(45deg, ${fill}, ${fill} 1px, transparent 1px, transparent ${size}px)`;
    case 'horizontal-lines': return `linear-gradient(to bottom, ${fill} 1px, transparent 1px)`;
    case 'vertical-lines': return `linear-gradient(to right, ${fill} 1px, transparent 1px)`;
    case 'checkerboard': return `linear-gradient(45deg, ${fill} 25%, transparent 25%), linear-gradient(-45deg, ${fill} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${fill} 75%), linear-gradient(-45deg, transparent 75%, ${fill} 75%)`;
    default: return undefined;
  }
}

const BGPattern = ({
  variant = 'grid',
  mask = 'none',
  size = 32,
  fill = 'rgba(245,158,11,0.04)',
  className = '',
  style,
  ...props
}: BGPatternProps) => {
  const bgSize = `${size}px ${size}px`;
  const backgroundImage = getBgImage(variant, fill, size);
  const maskImage = mask !== 'none' ? maskStyles[mask] : undefined;

  return (
    <div
      className={`absolute inset-0 z-[-10] w-full h-full pointer-events-none ${className}`}
      style={{ backgroundImage, backgroundSize: bgSize, maskImage, WebkitMaskImage: maskImage, ...style }}
      {...props}
    />
  );
};

BGPattern.displayName = 'BGPattern';
export { BGPattern };
