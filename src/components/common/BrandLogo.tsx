import React from 'react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  mode?: 'full' | 'compact';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'light',
  size = 'md',
  showSubtitle = true,
  className = '',
  mode = 'compact'
}) => {
  const heights = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12'
  };

  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  if (mode === 'full') {
    return (
      <div className={`flex items-center gap-3 shrink-0 ${className}`}>
        <div className="relative overflow-hidden rounded-xs bg-[#000000] p-1 border border-stone-800 shadow-xs flex items-center justify-center">
          <img
            src="/assets/aistudio/Screenshot_20261029_112009_Gallery_b65df3d1.jpg"
            alt="R3 Contingencies"
            className={`${heights[size]} w-auto object-contain object-center`}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/logo-full.png';
            }}
          />
        </div>
        {showSubtitle && (
          <div className="flex flex-col">
            <span
              className={`font-serif font-bold tracking-wider leading-tight ${
                variant === 'dark' ? 'text-white' : 'text-[#0A192F]'
              } ${size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'}`}
            >
              R3 <span className="text-[#3B82F6]">Contingencies</span>
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-stone-500 font-sans -mt-0.5">
              Global Affiliate Network
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default 'compact': Displays the distinctive Bell/Cloche insignia in a dark luxury bezel alongside clean typography
  return (
    <div className={`flex items-center gap-3 shrink-0 ${className}`}>
      <div
        className={`${iconSizes[size]} bg-[#000000] border border-stone-800 rounded-xs flex items-center justify-center p-1 shadow-xs transition-colors group-hover:border-[#3B82F6]`}
      >
        <img
          src="/logo-emblem.png"
          alt="R3 Contingencies Emblem"
          className="w-full h-full object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/favicon.svg';
          }}
        />
      </div>
      <div className="flex flex-col">
        <div
          className={`font-serif font-bold tracking-wider leading-tight flex items-center gap-1.5 ${
            size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
          }`}
        >
          <span className="text-[#3B82F6]">R3</span>
          <span className={variant === 'dark' ? 'text-white' : 'text-[#0A192F]'}>Contingencies</span>
        </div>
        {showSubtitle && (
          <span className="text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-stone-500 font-sans -mt-0.5">
            Global Affiliate Network
          </span>
        )}
      </div>
    </div>
  );
};
