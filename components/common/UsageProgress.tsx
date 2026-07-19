import React from 'react';

interface UsageProgressProps {
  label?: React.ReactNode;
  used?: number;
  limit?: number;
  remaining?: number;
  unlimited?: boolean;
  loading?: boolean;
  ariaLabel?: string;
  tone?: 'indigo' | 'blue' | 'zinc';
}

export function UsageProgress({
  label,
  used = 0,
  limit = 0,
  unlimited = false,
  loading = false,
  ariaLabel,
  tone = 'indigo'
}: UsageProgressProps) {
  if (loading) {
    return (
      <div className="w-full flex flex-col gap-2">
        <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4"></div>
        <div className="h-2 bg-zinc-800 rounded animate-pulse w-full"></div>
      </div>
    );
  }

  if (unlimited) {
    return (
      <div className="w-full">
        {label && <div className="text-sm font-medium mb-2 text-zinc-300">{label}</div>}
      </div>
    );
  }

  const percentage = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;

  const toneColors = {
    indigo: 'bg-indigo-500',
    blue: 'bg-blue-500',
    zinc: 'bg-zinc-500'
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {label && <div className="text-sm font-medium text-zinc-300">{label}</div>}
      <div 
        className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label={ariaLabel}
      >
        <div 
          className={`h-full ${toneColors[tone]} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
