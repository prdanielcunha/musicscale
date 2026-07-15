import React, { createContext, useContext, ReactNode } from 'react';
import type { Suggestion } from '../types';
import { useSuggestions } from '../hooks/useSuggestions';

interface SuggestionContextType {
  suggestions: Suggestion[];
  loading: boolean;
  error: string | null;
  refreshSuggestions: () => Promise<void>;
}

const SuggestionContext = createContext<SuggestionContextType | undefined>(undefined);

export const SuggestionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const suggestionData = useSuggestions();
  
  return (
    <SuggestionContext.Provider value={suggestionData}>
      {children}
    </SuggestionContext.Provider>
  );
};

export const useSuggestionsContext = (): SuggestionContextType => {
  const context = useContext(SuggestionContext);
  if (context === undefined) {
    throw new Error('useSuggestionsContext must be used within a SuggestionProvider');
  }
  return context;
};