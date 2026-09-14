import React from 'react';
import { useTranslation } from 'react-i18next';
import MusicWorkspaceSkeleton from './MusicWorkspaceSkeleton';
import OperationalWorkspaceSkeleton from './OperationalWorkspaceSkeleton';

interface RouteWorkspaceSkeletonProps {
  pathname: string;
}

const GenericWorkspaceSkeleton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-5" aria-busy="true" aria-label={t('premiumV2.loading.content')} data-testid="route-workspace-skeleton">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-7 w-52 max-w-[70%] animate-pulse rounded-full bg-white/[0.07] motion-reduce:animate-none" />
          <div className="h-3 w-72 max-w-[86%] animate-pulse rounded-full bg-white/[0.04] motion-reduce:animate-none" />
        </div>
        <div className="hidden h-10 w-28 animate-pulse rounded-[12px] bg-white/[0.05] motion-reduce:animate-none sm:block" />
      </div>
      <div className="ms-panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map(item => (
          <div key={item} className="h-11 animate-pulse rounded-[12px] bg-white/[0.04] motion-reduce:animate-none" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="ms-card min-h-[164px] p-5">
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/[0.065] motion-reduce:animate-none" />
            <div className="mt-3 h-3 w-1/2 animate-pulse rounded-full bg-white/[0.04] motion-reduce:animate-none" />
            <div className="mt-8 h-10 w-full animate-pulse rounded-[12px] bg-white/[0.035] motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
};

const RouteWorkspaceSkeleton: React.FC<RouteWorkspaceSkeletonProps> = ({ pathname }) => {
  if (pathname.startsWith('/songs') || pathname.startsWith('/chords') || pathname.startsWith('/lyrics') || pathname.startsWith('/library')) {
    return <MusicWorkspaceSkeleton />;
  }
  if (pathname.startsWith('/profile')) return <OperationalWorkspaceSkeleton variant="profile" />;
  if (pathname.startsWith('/users')) return <OperationalWorkspaceSkeleton variant="team" />;
  if (pathname.startsWith('/band')) return <OperationalWorkspaceSkeleton variant="directory" />;
  if (pathname.startsWith('/scales') || pathname.startsWith('/band-scales')) return <OperationalWorkspaceSkeleton variant="scales" />;
  return <GenericWorkspaceSkeleton />;
};

export default RouteWorkspaceSkeleton;
