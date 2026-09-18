import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

export interface ArmedVisualCue {
  providerId: string;
  clipId: string;
  clipName: string;
  layerId: string;
  layerName: string;
}

interface LiveCueCoordinatorValue {
  armedVisualCue: ArmedVisualCue | null;
  armVisualCue: (cue: ArmedVisualCue) => void;
  clearVisualCue: () => void;
}

const LiveCueCoordinatorContext = createContext<LiveCueCoordinatorValue | null>(null);

export function LiveCueCoordinatorProvider({ children }: PropsWithChildren) {
  const [armedVisualCue, setArmedVisualCue] = useState<ArmedVisualCue | null>(null);

  const value = useMemo<LiveCueCoordinatorValue>(() => ({
    armedVisualCue,
    armVisualCue: setArmedVisualCue,
    clearVisualCue: () => setArmedVisualCue(null)
  }), [armedVisualCue]);

  return (
    <LiveCueCoordinatorContext.Provider value={value}>
      {children}
    </LiveCueCoordinatorContext.Provider>
  );
}

export function useLiveCueCoordinator(): LiveCueCoordinatorValue | null {
  return useContext(LiveCueCoordinatorContext);
}
