import React from 'react';

interface ThermoplasticsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ThermoplasticsLogo: React.FC<ThermoplasticsLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  // Dimension multipliers
  const scale = size === 'sm' ? 0.7 : size === 'lg' ? 1.25 : 1.0;
  const height = Math.round(56 * scale);

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Dynamic Graphic Icon: Blue/Green Torus with Orbit Ring */}
      <svg
        width={height * 1.05}
        height={height}
        viewBox="0 0 100 95"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="tpRingGrad" x1="10" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="35%" stopColor="#0ea5e9" />
            <stop offset="70%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
          <pattern id="tpDots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1.8" fill="#ffffff" opacity="0.35" />
          </pattern>
          <radialGradient id="tpCenterDepth" cx="48" cy="48" r="40" gradientUnits="userSpaceOnUse">
            <stop offset="40%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </radialGradient>
        </defs>

        {/* Torus Base Ring */}
        <circle cx="48" cy="48" r="34" stroke="url(#tpRingGrad)" strokeWidth="17" fill="none" />
        
        {/* Dot pattern overlay inside the torus */}
        <circle cx="48" cy="48" r="34" stroke="url(#tpDots)" strokeWidth="17" fill="none" />

        {/* Inner shadow/depth overlay */}
        <circle cx="48" cy="48" r="34" stroke="url(#tpCenterDepth)" strokeWidth="17" fill="none" />

        {/* Swooping Orbital Black Rings */}
        <path
          d="M 12 70 C 10 50, 20 20, 62 10 C 82 5, 92 16, 92 28 C 92 42, 75 75, 48 88 C 30 96, 18 92, 14 84"
          fill="none"
          stroke="#111827"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M 76 16 C 88 24, 94 38, 86 58 C 76 82, 46 95, 24 90"
          fill="none"
          stroke="#111827"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
      </svg>

      {/* Brand Text Block */}
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline">
          <span
            className="font-bold tracking-tight text-neutral-900"
            style={{ fontSize: `${1.75 * scale}rem`, letterSpacing: '-0.02em', fontWeight: 800 }}
          >
            Thermoplastics
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 font-medium">
          <div className="flex items-center gap-1.5 text-neutral-600" style={{ fontSize: `${0.8 * scale}rem` }}>
            <span className="w-1.5 h-1.5 rounded-full bg-lime-600 inline-block"></span>
            <span>Design</span>
            <span className="w-1.5 h-1.5 rounded-full bg-lime-600 inline-block ml-1"></span>
            <span>Manufacture</span>
          </div>
          <span
            className="font-bold ml-2 text-lime-600"
            style={{ fontSize: `${1.1 * scale}rem`, letterSpacing: '0.01em' }}
          >
            Tunisia
          </span>
        </div>
      </div>
    </div>
  );
};
