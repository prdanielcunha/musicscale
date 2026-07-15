# Prompt Master: Landing Page MillionsNest

Este é o prompt perfeito. Você deve copiar o texto abaixo (entre as linhas tracejadas) e colar na sua outra sessão do AI Studio (ou qualquer outra IA de programação) onde você está criando o site `millionsnest.com`.

--------------------------------------------------------------------------------

**Role:** Atue como um Engenheiro Frontend Sênior (ex-Stripe/Vercel), Especialista em UX/UI Design e Copywriter Mestre em Conversão (CRO).

**Objetivo:** Criar uma Landing Page de altíssima conversão para a plataforma "MillionsNest" (uma suíte de soluções para dores ministeriais de igrejas). O primeiro e principal produto de destaque na página é um "App de Gestão de Ministérios de Louvor" (Escalas, Cifras, Letras e Equipe).

**Diretrizes de Design e Stack (OBRIGATÓRIO):**
1. **Stack Técnica:** React 18+, Vite, Tailwind CSS, `framer-motion` (para animações suaves de scroll e hover), e ícones do `lucide-react`.
2. **Identidade Visual (Premium SaaS):** Design incrivelmente polido, semelhante à Vercel, Linear ou Stripe. Use uma paleta de cores sofisticada (ex: fundo muito claro/branco no modo light, ou um Dark Mode elegante com acentos em Indigo/Azul (trust/confiança) e Dourado/Amarelo (destaque/conversão)).
3. **Tipografia:** Use "Inter" ou "Plus Jakarta Sans" para um visual moderno e limpo.
4. **Clean & Glassmorphism:** Use efeitos sutis de blur (backdrop-filter), bordas finas (border-gray-200/border-white/10) e sombras perfeitamente difusas. Evite designs "quadradões" ou pesados. Tudo deve respirar.

**Estrutura da Landing Page (High-Conversion Flow):**

1. **Header/Navbar:** 
   * Logo simplificada "MillionsNest".
   * Links âncora: Funcionalidades, Preços, Dúvidas.
   * Botão de CTA contrastante: "Teste Grátis por 7 Dias".

2. **Hero Section (A Promessa & VSL):**
   * **Headline (H1):** "Organize seu Ministério de Louvor em Minutos, Não em Horas."
   * **Sub-headline:** "Chega de escalas no WhatsApp e cifras perdidas. A ferramenta definitiva para conectar músicos, organizar repertórios e focar no que importa: a adoração."
   * **CTA Duplo:** Botão Primário e pulsante ("Começar Teste Grátis de 7 Dias") e Botão Secundário ("Ver Demonstração").
   * **Espaço para VSL (Video Sales Letter):** Um mockup lindo de um vídeo (pode ser uma div simulando um player de vídeo moderno com um botão de play no centro), com uma sombra projetada bonita que parece saltar da tela. Pode usar um container com aspecto 16:9.

3. **Social Proof (Aprovação):**
   * Faixa sutil abaixo do Hero: "Junte-se a dezenas de líderes que já simplificaram suas rotinas." (Ícones de estrelas e rostinhos de usuários).

4. **Agitação da Dor (Contexto):**
   * Título: "Você não foi chamado para ser administrador de planilha."
   * Cards com as "dores" riscadas em vermelho e a nossa "solução" em verde com check. (Planilhas confusas ➔ Escalas Automáticas; PDF de cifras perdidos ➔ Banco Master no Celular).

5. **Funcionalidades (Bento Grid Layout):**
   * Use o moderno padrão "Bento Grid" (grade assimétrica) para destacar os recursos:
     * Card grande: Gestão de Escalas com Notificação.
     * Card médio: Visualizador de Cifras e Letras (Mobile-first).
     * Card pequeno 1: Transposição de Tom em 1 Clique.
     * Card pequeno 2: Sistema de Playlists/Repertórios.

6. **Pricing / Tabela de Preços (Foco em Volume):**
   * Toggle: Mensal / Anual.
   * **Plano Único (Ministério):** 
     * Mensal: R$ 19,90/mês.
     * Anual: R$ 197,00/ano (destaque: 2 meses grátis).
   * Benefícios com checks: Membros ilimitados, Músicas ilimitadas, App no Celular, Transposição.
   * **Call to Action de Vendas:** "Começar 7 Dias Grátis" (Informar que não precisa de cartão de crédito para testar).
   * **Sessão de Upsell / Addons ("Aceleradores"):** Logo abaixo dos planos, mostre uma seção de "Packs Prontos de Repertório" (Ex: Master Pack com 500 Cifras e Letras por pagamento único). Deixe claro que isso economiza meses de digitação.

7. **FAQ (Perguntas Frequentes):**
   * Acordeão simples (use Framer Motion para abrir e fechar).
   * Perguntas: "Preciso cadastrar cartão agora?", "E se eu já tiver minhas músicas?", "Funciona no celular na hora do culto?", "Como cancelo?".

8. **Footer (Rodapé):**
   * Logo MillionsNest.
   * Frase: "Criando soluções para líderes."
   * Links para Termos de Uso, Privacidade, Contato.

**Instruções de Implementação:**
* Escreva o código completo da página em `App.tsx` (ou divida em componentes de forma lógica se preferir).
* Não crie arquivos CSS separados para estilos. Use EXCLUSIVAMENTE Tailwind classes.
* Implemente TODO o fluxo de responsividade (deve ser impecável e maravilhoso no mobile, já que músicos e líderes usarão no celular).
* Coloque placeholders lógicos para os botões de ação que no futuro direcionarão para `app.millionsnest.com/registro` ou para links do Stripe/Kiwify.

Gere o código com o máximo de refinamento visual e técnicas de conversão.

--------------------------------------------------------------------------------
