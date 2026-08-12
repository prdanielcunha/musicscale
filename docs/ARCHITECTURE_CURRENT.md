# Arquitetura Atual do MusicScale

## 1. Nome e Responsabilidade do Aplicativo
**Nome:** MusicScale (ou music-scale-manager)
**Responsabilidade:** Plataforma SaaS para gestão de ministérios de louvor, oferecendo gestão de repertório, escalas de banda e programação, visualizador para performance ao vivo (letras, cifras, auto-scroll e BPM), bem como um repositório central de músicas (Biblioteca Viva).

## 2. Responsabilidade dentro do ecossistema MillionsNest
O MusicScale atua como aplicativo satélite integrado à **MillionsNest**. 
A MillionsNest é o hub central de faturamento, autenticação, locatário (Organização) e definição de papéis globais. O MusicScale se responsabiliza estritamente pela operação musical: dados, funções de banda e escalas, aplicando restrições atreladas às assinaturas definidas pelo Hub.

## 3. Stack Real
- **Frontend:** React, React Router, Vite, Tailwind CSS (@tailwindcss/vite), Motion (Framer Motion).
- **Backend:** Node.js (via Express integrado no Vite e standalone), Firebase Auth, Cloud Firestore, Firebase Admin Node.js SDK.
- **Tipagem:** TypeScript.
- **PWA/Offline:** vite-plugin-pwa, idb, dexie, workbox-window.
- **Inteligência Artificial:** @google/genai (chamado exclusivamente via Server).

## 4. Versões Principais
*Extraídas do `package.json`:*
- `react`: ^19.2.0
- `react-dom`: ^19.2.0
- `express`: ^5.2.1
- `firebase`: ^12.4.0
- `firebase-admin`: ^13.8.0
- `typescript`: ~5.8.2
- `vite`: ^6.2.0
- `tailwindcss`: ^4.3.0

## 5. Estrutura Principal de Diretórios
- `/components/`: Componentes visuais React divididos por domínio (scales, songs, layout, admin, library, etc).
- `/contexts/`: Providers base do app (AuthContext, MusicDataContext, ModalContext, EcosystemContext).
- `/docs/`: Documentações do projeto (Protocolos e Arquitetura).
- `/hooks/`: Custom hooks locais do React (useMusicData, useFeatureFlag, etc).
- `/lib/`: Funções utilitárias e constantes.
- `/locales/`: Dicionários de internacionalização (`pt.json`, `en.json`, `es.json`).
- `/pages/`: Rotas/Telas visuais do SPA.
- `/services/`: Integrações com o Firebase (firebase.ts, firestoreService.ts) e proxies de API local.

## 6. Entrypoints Frontend
- `index.html`: Base da estrutura DOM.
- `index.tsx`: Ponto de montagem e bootstrap do React App.
- `App.tsx`: Definição e roteamento (React Router) central da aplicação.

## 7. Entrypoints Backend
- `server.ts`: Configuração e instanciamento do Express.js, atuando tanto em dev (integrado por middleware vite) quanto em prod (compilado).
- Endpoints montados sob o prefixo `/api/*` e expostos ou roteados.

## 8. Rotas Frontend
*Verificadas em `App.tsx`:*
- `/login`, `/join`, `/start`: Rotas públicas/Gateway.
- `/`: Dashboard primário.
- `/songs`, `/chords`, `/lyrics`: Gestão e visualização de repertório.
- `/band`, `/users`, `/roles`: Gerenciamento de equipe e permissões.
- `/scales`, `/scales/:scaleId`: Visualização e edição de agendamentos de eventos.
- `/band-scales`, `/band-scales/:scaleId`: Agendamentos de bandas/instrumentistas.
- `/database`: Configurações e cadastros locais da organização.
- `/library`: Visualização da Biblioteca Viva (músicas globais).
- `/curation`, `/curation/:candidateId`: Rotas reservadas por `GlobalCurationProtectedRoute`.
- `/plans`, `/plan-usage`: Gerência de planos lendo dados externos.

## 9. Endpoints Backend
As rotas expostas configuradas com o Express em `server.ts` sob `/api`. *Detalhes não aprofundados na extração básica, porém conhecidos: Importação GenAI e processamentos críticos isolados.*

