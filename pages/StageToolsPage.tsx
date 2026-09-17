import React from 'react';
import { AudioLines, TimerReset, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Metronome from '../components/common/Metronome';
import StagePadPlayer from '../components/songs/StagePadPlayer';

const StageToolsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="relative mx-auto w-full max-w-6xl pb-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-20 h-72 bg-[radial-gradient(circle_at_30%_20%,rgba(124,58,237,0.12),transparent_46%),radial-gradient(circle_at_75%_0%,rgba(59,130,246,0.08),transparent_40%)]"
      />

      <header className="relative mb-7 pt-2 sm:mb-9 sm:pt-4">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-200/78">
          <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
          {t('stage_tools.eyebrow')}
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
          {t('stage_tools.title')}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/48 sm:text-base">
          {t('stage_tools.subtitle')}
        </p>
      </header>

      <div className="relative grid gap-4 lg:grid-cols-2">
        <section className="rounded-[28px] border border-white/[0.07] bg-[#0d0d11]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-300/12 bg-violet-300/[0.06] text-violet-200">
              <AudioLines className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.025em] text-white">
                {t('stage_tools.pad_title')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-white/38">
                {t('stage_tools.pad_description')}
              </p>
            </div>
          </div>
          <StagePadPlayer />
        </section>

        <section className="rounded-[28px] border border-white/[0.07] bg-[#0d0d11]/92 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-300/12 bg-sky-300/[0.055] text-sky-200">
              <TimerReset className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.025em] text-white">
                {t('stage_tools.metronome_title')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-white/38">
                {t('stage_tools.metronome_description')}
              </p>
            </div>
          </div>
          <Metronome />
        </section>
      </div>

      <p className="relative mt-4 rounded-2xl border border-white/[0.055] bg-white/[0.018] px-4 py-3 text-[11px] leading-relaxed text-white/32">
        {t('stage_tools.audio_note')}
      </p>
    </div>
  );
};

export default StageToolsPage;
