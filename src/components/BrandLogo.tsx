import React, { useState } from 'react';
import logoImg from '../assets/images/alhalim_logo_1787745934656.jpg';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'custom';
  className?: string;
  imageClassName?: string;
  variant?: 'light' | 'dark' | 'glass' | 'plain' | 'badge';
  showText?: boolean;
  textPosition?: 'right' | 'bottom';
  subtitle?: string;
  onClick?: () => void;
  withGlow?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
  imageClassName = '',
  variant = 'plain',
  showText = false,
  textPosition = 'right',
  subtitle = 'للتجارة والتوزيع والتوريدات',
  onClick,
  withGlow = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    '2xl': 'w-24 h-24 sm:w-28 sm:h-28',
    custom: '',
  };

  const variantContainerClasses = {
    plain: 'bg-white rounded-xl shadow-xs border border-slate-200/80 p-0.5 overflow-hidden',
    light: 'bg-white rounded-2xl shadow-sm border border-slate-200 p-1 overflow-hidden',
    dark: 'bg-white rounded-2xl shadow-lg border border-emerald-500/30 p-1 overflow-hidden',
    glass: 'bg-white/95 backdrop-blur-md rounded-2xl shadow-md border border-white/40 p-1 overflow-hidden',
    badge: 'bg-white rounded-2xl shadow-md border-2 border-amber-400 p-1 overflow-hidden',
  };

  const glowClass = withGlow ? 'ring-4 ring-amber-400/20 shadow-lg shadow-emerald-950/20' : '';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 ${onClick ? 'cursor-pointer select-none' : ''} ${
        textPosition === 'bottom' ? 'flex-col text-center' : 'flex-row'
      } ${className}`}
      dir="rtl"
    >
      {/* Logo Image Container */}
      <div
        className={`relative shrink-0 flex items-center justify-center transition-transform ${
          sizeClasses[size]
        } ${variantContainerClasses[variant]} ${glowClass}`}
      >
        {!hasError ? (
          <img
            src={logoImg}
            alt="شركة الحليم للتجارة والتوزيع"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            className={`w-full h-full object-contain object-center rounded-lg transition-transform ${imageClassName}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-emerald-950 text-white font-black flex items-center justify-center text-sm">
            ح
          </div>
        )}
      </div>

      {/* Optional Company Typography */}
      {showText && (
        <div className={textPosition === 'bottom' ? 'mt-1' : ''}>
          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
            <span className="font-black text-inherit leading-none tracking-tight">
              شركة الحليم
            </span>
            <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
              B2B
            </span>
          </div>
          {subtitle && (
            <p className="text-[10px] opacity-80 mt-1 leading-tight font-medium">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
