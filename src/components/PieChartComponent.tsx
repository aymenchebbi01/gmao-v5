import React, { useState } from 'react';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieSlice[];
  size?: number;
  donut?: boolean;
  innerRadiusRatio?: number;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
}

export const PieChartComponent: React.FC<PieChartProps> = ({
  data,
  size = 200,
  donut = true,
  innerRadiusRatio = 0.62,
  centerLabel,
  centerValue,
  showLegend = true,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((acc, d) => acc + d.value, 0);
  const radius = size / 2;
  const innerRadius = donut ? radius * innerRadiusRatio : 0;
  const center = radius;

  // Compute angles for each slice
  let currentAngle = -Math.PI / 2; // start at 12 o'clock

  const slices = data.map((item, idx) => {
    const sliceAngle = total > 0 ? (item.value / total) * 2 * Math.PI : 0;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    // SVG arc path calculation
    const isFullCircle = sliceAngle >= 2 * Math.PI - 0.001;

    // Outer arc points
    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    // Inner arc points
    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(startAngle);
    const y4 = center + innerRadius * Math.sin(startAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

    let path = '';
    if (total === 0 || item.value === 0) {
      path = '';
    } else if (isFullCircle) {
      if (donut) {
        path = `
          M ${center} ${center - radius}
          A ${radius} ${radius} 0 1 0 ${center} ${center + radius}
          A ${radius} ${radius} 0 1 0 ${center} ${center - radius}
          M ${center} ${center - innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center + innerRadius}
          A ${innerRadius} ${innerRadius} 0 1 1 ${center} ${center - innerRadius}
          Z
        `;
      } else {
        path = `
          M ${center} ${center - radius}
          A ${radius} ${radius} 0 1 0 ${center} ${center + radius}
          A ${radius} ${radius} 0 1 0 ${center} ${center - radius}
          Z
        `;
      }
    } else {
      if (donut) {
        path = `
          M ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          L ${x3} ${y3}
          A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}
          Z
        `;
      } else {
        path = `
          M ${center} ${center}
          L ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          Z
        `;
      }
    }

    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;

    return {
      ...item,
      path,
      percentage,
      idx,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
      {/* SVG Pie Chart Canvas */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
        >
          {total === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={radius - 4}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={donut ? radius - innerRadius : radius}
            />
          ) : (
            slices.map((slice) => {
              if (!slice.path) return null;
              const isHovered = hoveredIdx === slice.idx;

              return (
                <path
                  key={slice.idx}
                  d={slice.path}
                  fill={slice.color}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: hoveredIdx === null || isHovered ? 1 : 0.65,
                    transformOrigin: `${center}px ${center}px`,
                    transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoveredIdx(slice.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })
          )}
        </svg>

        {/* Donut Center Counter & Label */}
        {donut && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
            <span className="text-2xl font-black text-neutral-900 tracking-tight font-mono tabular-nums leading-none">
              {hoveredIdx !== null ? slices[hoveredIdx].value : centerValue ?? total}
            </span>
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-tight mt-1 leading-tight max-w-[85px]">
              {hoveredIdx !== null ? slices[hoveredIdx].label : centerLabel ?? 'Total'}
            </span>
            {hoveredIdx !== null && (
              <span className="text-[10px] font-bold text-neutral-700 font-mono mt-0.5">
                {slices[hoveredIdx].percentage}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend Column */}
      {showLegend && (
        <div className="flex flex-col justify-center space-y-2 flex-1 min-w-[170px] w-full sm:w-auto">
          {slices.map((slice) => {
            const isHovered = hoveredIdx === slice.idx;
            return (
              <div
                key={slice.idx}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between gap-3 text-xs p-1.5 rounded-xl cursor-pointer transition-colors ${
                  isHovered ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className={`truncate font-medium ${isHovered ? 'font-bold text-neutral-950' : 'text-neutral-700'}`}>
                    {slice.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                  <span className="font-bold text-neutral-900">{slice.value}</span>
                  <span className="text-neutral-400 text-[11px] w-8 text-right">
                    {slice.percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
