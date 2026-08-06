# Automação de QA (E2E)

## O que é testado
Esta infraestrutura valida as jornadas críticas do aplicativo MusicScale (Bootstrap, Dashboard, Escalas, Músicas, Notificações e Áreas Auxiliares) usando o Playwright. Ele interage com o aplicativo em um ambiente simulado de ponta a ponta.

## Como o CI funciona
O GitHub Actions dispara automaticamente a suíte `MS-QA-AUTO-01` em pushes para a branch `main` ou PRs para `production`. O workflow configura o Node, instala os navegadores do Playwright, inicia o Firebase Emulator (Auth e Firestore) e executa os testes localmente sem tocar nos dados de produção. 

## Como executar localmente
1. Certifique-se de ter instalado as dependências (`npm install`) e os navegadores do Playwright (`npx playwright install`).
2. Execute o comando:
   ```bash
   npm run test:e2e
   ```
   *Isto iniciará os emuladores do Firebase localmente e rodará o Playwright.*
3. Para ver o relatório HTML:
   ```bash
   npm run test:e2e:report
   ```

## Onde encontrar screenshots, vídeos e traces
Em execuções de CI, todos os relatórios, evidências visuais (screenshots `fullPage`), traces de depuração e vídeos (em caso de falha) são carregados como artefatos no final do Job. Eles estarão na página de Resumo da Execução no GitHub Actions nas pastas `playwright-report/` e `test-results/`.

## Limites conhecidos
- A simulação de tamanhos de dispositivos móveis é feita por emulação de viewport e user-agent, que cobre cenários essenciais (WebKit para iOS, Chromium para Android).
- A verificação no WebKit emulado ajuda a encontrar problemas visuais compatíveis com Safari, mas **não substitui** o teste físico em dispositivos iOS reais para comportamentos muito específicos do navegador nativo.

## Isolamento e Produção
Os testes **nunca** executam gravações nos bancos de dados de produção. Eles dependem inteiramente de dados sintéticos injetados através de `tests/e2e/helpers/globalSetup.ts` diretamente no Firebase Emulator, utilizando o projeto local (`demo-musicscale`).

## Como acrescentar nova jornada
1. Adicione um novo arquivo `.spec.ts` no diretório `tests/e2e/`.
2. Utilize o `test.beforeEach` para inicializar a sessão (geralmente autenticando o usuário).
3. Escreva testes pequenos, utilizando os ajudantes em `helpers/visualHelper.ts` (`captureFullPage`) para registrar a integridade do layout.
