# Regras Obrigatórias para Agentes de IA

Este documento contém regras fundamentais, inegociáveis e serve como manual operacional permanente para qualquer agente de inteligência artificial (como OpenAI Codex, Gemini ou equivalentes) operando no repositório **MusicScale**. O não cumprimento destas regras resultará em bloqueio da tarefa ou falha na integração.

## 1. Project Purpose
O **MusicScale (music-scale-manager)** é uma aplicação PWA offline-first focada em gestão de ministérios de louvor, parte do ecossistema e hub central de usuários chamado **MillionsNest**. Fornece interfaces para escalas musicais, biblioteca de repertórios, visualizador ao vivo de cifras, além de gestão de presença e integrações de IA musical.

## 2. Mandatory Reading
Antes de executar qualquer modificação, o agente DEVE incondicionalmente:
1. Ler este `AGENTS.md`;
2. Ler o arquivo `README.md`;
3. Verificar a documentação arquitetural no arquivo `/docs/ARCHITECTURE_CURRENT.md` e os protocolos de IA em `/docs/AI_CHANGE_PROTOCOL.md`;
4. Localizar a implementação existente na base do código;
5. Verificar os testes relacionados;
6. Somente depois intervir ou alterar o código fonte.

## 3. Source of Truth
No caso de conflito, siga a seguinte prioridade (do mais alto para o mais baixo):
1. Testes de segurança E2E e Vitest (`/tests/`);
2. Comportamento já implementado em código funcional;
3. Documentação arquitetural (`/docs/ARCHITECTURE_CURRENT.md`);
4. Regras do Firebase Security (`firestore.rules`).
*Sempre investigue se o código é intencional antes de refatorar.*

## 4. Architecture Overview
* **Frontend:** SPA PWA operada via Vite + React 19 + TailwindCSS v4.
* **Backend:** Express Server acoplado em `server.ts`.
* **Banco:** Firebase Cloud Firestore distribuído (offline-first).
* **Autenticação:** Firebase Auth e contexto Hub/MillionsNest.
* **Autorização:** Validada e persistida via Firestore Security Rules; não dependa cegamente do payload enviado pelo Frontend.

## 5. Critical Architectural Boundaries
* **Multi-tenant (Organizations):** Todo documento sensível reside e é validado na sub-árvore do `organizationId`. A segurança das `firestore.rules` proíbe o vazamento de locatários. É terminantemente proibido tentar criar *bypasses* (como hardcoding de UIDs).
* **Entitlements e Billing:** Operações financeiras nascem e morrem na Stripe, vinculadas e verificadas via `server.ts` e `firestore.rules`.
* **Segredos e IA:** A API da Inteligência Artificial (Google Gemini e afins) não existe na Web/Frontend. Todo tráfego de chaves confidenciais obrigatoriamente passa pela camada Node (backend `server.ts`).

## 6. Development Principles
* **Escopo Estrito:** Mantenha suas alterações apenas no que foi expressamente solicitado. Não faça refatorações de perfumaria, reordenações cosméticas ou correções oportunistas que quebrem os contratos de testes atuais.
* **Mobile First:** Preservar a experiência responsiva em todas as entregas e alterações usando as predefinições utilitárias do TailwindCSS.
* **Idiomas:** Toda string legível adicionada deve suportar internacionalização. Utilize a base já existente do `react-i18next`.

## 7. Repository Structure
* `/components/`: Componentes visuais.
* `/pages/`: Componentes de escopo de rotas.
* `/services/`: Pontes de conexão para o Firebase e recursos web locais (PWA, IndexedDB).
* `/tests/`: Raiz de QA do software contendo unit tests e End-To-End (E2E) em Playwright.
* `/docs/`: Manuais e especificações.
* `server.ts`: Raiz do Backend Node.js.

## 8. Commands
Você deve validar as implementações usando os comandos de desenvolvimento existentes:
* **Install:** `npm install`
* **Development:** `npm run dev`
* **Typecheck (Lint):** `npm run lint`
* **Tests (Unitários):** `npm run test:ui`
* **Build:** `npm run build`
* **Testes Extensivos/Integração:** `npm run test:e2e` ou `npm run test:release`

*NÃO invente comandos adicionais que não constem no `package.json` real.*

