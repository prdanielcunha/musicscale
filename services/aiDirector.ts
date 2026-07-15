import { auth } from './firebase';
import { entitlementsService } from './entitlementsService';

export interface SetlistIntelligence {
  healthScore: number;
  metrics: {
    fluidez: number;
    energia: number;
    tonalidade: number;
    repeticao: number;
    equilibrio: number;
  };
  feedback: string;
  suggestions: { type: string; text: string }[];
  learningInsight: string;
}

export const aiDirectorService = {
  async analyzeSetlist(songs: any[], organizationContext?: any): Promise<SetlistIntelligence> {
    const storedLang = localStorage.getItem('millionsnest_i18n_lng') || 'pt';
    const baseLang = storedLang.split('-')[0].split('_')[0].toLowerCase();

    if (!songs || songs.length === 0) {
      let feedback = "Adicione músicas para a inteligência artificial analisar a fluidez.";
      if (baseLang === 'en') {
        feedback = "Add songs so the artificial intelligence can analyze the flow.";
      } else if (baseLang === 'es') {
        feedback = "Agregue canciones para que la inteligencia artificial analice el flujo.";
      }
      return {
        healthScore: 0,
        metrics: { fluidez: 0, energia: 0, tonalidade: 0, repeticao: 0, equilibrio: 0 },
        feedback,
        suggestions: [],
        learningInsight: ""
      };
    }

    // Gating check
    if (organizationContext?.id) {
      try {
        const ents = await entitlementsService.fetchEntitlements(organizationContext.id);
        if (!ents.features.aiSetlistInsights) {
          throw new Error("Recurso bloqueado. O plano atual de seu ministério não possui acesso para Inteligência Artificial / Insights. Faça upgrade para Pro no MillionsNest.");
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("Recurso bloqueado")) {
          throw e;
        }
        console.warn("[aiDirectorService] Entitlements fetch failure during gatecheck, proceeding:", e);
      }
    }

    try {
      const response = await fetch('/api/ai-analyze-setlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ 
          songs, 
          organizationContext,
          language: baseLang,
          orgId: organizationContext?.id
        })
      });

      if (!response.ok) {
         throw new Error("Failed to analyze setlist");
      }

      const data = await response.json();
      return data.result;
    } catch (e) {
      console.error("AI Director Error", e);
      throw e;
    }
  }
};
