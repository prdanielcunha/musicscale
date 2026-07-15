import { auth } from './firebase';
import { entitlementsService } from './entitlementsService';

export interface AISongSuggestion {
    id?: string;
    title: string;
    artist: string;
    reason: string;
    recommendedKey: string;
}

export const aiSuggestionService = {
  async getSuggestions(currentSongs: any[], librarySongs: any[], context?: any): Promise<AISongSuggestion[]> {
    // Check limits on MillionsNest
    if (context?.id) {
      try {
        const ents = await entitlementsService.fetchEntitlements(context.id);
        if (!ents.features.aiSuggestions) {
          throw new Error("Recurso bloqueado. O plano atual de seu ministério não possui acesso a Inteligência Artificial / Sugestões. Evolua para Pro no MillionsNest.");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("Recurso bloqueado")) {
          throw e;
        }
        console.warn("[aiSuggestionService] Entitlements fetch failure during suggestions gatecheck:", e);
      }
    }

    try {
      const storedLang = localStorage.getItem('millionsnest_i18n_lng') || 'pt';
      const baseLang = storedLang.split('-')[0].split('_')[0].toLowerCase();

      const response = await fetch('/api/ai-suggest-songs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ 
          currentSongs, 
          librarySongs, 
          context,
          language: baseLang,
          orgId: context?.id
        })
      });

      if (!response.ok) {
         const errBody = await response.text();
         console.error("AI suggest failed with body:", errBody);
         throw new Error("Failed to get suggestions: " + errBody);
      }

      const data = await response.json();
      return data.suggestions || [];
    } catch (e) {
      console.error("AI Suggestions Error", e);
      return [];
    }
  }
};
