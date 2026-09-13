import React from 'react';

interface MusicWorkspaceSkeletonProps {
  cardCount?: number;
}

const MusicWorkspaceSkeleton: React.FC<MusicWorkspaceSkeletonProps> = ({ cardCount = 8 }) => {
  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true">
      <div className="ms-panel overflow-hidden p-4 sm:p-5">
        <div className="animate-pulse space-y-4 motion-reduce:animate-none">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-2.5 w-24 rounded-full bg-white/[0.07]" />
              <div className="h-6 w-44 rounded-full bg-white/[0.06]" />
            </div>
            <div className="h-9 w-24 rounded-[12px] bg-white/[0.05]" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="h-[62px] rounded-[14px] border border-white/[0.05] bg-white/[0.025]" />
            ))}
          </div>
        </div>
      </div>

      <div className="ms-panel p-4 sm:p-5">
        <div className="animate-pulse space-y-3 motion-reduce:animate-none">
          <div className="h-12 rounded-[14px] bg-white/[0.05]" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="h-10 rounded-[12px] bg-white/[0.035]" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="ms-card min-h-[164px] p-4">
            <div className="animate-pulse space-y-4 motion-reduce:animate-none">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded-full bg-white/[0.07]" />
                  <div className="h-3 w-24 rounded-full bg-white/[0.045]" />
                </div>
                <div className="h-9 w-9 rounded-[12px] bg-white/[0.045]" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-14 rounded-[9px] bg-white/[0.045]" />
                <div className="h-6 w-16 rounded-[9px] bg-white/[0.035]" />
              </div>
              <div className="h-2.5 w-3/4 rounded-full bg-white/[0.035]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MusicWorkspaceSkeleton;
