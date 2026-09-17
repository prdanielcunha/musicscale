import React from 'react';
import { AudioLines, TimerReset, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Metronome from '../components/common/Metronome';
import StagePadPlayer from '../components/songs/StagePadPlayer';
import OfflineResourcesPanel from '../components/stage/OfflineResourcesPanel';
import { useAuth } from '../contexts/AuthContext';

const StageToolsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, effectiveOrganizationId } = useAuth();

  return (
    <div className="relative mx-auto w-full min-w-0 max-w-6xl overflow-x-clip pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:pb-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-20 h-72 max-w-full bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.12),transparent_46%),radial-gradient(circle_at_75%_0%,rgba(59,130,246,0.08),transparent_40%)]"
      />

      <header className="relative min-w-0 mb-6 pt-1 sm:mb-9 sm:pt-4">
        <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200/78">
          <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('stage_tools.eyebrow')}</span>
        </div>
        <h1 className="max-w-3xl break-words text-[2.15rem] font-semibold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl">
          {t('stage_tools.title')}
        </h1>
        <p className="mt-3 max-w-2xl break-words text-sm leading-relaxed text-white/48 sm:mt-4 sm:text-base">
          {t('stage_tools.subtitle')}
        </p>
      </header>

      <div className="relative grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0d0d11]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:rounded-[28px] sm:p-6">
          <div className="mb-5 flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-300/12 bg-violet-300/[0.06] text-violet-200">
              <AudioLines className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-lg font-semibold tracking-[-0.025em] text-white">
                {t('stage_tools.pad_title')}
              </h2>
              <p className="mt-1 break-words text-xs leading-relaxed text-white/38">
                {t('stage_tools.pad_description')}
              </p>
            </div>
          </div>
          <StagePadPlayer userId={user?.uid} organizationId={effectiveOrganizationId} />
        </section>

        <section className="min-w-0 overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0d0d11]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:rounded-[28px] sm:p-6">
          <div className="mb-5 flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-300/12 bg-sky-300/[0.055] text-sky-200">
              <TimerReset className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-lg font-semibold tracking-[-0.025em] text-white">
                {t('stage_tools.metronome_title')}
              </h2>
              <p className="mt-1 break-words text-xs leading-relaxed text-white/38">
                {t('stage_tools.metronome_description')}
              </p>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <Metronome />
          </div>
        </section>

        <OfflineResourcesPanel />
      </div>

      <p className="relative mt-4 max-w-full break-words rounded-2xl border border-white/[0.055] bg-white/[0.018] px-4 py-3 text-[11px] leading-relaxed text-white/32">
        {t('stage_tools.audio_note')}
      </p>
    </div>
  );
};

export default StageToolsPage;