## 10. Contexts, Providers, Hooks e Serviços Principais
- `AuthContext`: Mantém a instância do usuário logado (via Firebase Auth).
- `EcosystemContext`: Recepciona os escopos e limites vindos da MillionsNest.
- `MusicDataContext`: Conecta e assina (via hooks) os dados das coleções de músicas da Organização Ativa.
- `useMusicData`: Principal hook consumindo os dados.
- `firebase.ts` e `firebaseAdmin.ts`: Clientes de acesso infraestrutural.

## 11. Fluxo de Autenticação
Baseado diretamente no **Firebase Authentication**. O estado é gerenciado no front pelo AuthContext. O token gerado do lado cliente é utilizado para autenticar requisições na API Express e diretamente nas consultas ao Firestore.

## 12. Resolução de Usuário
Ocorre por extração do `uid` no token ou recorde de autenticação. Os dados complementares do usuário ficam gravados nas coleções (`users`, `userProfiles`).

## 13. Resolução de Organização Ativa
O usuário opera de forma transacional e obrigatoriamente vinculada a um `organizationId`. Se o usuário possui vínculo em múltiplas organizações, há um conceito de organização "ativa", gerenciado muitas vezes no hub ou por variáveis do ecosystem context e perfil local.

## 14. Modelo Multi-tenant
Silo de dados lógico: Cada registro gravado (música, escala, membro) armazena uma string explícita `organizationId`. Todas as consultas front-end *DEVERIAM* (e backend via regras) validar restrições baseando-se nesse ID.

## 15. Papéis, Permissões e RBAC
- Permissões são validadas em `App.tsx` pelas rotas `ProtectedRoute` que avaliam strings de autorização.
- Exemplo de Roles/Permissões: `musicscale.performance.use`, `musicscale.members.manage`, `manageOrganization`.
- O papel interno da organização mapeia as habilidades administrativas e operativas.

## 16. Diferença entre Papéis (Globais, Organizacionais e Operacionais)
- **Papel Global:** Ex: `owner` macro da MillionsNest (que deve ter capacidade plena implícita no App).
- **Papel Organizacional (`organizationRole`):** Hierarquia interna na organização logada (Ex: Administrador, Membro).
- **Função Operacional / Ministerial:** Capacidade não hierárquica atrelada ao músico (Ex: Baterista, Vocal, Líder de Louvor).

## 17. Coleções e Subcoleções Firestore Referenciadas
- `users` / `userProfiles`
- `organizations` / `organization_members`
- `songs` (músicas da organização)
- `globalSongs` (Biblioteca viva / catálogo macro partilhado)
- `scales` (Eventos macro)
- `bandScales` (Detalhes dos instrumentistas)
- `eventTypes`, `tags`, `instruments`, `locations`
- `monthly_usage`

### Projeção de perfil interno MusicScale

`organizations/{orgId}/musicscale_members/{uid}` armazena exclusivamente a atribuição tenant-scoped de função e perfil musical (`roleId`, `musicscaleRole`, `ministryFunction` e `specialtyIds`). A membership canônica em `organizations/{orgId}/members/{uid}` continua sendo usada para provar membership e resolver `organizationRole`, mas não recebe novos writes desses campos específicos do MusicScale. Leituras mantêm fallback temporário para campos legados tenant-bound; novos writes de perfil interno passam por endpoint autenticado e convergem somente para a projeção.

### Convites canônicos do Hub

Novos convites são criados e aceitos exclusivamente pela API canônica do MillionsNest Hub, por meio do adapter server-side do MusicScale configurado por `MILLIONSNEST_HUB_ORIGIN`. O adapter encaminha apenas o Firebase Bearer do usuário e sempre solicita a membership Hub `member`; a função ministerial escolhida fica separada em `organizations/{orgId}/musicscale_invite_role_intents/{sha256(email normalizado)}` e, após aceite canônico, é aplicada somente à projeção `musicscale_members`.

Links novos usam `/join/{organizationId}?token=...`. Tokens brutos são somente transitórios na chamada e na URL: não são persistidos nem registrados. Não há mais criação de convite anônimo pelo Profile; o CTA encaminha ao fluxo de e-mail e função em Users.

O endpoint de aceite tenta o Hub primeiro. O fallback temporário para os antigos `invites/{id}` e `organizations/{orgId}/invites/{id}` só é elegível após `404` com `INVITE_NOT_FOUND`; indisponibilidade, timeout ou qualquer outro resultado falham fechados. Ainda dependem de fases posteriores os join requests, remoção de membros, atualização de `organizationRole` e hardening final das Rules.

