import React, { createContext, useContext, ReactNode } from 'react';
import type { Scale, EventType, Location, PopulatedScale, EventName, Tag, PopulatedSong, Role, Instrument, BandScale, PopulatedBandScale, UserProfile, FixedBandScale } from '../types';
import { useMusicData, type UsersStatus } from '../hooks/useMusicData';

interface MusicDataContextType {
  songs: PopulatedSong[];
  scales: Scale[];
  populatedScales: PopulatedScale[];
  bandScales: BandScale[];
  populatedBandScales: PopulatedBandScale[];
  eventTypes: EventType[];
  locations: Location[];
  eventNames: EventName[];
  tags: Tag[];
  roles: Role[];
  instruments: Instrument[];
  allUsers: UserProfile[];
  usersStatus: UsersStatus;
  fixedBandScales: FixedBandScale[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const MusicDataContext = createContext<MusicDataContextType | undefined>(undefined);

export const MusicDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const musicData = useMusicData();
  
  return (
    <MusicDataContext.Provider value={musicData}>
      {children}
    </MusicDataContext.Provider>
  );
};

export const useMusic = (): MusicDataContextType => {
  const context = useContext(MusicDataContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicDataProvider');
  }
  return context;
};
