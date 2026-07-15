# DOCUMENTAÇÃO COMPLETA MUSICSCALE (ESTADO ATUAL)

Esta documentação serve como fonte de verdade sobre a arquitetura, regras de negócio, relação de ecossistema, fluxo de dados e estado geral do aplicativo **MusicScale**.

## SUMÁRIO
1. [Visão Geral do MusicScale](#1-visao-geral-do-musicscale)
2. [Estado Atual Real do MusicScale](#2-estado-atual-real-do-musicscale)
3. [Relação entre MusicScale e MillionsNest](#3-relacao-entre-musicscale-e-millionsnest)
4. [Arquitetura do MusicScale](#4-arquitetura-do-musicscale)
5. [Stack Técnica do MusicScale](#5-stack-tecnica-do-musicscale)
6. [Estrutura de Arquivos do MusicScale](#6-estrutura-de-arquivos-do-musicscale)
7. [Modelo de Dados Firestore](#7-modelo-de-dados-firestore)
8. [Planos e Feature Gates no MusicScale](#8-planos-e-feature-gates-no-musicscale)
9. [Biblioteca Viva](#9-biblioteca-viva)
10. [IA do MusicScale](#10-ia-do-musicscale)
11. [Repertório de Músicas](#11-repertorio-de-musicas)
12. [Escalas](#12-escalas)
13. [Escalas de Banda e Funções Musicais](#13-escalas-de-banda-e-funcoes-musicais)
14. [Performance Mode / Live Worship](#14-performance-mode--live-worship)
15. [Banco de Dados Interno](#15-banco-de-dados-interno)
16. [Perfil do Usuário](#16-perfil-do-usuario)
17. [Usuários, Convites e Roles](#17-usuarios-convites-e-roles)
18. [Design System e UX/UI do MusicScale](#18-design-system-e-uxui-do-musicscale)
19. [Offline / PWA](#19-offline--pwa)
20. [Internacionalização](#20-internacionalizacao)
21. [Segurança](#21-seguranca)
22. [Logs, Analytics e Diagnóstico](#22-logs-analytics-e-diagnostico)
23. [Bugs Conhecidos e Histórico](#23-bugs-conhecidos-e-historico)
24. [Roadmap do MusicScale](#24-roadmap-do-musicscale)
25. [Regras para Futuras IAs e Programadores](#25-regras-para-futuras-ias-e-programadores)
26. [Exemplos de Código e Pseudocódigo](#26-exemplos-de-codigo-e-pseudocodigo)
27. [Checklist de Confirmação Técnica no Código](#27-checklist-de-confirmacao-tecnica-no-codigo)
28. [Resumo para Agentes de IA](#28-resumo-para-agentes-de-ia)

---

## 1. VISÃO GERAL DO MUSICSCALE

O **MusicScale** é o primeiro aplicativo oficial conectado ao ecossistema MillionsNest. Ele foi criado especificamente para ministérios de louvor organizarem:
- Repertório contínuo de adoração
- Músicas, letras e cifras
- Tons originais e selecionados
- BPM e métricas musicais
- Escalas semanais e eventos
- Escalas de banda (músicos, ministros)
- Biblioteca Viva (acervo global compartilhado)
- Performance ao vivo (Visualizador de palco e auto-scroll)
- Importação Inteligente (IA)
- Rotina geral do ministério

**Objetivo Central:** 
O aplicativo deve reduzir a complexidade operacional do ministério de louvor, permitindo que a equipe foque na ministração.

**A Filosofia:** 
A interface deve ser discreta e funcional. Tudo deve convergir para o momento do culto, sem competir visualmente com a execução musical.

**O que o MusicScale NÃO é:**
- ERP de igreja ou sistema de gestão financeira.
- Chat corporativo ou rede social interna.
- Player de áudio completo ou plataforma de streaming (como Spotify).
- CRM religioso ou sistema de cuidado de membros.
- Plataforma genérica de gestão de projetos.

**O que o MusicScale DE FATO é:**
- Aplicativo SaaS com design organizado e focado na operação ministerial.
- Gestor centralizado de repertório, músicos e escalas.
- Ferramenta de leitura de palco (Performance Mode).
- Apoio visual e seguro para líderes, músicos e vocais.

---

## 2. ESTADO ATUAL REAL DO MUSICSCALE

**Status de Ciclo de Vida:** Beta funcional / MVP SaaS Avançado em fase de refinamento visual, estabilidade e usabilidade.

**O que já está implementado (Backend + Frontend):**
- Dashboard contendo métricas e atalhos.
- Repertório (CRUD de Músicas).
- Estruturação de letras, cifras, tons, BPM, tags.
- Status da música (Ativa/Inativa etc).
- Escalas de repertório (foco no setlist).
- Escalas de Banda (foco nos integrantes e funções).
- Músicos, Funções Musicais (Papéis ministeriais).
- Gestão de Usuários e permissões internas do aplicativo.
- Banco de Dados interno de cadastros (Tipos de evento, Locais, Nomes de evento, Instrumentos, Tags).
- Biblioteca Viva (pesquisa e listagem base).
- Importação da Biblioteca Viva integrada aos limites do plano.
- Limites por plano (Starter, Advanced, Pro).
- IA para importação estruturada de músicas.
- Performance Mode com cifras, letras e transposição.
- Compartilhamento de escala (exportação).
- Perfil de usuário configurável.
- Resumo de plano/uso e status da assinatura.
- Integração de contexto via MillionsNest.
- Autenticação e isolamento lógico (Multi-tenancy) no Firebase.
- Estrutura responsiva, visual Dark.

**O que está em refinamento:**
- UX Mobile: Navegação e toque, menus inferiores (bottom sheets), evitar modais em tela cheia sem rolagem.
- Telas de detalhes da Escala: Remover excesso de elementos de navegação, focando na visualização clara.
- Banco de Dados Interno: Correção de permissões para garantir adição, edição e remoção fidedigna pelo líder/admin.
- Inteligência Artificial: Ajustes no importador para manter o BPM como `null` ou não preenchido caso seja desconhecido, e refinar a detecção de transposição.
- Correta exibição de Papéis: O criador do tenant (Owner) precisa figurar com distinção clara de Administrador, não apenas "Membro".
- Limites e UX da Biblioteca Viva: Garantir feedback visual assertivo durante importações para evitar múltiplas chamadas sem resposta.
- Overflows e Layout shifts: Garantir que botões e textos em dispositivos móveis respeitem as margens.
- Estabilidade de operações de gravação e tratamento de erros.
- Logs e Diagnósticos aprimorados.
- Sincronização avançada MillionsNest x MusicScale.

---

## 3. RELAÇÃO ENTRE MUSICSCALE E MILLIONSNEST

O ecossistema possui arquitetura baseada em microsserviços lógicos. **MusicScale e MillionsNest são projetos separados tecnicamente no AI Studio, mas se integram de forma direta.** 

- **MillionsNest** é o hub central de ecossistema, responsável pela governança financeira, autenticação unificada, faturamento (Stripe), definição do Tenant (Organização Ativa), planos globais e permissões macro.
- **MusicScale** é um aplicativo conectado, residente na mesma infraestrutura Google Cloud/Firebase. Ambos compartilham o mesmo banco de dados (Cloud Firestore) e módulo de autenticação (Firebase Auth).

**O que o MusicScale RECEBE / CONSOME da MillionsNest:**
- `uid`, `email`, `displayName` (Usuário Global logado).
- `organizationId`, `organizationName` (O Tenant ativo onde a sessão ocorre).
- `systemRole` (Papel global macro do usuário na MillionsNest - ex: owner).
- `organizationRole` (Papel local dentro do Tenant).
- `app access` / `capabilities` (Sinalização de que o usuário tem permissão de acessar o app).
- `subscriptionPlan` (Starter, Advanced, Pro).
- `subscriptionStatus` (active, past_due, trialing, null).
- `trialEndsAt`, `stripeCustomerId`, `stripeSubscriptionId`.
- `featureFlags` e escopo de aplicativos liberados.

**Responsabilidades Internas (Limitadas e Específicas) do MusicScale:**
- Exibir os dados contextuais da organização ativa.
- Isolar de forma segura AS MÚSICAS E ESCALAS exclusivas daquele `organizationId`. Uma organização não pode, em nenhuma hipótese, acessar dados de outra.
- Respeitar o plano ativo, limitando ações como Importações (Starter = bloqueado, Advanced = 10 mensais, Pro = ilimitado).
- Respeitar a assinatura e permissões locais, bloqueando ações não autorizadas (`canManageScales`, `canManageUsers`).
- Refletir papéis e habilidades musicais da banda.
- Oferecer uma via de retorno estruturada para o Hub (MillionsNest).
- **CRÍTICO:** NÃO processar pagamentos. NÃO duplicar faturamento (billing). O MusicScale não decide preço, ele apenas lê e aplica as restrições com base no plano imposto pela organização ativa.
- **CRÍTICO:** O Comprador/Owner Global não deve ser tratado internamente como um membro sem poderes. O papel de dono precisa se sobrepor ou igualar aos maiores níveis administrativos internos.

**Responsabilidades Puras da MillionsNest (Que impactam o MusicScale):**
- Checkout Stripe, webhooks, liberação de assinaturas, login unificado, criação e definição da organização, portal de faturamento e administração global.

---

## 4. ARQUITETURA DO MUSICSCALE

A aplicação utiliza o modelo Single Page Application (SPA) combinado com infraestrutura Backend-as-a-Service e Serverless (Firebase + Node.js Proxy).

**Diagrama de Fluxo - Escopo Lógico:**

```text
               Usuário
                  ↓
 [ Entrada via MusicScale URL direta ]  --------- ou -------- [ App Launcher da MillionsNest ]
                  ↓
  ( AuthContext / Organization Context / Ecosystem Context ) 
  ( Consome token do Firebase Auth, define OrganizationId ativo )
                  ↓
   [ Validação de usuário, organização, plano Stripe e permissões ]
                  ↓
    [ Feature Gates / Capability Restrictions Layer ]
                  ↓
     ( Pages e UI Components no Frontend React )
                  ↓
          [ Services / Hooks internos ]
                  ↓
  -----------------------------------------------
  |     FIREBASE AUTH / CLOUD FIRESTORE          |
  |  (Regras seguras baseadas em organizationId) |
  |  Express APIs (Node.js) para processamentos  |
  -----------------------------------------------
                  ↓
        [ Stripe via MillionsNest Backend ]
```

**Conceitos Chave da Arquitetura:**
- **SPA (React/Vite)**: Executável integral via cliente, garantindo navegação com transições responsivas de roteamento interno.
- **Context API Dinâmica**: Auth, Organização, Música. Sincronização central de estado para reagir rapidamente a mudanças de locatário (Tenant) e limites de usuário.
- **Cloud Firestore**: Armazenamento NoSQL. As coleções são divididas, operando estritamente sobre as regras de segurança (Firebase Security Rules) garantindo a correspondência entre a requisição e a afiliação do usuário.
- **Node.js Express / API Proxy**: Para rotas confidenciais (chaves de API do Gemini, importações organizacionais). A API Express é montada no servidor de desenvolvimento e distribuída pelo Vite no build de produção como um indexador consolidado via `esbuild`.
- **Isolamento e Segurança (Multi-Tenancy)**: As queries em banco exigem identificador obrigatório (`organizationId`), imposto e validado a nível de servidor.

---

## 5. STACK TÉCNICA DO MUSICSCALE

- **Frontend Core:** React 19 estruturado via Vite.
- **Tipagem:** TypeScript. Fundamental para proteger as defesas de estrutura vindas do Firestore.
- **Estilização e Interfaces:** Tailwind CSS com prefixos utilitários + `lucide-react` para iconografia e `motion` / `motion/react` (Framer Motion) para microinterações fluidas.
- **BaaS e Database:** Firebase Authentication e Cloud Firestore (Dados NoSQL). 
- **Ferramental Backend Integrado:** Node.js + Express (rotas hospedadas sob `/api/*`), com uso do SDK Firebase Admin Node.js.
- **Integração Externa (Leitura):** Stripe SDK (consumido restritamente em escopo seguro ou em endpoints para ler status vindos de webhooks primários).
- **Inteligência Artificial:** SDK `@google/genai` acessado no backend para preservar o segredo da variável `GEMINI_API_KEY`.
- **Internacionalização:** `i18next` em conjunto com `react-i18next`. PT-BR base nativo.
- **PWA e Cache:** Módulos instalados no pacote (`vite-plugin-pwa`, `workbox-window`, `dexie`, `idb`). Implementação base preparada e em refinamento.

**Consideração de Segurança:** Nenhuma chave secreta (Ex: Gemini API) é exposta no frontend. As chamadas são centralizadas na API interna.

---

## 6. ESTRUTURA DE ARQUIVOS DO MUSICSCALE

```text
/ (Raiz do projeto)
 ├── server.ts                    # Entrypoint Express Node.js (Proxy APIs, IA, integração com Vite middleware)
 ├── index.html                   # HTML base do SPA
 ├── package.json                 # Scripts e dependências
 ├── vite.config.ts               # Configurações do agrupador Vite
 ├── firestore.rules              # Políticas lógicas de segurança do Firestore
 ├── index.css                    # Entrada global para inicializar Tailwind
 │
 ├── src/                         
 │    ├── components/
 │    │    ├── admin/             # Visões de gerência
 │    │    ├── billing/           # Resumo limpo de assinatura/uso
 │    │    ├── library/           # Componentes atrelados à Biblioteca Viva
 │    │    ├── scales/            # Modais e visualizadores das escalas musicais
 │    │    ├── songs/             # Formulários de música e visualizadores
 │    │    └── layout/            # Estruturas da página (Sidebar, Mobile Nav)
 │    │
 │    ├── contexts/
 │    │    ├── AuthContext.tsx           # Provedor vital
 │    │    └── MusicDataContext.tsx      # Sincronização em tempo real de acervo
 │    │
 │    ├── hooks/
 │    │    └── useMusicData.ts           # Requisições locais no banco de dados Firestore
 │    │
 │    ├── locales/
 │    │    ├── pt.json, en.json, es.json # Traduções centralizadas
 │    │
 │    ├── pages/
 │    │    ├── DashboardPage.tsx         # Hub rápido musical
 │    │    ├── LibraryPage.tsx           # Biblioteca Viva View
 │    │    ├── SongsPage.tsx             # CRUD Repertório
 │    │    ├── ScalesPage.tsx            # Escalas programadas
 │    │    ├── DatabasePage.tsx          # CFG interno (Eventos/Tags)
 │    │    ├── ProfilePage.tsx           # Preferências de conta local
 │    │    └── ... 
 │    │
 │    ├── services/
 │    │    ├── ecosystem/types.ts        # Tipos compartilhados com a MillionsNest
 │    │    ├── firebase.ts               # Init client sdk
 │    │    └── firebaseAdmin.ts          # Init server sdk
 │    │
 │    └── types.ts                       # Tipagem TypeScript macro
```

---

## 7. MODELO DE DADOS FIRESTORE

Este é o esquema NoSQL estabelecido. **Regra intransponível:** O isolamento e consulta rigorosa por `organizationId`.

- **`organizations`** (Gerenciado pela MillionsNest):
  Contém ID local, status do plano, nome.
- **`organizations/{orgId}/members`** (Mapeamento de autorizações locais):
  Coleção ou subcoleção definindo papéis para cada membro, utilizando o `uid`.
- **`userProfiles` / `users`**:
  O perfil geral da pessoa (nome, foto, preferências globais).
- **`globalSongs`** (Coleção macro):
  Conhecida como "Biblioteca Viva". Contém as músicas aprovadas pelo sistema. Leitura permitida para quem tem o plano correto. A escrita pertence apenas ao painel administrativo.
- **`songs`** (Locais na organização):
  Repertório da equipe. Contém informações estruturais: ID próprio, `organizationId` [CRÍTICO], título, artista, notas musicais, letras (`lyrics`, `chords`), tons (`key`), `bpm`, `tagIds`, estado operacional (`status`).
- **`scales`** (Locais na organização):
  Setlists e definições do culto. Data, listas embarcadas ou referenciadas (músicas selecionadas), e responsável.
- **`bandScales`** (Locais na organização):
  A distribuição individual dos músicos e instrumentos, atada à organização.
- **`roles` / `eventTypes` / `locations` / `eventNames` / `tags` / `instruments`**:
  O "Banco de Dados Interno" com listas personalizadas para a organização alimentar seletores e métricas.
- **`audit_logs`** / `supportLogs`:
  Registros de atividades importantes da aplicação para rastreio seguro (exclusões ou importações).
- **`monthly_usage`**:
  Documento focado em consolidação mensal baseada em `YYYY-MM` e `organizationId`, para contar as importações (ex: limite de 10 usadas).

---

## 8. PLANOS E FEATURE GATES NO MUSICSCALE

O MusicScale aceita a autoridade de faturamento (billing) da MillionsNest e impõe de imediato no cliente ou no banco via requisições ao backend. Não devem existir contornos de front-end. O plano deve ser checado expressamente no backend antes da operação de uso da IA ou exportação da Biblioteca Viva.

**Planos Vigentes (Informacionais, definidos na interface local lendo da MillionsNest):**
1. **Starter (R$ 19,90/mês):** Organizador central. Limite: 10 membros. Músicas/Escalas: Ilimitadas. **Biblioteca Viva: BLOQUEADA** (o usuário vê a página restrita com destaque de benefício e botão de "Upgrade"). **IA: BLOQUEADA**.
2. **Advanced (R$ 29,90/mês):** Ferramental avançado. Limite: 20 membros. **Biblioteca Viva Limitada: 10 importações/mês**. Sem importação neural IA completa.
3. **Pro (R$ 34,90/mês promocional de lançamento, R$ 44,00/mês preço cheio):** Plano recomendado e completo. Membros Ilimitados. **Biblioteca Viva Ilimitada. IA Ilimitada.** Clonagem e personalizações estendidas.

**Comportamento UX dos Feature Gates:**
- O recurso bloqueado não deve ser escondido da interface de navegação, pois remove a visibilidade da ferramenta. Ele deve ser visível, oferecendo sempre indicações claras com CTAs (Call to Action) e a opção de Assinatura/Upgrade.
- Para limites contabilizados (Exemplo: Advanced com 10 importações), exibir o status do `monthly_usage` (Ex: "3 de 10 importações usadas este mês").

---

## 9. BIBLIOTECA VIVA

Serviço de valor estratégico do app, consistindo de um acervo compartilhado. A presença deste recurso dispensa recadastramentos maçantes de cifra e letra.

**Fluxo Funcional Esperado:**
1. Acesso à Biblioteca Viva via aba dedicada, em listagem otimizada.
2. Filtro e busca nos cartões de músicas.
3. O usuário seleciona ou aciona a importação direta.
4. Ao clicar "Importar":
   - Verificação Client (O limite de cota mensal foi excedido?). Em caso positivo, é apresentada o modal restrictivo de faturamento.
   - Requisição protegida à API (`/api/musicscale/library/import`).
   - O backend verifica e autoriza o Token, o plano e contagem base do locatário.
   - Clona os dados do documento localizados em `globalSongs` para `songs` preenchendo obrigatoriamente o `organizationId`.
   - Modais ou exibições de notificação de Sucesso/Erro.

**Problemas Conhecidos Historicamente & Requisitos de Solução:**
- Respostas suspensas (timeout): A interface necessitava refletir falhas em tempos de execução. Um botão não deve preservar o estado de "Salvando" indefinidamente se a conexão cair.
- Registros duplicados devem acender a proteção do sistema antes de repovoar a base sem critério.

---

## 10. IA DO MUSICSCALE

Recurso destinado ao ecossistema Pro, com foco em facilitação operacional por meio de LLM.
Responsabilidades do Motor de Engenharia GenAI:
- Receber textos cruzados e classificar estruturas para a construção de cifras limpas atadas à letra ("Smart Parser").
- Extrair Título, Artista, Tom detectado da música informada.
- **REGRA OBRIGATÓRIA (BPM):** Tentar detectar o BPM do compasso original com base na letra inserida e estrutura. **Se houver imprecisão, incerteza, ou caso falte dados explícitos, deverá ser mantido nulo (`null`) ou "não informado".** Nunca preencher o padrão arbitrário de BPM `120`. A IA não inventa dados para a organização.
- Marcar como "Revisão Recomendada" caso haja dúvidas ou baixa certeza sobre o Tom musical extraído.

**Segurança:** A chamada aos modelos da plataforma Google só pode ocorrer em arquitetura Servidor (backend Express) a fim de ofuscar as credenciais da aplicação e credenciais API, evitando injeções de cliente ou ataques via requisições front-end.

---

## 11. REPERTÓRIO DE MÚSICAS

A organização estruturada do acervo local.
Recursos e comportamentos:
- Exibição refinada baseada na interface padrão e tags.
- Status ativo/inativo atua desabilitando mas não promovendo perda histórica em cultos já consolidados caso os administradores optem pela pseudo exclusão.
- Presença obrigatória de marcações e componentes visuais de contraste: "Tom Atual" interligado ao "Tom Original".
- Limitação estrita da capacidade administrativa da aba para papéis de escopo (Ex: `canManageRepertoire`). Apenas este grupo pode gravar, inativar e salvar arranjos; o grupo base apenas visualiza acordes e detalhes.

---

## 12. ESCALAS

Sessão de programação local temporal; engloba datas e seleções das músicas para a gestão.
**Pontos de Refinamento Prioritários de UX:**
- Evitar longos modais no dispositivo celular sob o uso do "Date Picker" ou listas que transbordam horizontalmente o contorno. Priorizar que componentes abram menus fixos laterais ou inferiores baseados na interface do dispositivo ("Bottom Sheets", "Scroll Content Seguro").
- Limpeza visual: Remover o excesso de rodapés ou painéis desnecessários nas telas de leitura final.
- Ferramental de exportação que possibilite aos músicos o disparo programado e polido do conteúdo à lista de contatos do conjunto via Web Share API para a imagem estática compilada da ordem de culto.

---

## 13. ESCALAS DE BANDA E FUNÇÕES MUSICAIS

- Escalas de banda permitem mapear integrantes aos compromissos da rotina (Data/Hora) e associá-los ao contexto instrumental. 
- A **Função Ministerial** (por exemplo: Vocal, Dirigente, Bateria) é atribuída contextualmente e não governa nenhuma restrição administrativa da interface sistêmica. Os níveis de administrador (`organizationRole` e permissões de DB) não se confundem com as capacidades instrumentais.
- Os modelos e distribuições apoiam organizações que utilizem equipes com padrões fixos mensais ("Equipe 1").

---

## 14. PERFORMANCE MODE / LIVE WORSHIP

O estado destinado ao fluxo do músico executando a composição. O software deve se recolher e garantir máxima imersão.
- Foco em leitura ("Fullscreen") das cifras dispostas verticalmente ou letras isoladas ampliadas.
- Baseado essencialmente nas regras de High Contrast (cores escuras), inibindo que as telas do sistema iluminem de branco excessivo o locatário/usuários presentes, controlando com eficiência a distração ambiente.
- Automação via auto-rolamento baseado em tempo ou manipulação veloz para adequação rítmica.
- Transposição facilitada: Comutar acordes primários rapidamente no fluxo digital sem necessidade de salvar as alterações em base permanentemente durante a apresentação.

---

## 15. BANCO DE DADOS INTERNO

Página Administrativa de configurações organizacionais da unidade (Tipos de evento, Locais, Instrumentos, Categorias, Escalas Fixas e Tags do App).

**Bug Crítico Conhecido e Requisito Obrigatório:** 
Ocasionalmente, esta tela foi impedida de adicionar, editar e remover elementos para o próprio administrador devido a um desencontro de regras. O `owner`, `admin` ou `líder` autorizado precisa conseguir registrar ou customizar todos os cadastros iniciais da interface sem travamentos. O CRUD deve operar rigorosamente para papéis superiores de gestão local e ser inacessível para o membro base.

---

## 16. PERFIL DO USUÁRIO

Gerencia:
Predefinições, atributos transversais operacionais. 
Exibe e respeita na interface principal e menu lateral se a autoridade da pessoa decorre de papeis administrativos do ecossistema superior (Owner/Criador) com as prioridades visuais pertinentes. As preferências pessoais configuram tons por padrão e o catálogo principal de ferramentas tocadas pelo autor na instituição.

---

## 17. USUÁRIOS, CONVITES E ROLES

Módulo Intraestutural das organizações para convites a membros.
A liberação de acessos, por intermédio da habilitação administrativa em (`canManageUsers`), precisa respeitar de forma limpa as métricas dos faturamentos atuais do plano. Assinaturas limitadas a 10 integrantes no plano Starter inibem a inclusão do 11º usuário e disparam proativamente as janelas de comunicação da oferta/Plano Advanced. Modificações dos níveis locais refletem ativamente às permissões nas rotas SPA de forma indireta sem a quebra transacional à macro autorização Firebase.

---

## 18. DESIGN SYSTEM E UX/UI DO MUSICSCALE

**Padrão e Identidade Visual "Dark Premium":**
- Interface controlada na gama sombreada e polida (Cinza-noturno, Black), rejeitando excessos ofuscantes e exageros plásticos de backgrounds. Sombreamentos finos de caixas e controles elegantes no refinamento.
- **Tipografia:** Uso da fonte genérica `Inter` nas porções logísticas macro aplicacionais, utilizando em contraste as propriedades legíveis da `JetBrains Mono` onde elementos técnicos requeiram espaçamento de tabela (marcadores temporais, códigos de erro e painéis métricos ou cifras precisas).
- **Motion:** Fade Ins atenuados (`opacity`, `transform`) através da biblioteca Framer Motion (`motion/react` ou equivalente) variando a faixa em `0.3s`, garantindo a fluidez da percepção operacional sem parecer letárgica.
- Mobile First: Acessibilidade de controles sempre a distância do polegar principal do usuário se estiver utilizando smartphone ou tablet.

---

## 19. OFFLINE / PWA

O ecossistema prevê dependências compatíveis com suporte de Service Worker base para atuação Offline (`vite-plugin-pwa`, `workbox-window`, `dexie`, `idb`), marcados em fase de **"Pendente de confirmação no código atual" / Em refinamento.**
O objetivo prático para futuras implementações garantirá resiliências temporárias no tráfego local do dispositivo para o "Tempo de Escala/Culto" caso ocorra uma perda aguda do datacenter de acesso do wifi do templo, mantendo as informações base acessíveis.

---

## 20. INTERNACIONALIZAÇÃO

- Em funcionamento padrão global i18next (`pt-BR` fixado prioritariamente, provido adicionalmente por locales inglês/espanhol para painéis paralelos).
- A política recobre primariamente as sessões gerais de instrução na navegação do aplicativo, cabeçalhos, botões operacionais, erros lógicos ou informacionais emitidos ao músico.
- **RESTRIÇÃO METODOLÓGICA TÉCNICA:** Letras musicais inseridas em texto (cifras e conteúdos orgânicos gravados pelos músicos no Firebase) excluem-se expressamente ao módulo de translação dinâmica visando não distorcer as métricas das posições rítmicas nas partituras originais.

---

## 21. SEGURANÇA

Auditoria sistêmica e blindagem de comunicação operacional do app:
- O frontend envia todos os pedidos atrelados à cláusula mandamental de restrição `.where('organizationId', '==', currentUserOrgId)`. O backend de restrições das `firestore.rules` efetiva a segurança real para atestar a validade de pertencimento organizacional do documento alterado/solicitado.
- Nas chamadas executadas nas rotas do servidor do App `/api/*` em NodeJS/Express, o controle é delegado pelo JWT da instância do Firebase Auth (middleware próprio atestando autenticidade).
- É império das integrações reativamente vetar edições ou extrações sem permissão administrativa definida nos documentos de roles atrelados a interface e à API.

---

## 22. LOGS, ANALYTICS E DIAGNÓSTICO

- Registros sistêmicos são arquivados para monitoramento estrutural e possíveis diagnósticos e descredenciamentos no banco de logs.
- Eventos transacionais como (Criação Musical, Modificações de Escala, Compartilhamentos Operacionais e Importações das APIs Gemini e de Banco de Dados local) garantem o mapa operacional do suporte.
- Limitações transicionais no front-end são resguardadas nas camadas de Error Boundaries com objetivo de neutralizar eventuais quebras severas baseadas na interface limpa de "aviso preventivo ao administrador".

---

## 23. BUGS CONHECIDOS E HISTÓRICO

Catálogo contínuo formatado para observação operacional nas manutenções vigentes da codebase:
- **Painel Interno Bloqueado a Gestão:** Um impedimento na página do CRUD (Banco de Dados Interno) restringe usuários designados à liderança editarem ou formatarem cadastros da org. Correções mandatórias exigem pleno funcionamento da área se habilitados as regras certas para dono/owner/líder autorizado.
- **Cifrador Sintético por Automação (BPM Falso):** Detectada tendência da camada Generativa a definir `120 BPM` artificial e irreal em caso de não haver uma base confiável extraída do campo natural da letra colada na IA. Regras em aplicação impõem que o valor permaneça anulado/nulo nas respostas analíticas instáveis.
- **Sub-dimensionamento de Prioridade Proprietária:** Um Usuário centralizado ao sistema, dono macro e detentor de assinaturas MillionsNest que ao acessar o app da filial visualizava as limitações de interações de Cargo simples "Membro" base devido a confusão de níveis hierárquicos e não herança das super capacidades operacionais do Hub logado no app nativo local.
- **Estouro de Contorno Móvel (Layout Shift):** Modais do portal e Date Pickers estourando limites flexíveis (widths longos sobre as box borders) e ausência perene ao Scroll de listagens na visualização celular da montagem de Escalas. Requer padronização utilizando contêineres e definições "Max-Width".

---

## 24. ROADMAP DO MUSICSCALE

**FASE 1 — Estabilização Crítica e Fundacional (Atualmente em execução)**
- Resolutividade focada na estabilidade transacional, bugs operacionais do backend Express para importações de banco vivo, BPMs corretos e restrição adequada e perene aos donos e assinantes da plataforma perfeitamente visualizados pela base gerencial integrada. Correção das ações operacionais de base administrativa de CRUD.

**FASE 2 — Refinamento Computado (UX Nível Premium)**
- Aumentar o requinte de operações móveis do "Visualizador das composições em escalas em transito de leitura". Melhorar os carregadores e visuais informacionais nas áreas limpas de detalhamento logístico na Escala/Agenda. Dimensões operacionais de botões assertivos nos touch-points restritos.

**FASE 3 — Fase Experimental do Beta Físico**
- Realizações operativas e instrumentais junto aos coordenadores para estresse de rotinas com transposição automatizada por ritmo nos palcos; ensaiar perenamente as limitações móveis da plataforma nos setups atuais PWA Offline via rede isolada.

**FASE 4 — Lançamento Interligado à Instância MillionsNest**
- Faturamento sistêmico e operatividade global com tutoriais operacionais interligados; ativações estéticas de material informativo aos líderes musicais.

**FASE 5 — Expansão Transversal de Produto Interno**
- Analytics aprofundados baseados no histórico de composições ativas; identificação das frequências táticas no histórico e ferramentas integrativas.

---

## 25. REGRAS PARA FUTURAS IAs E PROGRAMADORES

1. **PRODUTO EM FOCO:** A identidade do aplicativo rege estabilidade para o momento vital ministerial nos encontros práticos. Reprimir o uso de exibições sobrecarregadas das telas de Dashboard puras empresariais se isso poluir ou tornar a visão turva. Mantenha os visualizadores com alta densidade contrastante e limpa.
2. **RESTRIÇÃO DA ORGANIZAÇÃO (TENANT):** Processamento cruzado requer a exigência integral do mapeamento com  `organizationId`. Fugas ou delegações omissas corrompem a camada local gerencial Multi-tenant imposta pelas diretrizes de base.
3. **RESPEITO AO FATURAMENTO:** Evite integrações alternativas do Stripe. O controle financeiro reside no plano recebido macro pelo Contexto do ambiente integrador.
4. **POLÍTICA DE APRESENTAÇÃO DE FEATURES (GATING):** Abster-se de invisibilizar as travas avançadas. Disponibilize CTA claro indicativo para Upsell de plano nos módulos inacessíveis ao atual plano (Ex: Advanced para Biblioteca Viva limitadas e Pro para inteligência estrutural infinita).
5. **IA SEM CRIAÇÕES FICTÍCIAS:** Proibir inferência compulsória não atrelada aos prompts. Se a inteligência geradora não puder constatar a tonalidade original rítmica e a métrica de bpm correta estática via o parse fornecido, o resultado deverá ser alvejado com uma designação "nula" (`null`).
6. **PROPRIEDADE DE ADMINISTRAÇÃO E CONTEXTO:** Separar estritamente o poder logístico/hierárquico e governamental (Direitos do dono central via ecossistema) das ocupações práticas e nomenclaturas dos envolvidos em banda listados isoladamente no detalhe relacional de montagem musical.
7. **BIFURCAÇÃO DA DOCUMENTAÇÃO NO CÓDIGO:** Preservar comentários sobre lógicas híbridas do app pendentes ou em reuso local na documentação oficial e manter o histórico operacional das edições coerente junto aos Pull Requests efetuados pelo AI e Dev.

---

## 26. EXEMPLOS DE CÓDIGO E PSEUDOCÓDIGO

**Exemplo Seguro de Fetch no Firestore Resguardado ao Tenant (Local):**
```javascript
const fetchLocalSongs = async (orgId) => {
  if (!orgId) return [];
  // Restrição primordial atrelada sempre à Organização Ativa correta
  const orgSongs = query(
    collection(db, "songs"), 
    where("organizationId", "==", orgId)
  );
  const snap = await getDocs(orgSongs);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

**Verificação Lógica de Importação IA e Limites no Servidor (Express):**
```javascript
  const userPlan = extractPlan(ecosystemPayload);
  let iaAuthorized = false;

  if (userPlan === 'PRO') {
      iaAuthorized = true;
  } else {
      return res.status(403).json({ 
        error: "Seu plano atual bloqueia funções de Inteligência Artificial. Faça o upgrade para o plano Pro." 
      });
  }

  // Monitoração de consistência de extração técnica das APIs de Model Geminis
  if (!genAiData.confidenceBPM || genAiData.confidenceBPM < 0.6) {
       genAiData.bpm = null; // Mantém a confiabilidade mantendo estado "Não Informado".
  }
```

---

## 27. CHECKLIST DE CONFIRMAÇÃO TÉCNICA NO CÓDIGO
O levantamento estritamente focado em auditar e conformar documentação com a estrutura do escopo:

- [ ] `package.json`: Versões declaradas compatíveis. *(Confirmado pela leitura no código: React 19, @google/genai, PWA-plugin e firebase-admin via Vite/esbuild suportado na configuração build).*
- [ ] `server.ts`: Integrado operativamente na proxy, webhooks macro, /api/ai/, e intersecções API.
- [ ] `firestore.rules`: Políticas estritas e consistentes baseadas no controle organizacional local garantido.
- [ ] Contextos reais (`Ecosystem`, `Auth`): Analisar se a unificação injeta as definições corretas dos perfis globais aos perfis nativos, espelhando planos e owner abilities em total conformidade nos validadores de rotas e actions globais.
- [ ] Tratamento Offline PWA: O estado real consolidado nas chamadas idb/Dexie do cliente no front-end em escopo nativo, pendente de confirmação do pleno alcance em relacional a armazenamento em cachê para sessões desconectadas integrais sem perdas de escala.
- [ ] Modais de CRUD base da Org: Conclusão lógica corretiva total de listagem flexível liberada nos comandos plenos por chefias atreladas (Edição correta dos eventos, tags locais etc).

---

## 28. RESUMO PARA AGENTES DE IA

Bloco técnico de metadados focados para leitura operacional em modelos de linguagem (LLMs) orientando manutenção paralela.

```json
{
  "project": "MusicScale",
  "ecosystem": "MillionsNest",
  "status": "Beta Funcional / MVP Avançado (Fase de Refinamento UI/Estabilidade Backend)",
  "project_type": "Aplicativo nativo Satélite; integrado e submisso ao faturamento/autenticação macro hub MillionsNest",
  "core_purpose": "Sistema gestor de infraestrutura técnica musical de adoração, atuando na elaboração das listas logísticas e visualizadores profissionais em escalas.",
  "architecture": {
    "frontend": "React 19 (SPA via Vite), Tailwind CSS, framer-motion",
    "backend": "Firebase Auth, Firestore, Express API (Middlewares Integrados Server Proxy)",
    "offline_strategy": "Vite PWA, dexie, workbox-window (Pendente de fechamento global em todas as etapas)"
  },
  "millionsNestIntegration": {
    "strategy": "Controle absoluto de estado e limitações imposto nas parametrizações oriundas por conexões JWT/Firebase do hub base MillionsNest associado.",
    "warning": "Vedado a construção paralela ou autônoma subjacente de checagem e emissão independente de billing API nativos no projeto satélite."
  },
  "modules": [
    "Dasboard Resumo",
    "Agendamentos Logísticos em Escalas e Bandas",
    "Repertório e Letramento Base",
    "Módulo Coleção Viva (Macro API)",
    "Engine Model Visual Performances",
    "Gestão do Banco Interativo CFGs"
  ],
  "plans": {
    "Starter": "Suporta até 10 integrantes; bloqueio IA e Biblioteca global. Escalas exclusivas sem teto rígido",
    "Advanced": "Suporta até 20 integrantes; Ativa cotas máximas para Library (10 ao mês)",
    "Pro": "Liberação central de quantitativos; Acesso unificado as engines LLMs parser automáticos e library"
  },
  "permissions": {
    "macro": "Usuário fundador ou proprietário associativo retém o status top limit. O CRUD geral se prende ao campo estruturado organizationId contínuo na inserção."
  },
  "security": {
    "data_loss_prevention": "Favorecer campos `status: 'inactive'` contra deletações imperativas no repositório geral relacional."
  },
  "feature_gates": "Os recursos condicionados nunca invisibilizam-se da usabilidade; eles transmutam para call-to-actions de assinaturas estéticas",
  "known_bugs": [
    "Doutrinação generativa falsa AI ao imputar ritmo bpm compulsório errôneo 120 sem confiabilidade",
    "Modificações mobile quebradas ocasionando dimensionamento e estouro em eixos da base visual das modais",
    "Operação de administrador impossibilitada perante controles excessivamente rigorosos e desencontrados num CRUD da seção banco da estrutura",
    "Disparidades entre status administrativo de um 'owner' global ofuscado visualmente/sistêmica como se fosse subordinado ao projeto descendente."
  ],
  "golden_rules": [
    "Assegure a primazia e discrição gráfica sem adição dramática de layouts que ofusquem o fim funcional na Performance ou painel",
    "Nenhum query dispensa o where 'organizationId' relacional local",
    "O Engine Gemini se aloca e atua restritamente pelo Backend Express (Chaves encobertas e resguardadas no local process)"
  ],
  "pending_code_confirmation": [
    "Status ativo persistido das atualizações nativas offline cache webworkers / dexie da fase final"
  ],
  "next_steps": [
    "Estabilização pontual UX móvel flexível segura",
    "Verificações e re-verificações API sobre o Limite Contabilizado Mensal",
    "Alinhamentos sistêmicos integrados no go-to-market em escala de teste Beta base física"
  ]
}
```