## 18. Firestore Rules Encontradas
Baseadas em `firestore.rules` (vistas na leitura inicial):
- Regras bloqueando leituras gerais não autorizadas.
- Regras parametrizadas usando paths robustos com `match` em `/organizations/{orgId}`, `/songs/{songId}`, `/globalSongs/{id}`, garantindo leitura apenas do seu tenant validando os claims do Auth Token contra o ID de organização assinado/pertencente.

## 19. Cloud Functions / Triggers
A presença da dependência `firebase-functions` no repositório atesta funções em nuvem que servem o ecossistema. Existem referências do Github Actions com workflows de deploy (`deploy-firebase-functions.yml`).

## 20. Integrações com MillionsNest
O MusicScale importa as definições de faturamento, capacidades e metadados vindos do ecosistema por meio do acesso às mesmas árvores de dados do Firestore sob as coleções da MillionsNest (Organizações, Faturamento, etc). O Hub hospeda as regras comerciais Stripe.

## 21. Billing, Assinaturas e Entitlements
Planos: `Starter`, `Advanced`, `Pro`.
Estes controlam as "Feature Gates", bloqueando acesso à Library global e integração IA caso o plano associado àquela organização seja insatisfatório. A validação real precisa estar atada ao backend de forma a não poder ser violada no DOM do cliente.

## 22. Integrações Externas
- Stripe SDK (referenciado, mas leitura primária; pagamentos não devem ser reprocessados pelo MusicScale).
- @google/genai (LLMs para processamento textual avançado musical).

## 23. Variáveis de Ambiente Utilizadas
*NÃO VERIFICADO OS VALORES - Somente a detecção base de chaves possíveis atreladas ao funcionamento.*
Baseado nas tecnologias contidas: `GEMINI_API_KEY`, variáveis padrões de client web (como keys do Firebase) seriam aguardadas em um arquivo env.

## 24. Comandos Reais Encontrados
Disponíveis no `package.json`:
- Desenvolvimento: `npm run dev` (roda o server local via `tsx`).
- Lint/Typecheck: `npm run lint` (executa `tsc --noEmit`).
- Build: `npm run build` (acopla vite build da interface e pacote ESBuild pro server api).
- Start de Produção: `npm run start` (Roda via node o arquivo empacotado compilado).
- Deploy frontend via github/Vercel (Baseado na existência do `vercel.json`).

## 25. GitHub Actions
Identificados dentro de `.github/workflows`:
- `deploy-firebase-functions.yml`
- `deploy-firestore-indexes.yml`
- `deploy-firestore-rules.yml`

## 26. Configuração Vercel Encontrada
- Existe um `vercel.json` no repositório.
- A configuração aponta o comportamento da Proxy para o servidor standalone na vercel:
  - O path `/api/(.*)` é roteado para o destination `/api/index.ts` (API backendless).
  - Outros arquivos para o frontend estático SPA `/index.html`.

## 27. Fluxos Críticos de Dados
- Gravação de uma nova música: Proteção para não inserir dados na Org A por usuário da Org B.
- Geração da IA: Não confiar em campos abertos e sanitizar os BPMs fornecidos pelo GenAI.
- Clonagem / Importação da Biblioteca Viva `globalSongs` para `songs` locais.

## 28. Áreas de Alto Risco para Regressão
- Tela de configurações locais do Banco Interno (adicionar/remover/editar tags e eventos).
- Compatibilidade e exibição correta de papéis superiores do Owner MillionsNest dentro do App.
- Validação e segurança de Tenant (vazar músicas entre congregações ou times).
- Bloqueio incorreto da aplicação baseada em limitações de usuários Starter.

## 29. Dívidas Técnicas Comprovadas
- Uso excessivo de modais fixos em dispositivos celulares/móveis prejudicando a rolagem ou resultando em Layout Shift.
- Validação pendente para as mecânicas de limite da biblioteca viva em respostas longas de timeout (que exigem tratamentos limpos de falha/Loading spinners suspensos).

## 30. Código ou Estruturas Legadas
NÃO VERIFICADO.

## 31. Informações Conflitantes
- Existem scripts auxiliares (`fix.js`, `patch*.cjs`, etc.) na raiz que indicam manipulação isolada por comandos imperativos e possivelmente indicativos de manutenção e correções em massa temporárias.

## 32. Informações não Verificadas
- Eficiência e cobertura total do sistema offline (PWA) e do cache Workbox local.
- Todas as variáveis secretas operacionais.
- Qualidade integral de conversão do auto-scroll na tela visualizadora em dispositivos heterogêneos.