## 9. Testing Requirements
Nenhuma tarefa deve ser finalizada se houver introdução de quebras ou se dependências críticas forem ignoradas. Para alterações significativas:
1. Execute `npm run lint`;
2. Execute o Build: `npm run build`;
3. Se tocar na área afetada por eles, acione o `npm run test:release` ou testes diretos mapeados.

## 10. Definition of Done
Sua alteração é considerada concluída quando:
* O escopo do pedido principal estiver finalizado;
* O comportamento incidental alheio estiver mantido (sem alterações fantasmas);
* Testes/Lint passarem, se executados;
* Você fornecer um relatório que descreve arquivos alterados e confirmados.

## 11. Security Rules
* NUNCA adicione segredos, JWTs, Stripe Tokens, ou API keys em qualquer documentação ou arquivo exposto.
* NUNCA crie `.env` em repositório rastreado, preserve o `.env.example`.
* NUNCA modifique a lógica do `server.ts` para abrir rotas cegas que driblem checagem de autorização baseada em tokens / cookies.

## 12. Environment Variables
Veja o `.env.example` para referências. Variáveis client side começam com `VITE_`. Todo o restante fica no servidor Node. Jamais gere valores reais nesses arquivos na base do código.

## 13. Database and Persistence Rules
O Firestore é NoSQL mas possui uma topologia rigorosa (`collections` / `subcollections`).
* Não desidrate ou altere esquemas de salvamento sem alinhar ao `firestore.rules` associado.
* Dados prévios de produção existem. Pense na retro-compatibilidade dos modelos antigos.

## 14. Authentication and Authorization
Tudo inicia via `Firebase Auth` (gerenciado por MillionsNest).
* Para frontend, `contexts/AuthContext` (ou similares) fornece o usuário.
* Para backend e banco, o token é sempre revalidado (seja via Express Token Validation ou Firestore Rules).

## 15. Cross-Project Dependencies
O **MillionsNest** é o *Source of Truth* de Hub. Qualquer criação de novas roles, sistemas de faturamento independentes, planos próprios desvinculados do hub são expressamente proibidos nesta aplicação satélite. (Status: A VALIDAR sobre endpoint exato de sincronização de Auth/Sessão se houver dúvidas em alterações profundas).

## 16. UI / UX Rules
* Dark Premium / Visual focado e minimalista.
* Utilize `lucide-react` para os ícones.
* TailwindCSS utilitário sem incluir pacotes cosméticos adicionais não requisitados.
* Responsividade móvel total e controles via toques com espaçamentos otimizados (Mobile First & Desktop Excellent).

## 17. High-Risk Files and Areas
* `/firestore.rules`: Controla os acessos de todo o banco de dados. Um erro aqui destrói o Multi-tenant.
* `server.ts`: O pilar da comunicação backend e integração com Inteligência artificial, Stripes e Billing.
* `/services/firebase.ts` e afins: Núcleo das comunicações de socket/dados client.

## 18. Known Risks
* Operações no modelo do `firestore.rules` costumam quebrar testes unitários locais não atualizados adequadamente no Firebase Emulator.
* Modificações de Server ESM Modules para CommonJS no build (`esbuild`) requerem cautela quanto a *imports* absolutos e extensões dependentes.

## 19. Known Technical Debt
* (A VALIDAR) Testes end-to-end do Playwright dependentes fortemente das portas dinâmicas ou da performance do Firebase Emulator que podem sofrer em ambientes de CI pesados.

## 20. Change Discipline
* Evitar ampliação do escopo.
* Não apague comportamentos sem compreensão da real dependência dele para outros usuários.
* Altere no modo cirúrgico. Pequenos incrementos validáveis e funcionais.

## 21. Documentation Discipline
Qualquer grande alteração de banco, fluxo de Auth, novas dependências críticas ou variáveis de ambiente devem ser registradas atualizando os respectivos arquivos de `/docs`, `.env.example` ou `AGENTS.md`.

## 22. When Uncertain
Quando a solicitação não for clara, as regras do projeto forem conflitantes ou o teste indicar que você quebrou algo grave e não entender a origem:
* **NÃO CHUTE E NÃO INVENTE.** 
* Avalie os arquivos próximos e o histórico se possível, mas no limite informe ao usuário a divergência de forma explícita e pare para obter confirmações em vez de produzir arquitetura não funcional ou falsa.
