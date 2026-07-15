import React from 'react';
import { ArrowRight, Lock, CheckCircle2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { entitlementsService } from '../../services/entitlementsService';

type UsageStatus = 'ok' | 'warning' | 'danger' | 'locked' | 'unlimited';

interface UsageMeterCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  used?: number;
  limit?: number | 'unlimited';
  status?: UsageStatus;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

export function UsageMeterCard({
  title,
  description,
  icon,
  used = 0,
  limit,
  status: initialStatus,
  ctaLabel,
  onCtaClick
}: UsageMeterCardProps) {
  const navigate = useNavigate();

  // Determine status automatically if not provided
  let status = initialStatus || 'ok';
  if (limit === 'unlimited') {
    status = 'unlimited';
  } else if (limit && typeof limit === 'number') {
    const percentage = limit > 0 ? (used / limit) * 100 : 100;
    if (percentage >= 95) status = 'danger';
    else if (percentage >= 80) status = 'warning';
  }

  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
    } else {
      const url = entitlementsService.getMillionsNestBaseUrl();
      window.open(`${url}/dashboard/billing`, '_blank', 'noreferrer,noopener');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'danger': return 'text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400';
      case 'warning': return 'text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400';
      case 'locked': return 'text-zinc-500 bg-zinc-100 dark:bg-zinc-500/20 dark:text-zinc-400';
      case 'unlimited': return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400';
      default: return 'text-indigo-600 bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400';
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case 'danger': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      case 'ok': return 'bg-indigo-500';
      default: return 'bg-zinc-300 dark:bg-zinc-700'; // locked or unlimited usually don't show active bar
    }
  };

  const percentage = limit !== 'unlimited' && typeof limit === 'number' && limit > 0
    ? Math.min(100, Math.max(0, (used / limit) * 100))
    : 0;

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-300 ${status === 'locked' ? 'bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200/50 dark:border-zinc-800/50 grayscale-[0.5]' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getStatusColor()}`}>
              {icon}
            </div>
          )}
          <div>
            <h4 className={`text-sm font-bold tracking-tight ${status === 'locked' ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
              {title}
            </h4>
            {status === 'locked' && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-zinc-500 mt-0.5">
                <Lock className="w-3 h-3" /> Bloqueado no plano atual
              </span>
            )}
            {status === 'unlimited' && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> Ilimitado
              </span>
            )}
          </div>
        </div>
      </div>

      {description && (
        <p className={`text-xs mb-4 leading-relaxed ${status === 'locked' ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
          {description}
        </p>
      )}

      {/* Progress Bar Area */}
      {status !== 'locked' && status !== 'unlimited' && typeof limit === 'number' && (
        <div className="mb-4">
          <div className="flex justify-between items-end mb-1.5 font-sans">
            <span className={`text-2xl font-black tracking-tighter ${
              status === 'danger' ? 'text-red-500' : 
              status === 'warning' ? 'text-amber-500' : 
              'text-zinc-900 dark:text-zinc-100'
            }`}>
              {used}
            </span>
            <span className="text-xs font-semibold text-zinc-400 mb-1">
              / {limit} permitidos
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`h-full ${getProgressColor()} rounded-full transition-all duration-1000 ease-out`} 
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* CTA Button */}
      {ctaLabel && (status === 'locked' || status === 'danger' || status === 'warning') && (
        <button
          onClick={handleCtaClick}
          className={`w-full h-10 mt-2 flex items-center justify-between px-4 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
            status === 'locked'
              ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 border border-indigo-200/50 dark:border-indigo-500/20'
              : 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100'
          }`}
        >
          <span className="flex items-center gap-1.5 text-left truncate leading-tight py-1">
             {status === 'locked' && <Zap className="w-3.5 h-3.5 flex-shrink-0" />}
             {ctaLabel}
          </span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      )}
    </div>
  );
}
