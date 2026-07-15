export class AssignmentNotificationFormatter {
  /**
   * Formats a notification title combining multiple functions based on their categories.
   */
  static formatTitle(functions: { name: string; category: string }[]): string {
    if (functions.length === 0) {
      return "Você foi escalado!";
    }

    const playFuncs = functions.filter(f => f.category === 'musical_instrument' && f.name.trim() !== '').map(f => f.name);
    const singFuncs = functions.filter(f => f.category === 'vocal' && f.name.trim() !== '').map(f => f.name);
    const serveFuncs = functions.filter(f => f.category === 'technical' && f.name.trim() !== '').map(f => f.name);
    const genFuncs = functions.filter(f => !['musical_instrument', 'vocal', 'technical'].includes(f.category) && f.name.trim() !== '').map(f => f.name);

    const parts = [];

    if (playFuncs.length > 0) {
      parts.push(`tocar ${this.joinWords(playFuncs)}`);
    }
    if (singFuncs.length > 0) {
      parts.push(`cantar no ${this.joinWords(singFuncs)}`);
    }
    if (serveFuncs.length > 0) {
      parts.push(`servir na ${this.joinWords(serveFuncs)}`);
    }
    if (genFuncs.length > 0) {
      parts.push(`como ${this.joinWords(genFuncs)}`);
    }

    if (parts.length === 0) {
      return "Você foi escalado!";
    }

    return `Você foi escalado para ${this.joinWords(parts, ' e ')}`;
  }

  private static joinWords(words: string[], separator: string = ' e '): string {
    if (words.length === 0) return '';
    if (words.length === 1) return words[0];
    const last = words.pop();
    return words.join(', ') + separator + last;
  }
}
