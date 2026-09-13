import React from 'react';

type OperationalWorkspaceSkeletonVariant = 'profile' | 'team' | 'directory' | 'scales';

interface OperationalWorkspaceSkeletonProps {
  variant?: OperationalWorkspaceSkeletonVariant;
}

const Pulse: React.FC<{ className: string }> = ({ className }) => (
  <div className={`animate-pulse motion-reduce:animate-none ${className}`} />
);

const OperationalWorkspaceSkeleton: React.FC<OperationalWorkspaceSkeletonProps> = ({
  variant = 'team',
}) => {
  if (variant === 'profile') {
    return (
      <div className="ms-profile-page space-y-6" aria-busy="true">
        <div className="ms-panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <Pulse className="h-24 w-24 shrink-0 rounded-[24px] bg-white/[0.06]" />
          <div className="flex-1 space-y-3">
            <Pulse className="h-6 w-48 max-w-full rounded-full bg-white/[0.07]" />
            <Pulse className="h-3 w-64 max-w-full rounded-full bg-white/[0.04]" />
            <Pulse className="h-7 w-24 rounded-[10px] bg-white/[0.04]" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="ms-card min-h-[180px] p-5">
              <div className="space-y-4">
                <Pulse className="h-4 w-36 rounded-full bg-white/[0.06]" />
                <Pulse className="h-11 w-full rounded-[12px] bg-white/[0.04]" />
                <Pulse className="h-11 w-full rounded-[12px] bg-white/[0.035]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'scales') {
    return (
      <div className="ms-band-scales-page space-y-5" aria-busy="true">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-2">
            <Pulse className="h-7 w-52 rounded-full bg-white/[0.07]" />
            <Pulse className="h-3 w-72 max-w-full rounded-full bg-white/[0.04]" />
          </div>
          <Pulse className="hidden h-10 w-32 rounded-[12px] bg-white/[0.05] sm:block" />
        </div>
        <div className="ms-panel p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Pulse key={item} className="h-11 rounded-[12px] bg-white/[0.04]" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="ms-card min-h-[188px] p-5">
              <div className="flex gap-4">
                <Pulse className="h-16 w-16 shrink-0 rounded-[14px] bg-white/[0.055]" />
                <div className="flex-1 space-y-3">
                  <Pulse className="h-5 w-3/4 rounded-full bg-white/[0.065]" />
                  <Pulse className="h-3 w-1/2 rounded-full bg-white/[0.04]" />
                  <Pulse className="mt-5 h-9 w-full rounded-[12px] bg-white/[0.035]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isDirectory = variant === 'directory';
  return (
    <div className={isDirectory ? 'ms-band-page space-y-5' : 'ms-users-page space-y-5'} aria-busy="true">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Pulse className="h-7 w-48 rounded-full bg-white/[0.07]" />
          <Pulse className="h-3 w-64 max-w-full rounded-full bg-white/[0.04]" />
        </div>
        <Pulse className="hidden h-10 w-28 rounded-[12px] bg-white/[0.05] sm:block" />
      </div>
      <div className="ms-panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Pulse className="h-11 rounded-[12px] bg-white/[0.04]" />
          <Pulse className="h-11 rounded-[12px] bg-white/[0.04]" />
        </div>
      </div>
      <div className={isDirectory ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'space-y-3'}>
        {Array.from({ length: isDirectory ? 8 : 6 }).map((_, index) => (
          <div key={index} className="ms-card p-4">
            <div className="flex items-center gap-3">
              <Pulse className="h-11 w-11 shrink-0 rounded-full bg-white/[0.055]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Pulse className="h-4 w-2/3 rounded-full bg-white/[0.065]" />
                <Pulse className="h-3 w-1/2 rounded-full bg-white/[0.035]" />
              </div>
              {!isDirectory && <Pulse className="h-8 w-20 rounded-[10px] bg-white/[0.04]" />}
            </div>
            {isDirectory && (
              <div className="mt-4 flex gap-2">
                <Pulse className="h-6 w-16 rounded-[9px] bg-white/[0.04]" />
                <Pulse className="h-6 w-20 rounded-[9px] bg-white/[0.035]" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OperationalWorkspaceSkeleton;
