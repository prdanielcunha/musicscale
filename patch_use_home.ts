import fs from 'fs';

const path = 'hooks/useHomeExperience.ts';
let code = fs.readFileSync(path, 'utf8');

// Add useState, useEffect
code = code.replace("import { useMemo } from 'react';", "import { useMemo, useState, useEffect } from 'react';");

const useHomeExpOriginal = `export function useHomeExperience() {
  const { user } = useAuth();`;
const useHomeExpNew = `export function useHomeExperience() {
  const { user } = useAuth();
  const [nowMillis, setNowMillis] = useState(() => Date.now());

  useEffect(() => {
    // Atualiza o relógio a cada 60 segundos
    const interval = setInterval(() => {
      setNowMillis(Date.now());
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNowMillis(Date.now());
      }
    };
    
    const handleFocus = () => {
      setNowMillis(Date.now());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);`;
code = code.replace(useHomeExpOriginal, useHomeExpNew);

const buildCallOriginal = `    const upcomingEvents = buildHomeEventSummaries(musicScales, bandScales, user?.uid);
    const mostRecentDraft = selectMostRecentDraft(musicScales, bandScales, user?.uid);
    console.log("Upcoming events built:", upcomingEvents);`;
const buildCallNew = `    const upcomingEvents = buildHomeEventSummaries(musicScales, bandScales, user?.uid, undefined, nowMillis);
    const mostRecentDraft = selectMostRecentDraft(musicScales, bandScales, user?.uid);`;
code = code.replace(buildCallOriginal, buildCallNew);

const depsOriginal = `  }, [user?.uid, populatedScales, populatedBandScales, firstScaleExperience, canManageScales]);`;
const depsNew = `  }, [user?.uid, populatedScales, populatedBandScales, firstScaleExperience, canManageScales, nowMillis]);`;
code = code.replace(depsOriginal, depsNew);

fs.writeFileSync(path, code);
console.log('patched hook');
