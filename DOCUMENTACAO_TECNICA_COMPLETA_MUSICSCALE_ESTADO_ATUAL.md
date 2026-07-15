# DOCUMENTAÇÃO TÉCNICA COMPLETA MUSICSCALE (ESTADO ATUAL)

Esta é a documentação de enriquecimento técnico profundo do projeto MusicScale, desenvolvida para orientar programadores humanos e agentes de IA na manutenção, escalabilidade e depuração do sistema sem comprometer o estado consolidado.

## SUMÁRIO
1. [Aprofundamento por Seção](#1-aprofundamento-por-secao)
2. [Inventário de Arquivos Críticos](#2-inventario-de-arquivos-criticos)
3. [Mapa de Fluxos Críticos](#3-mapa-de-fluxos-criticos)
4. [Trechos Estratégicos de Código e Pseudocódigo](#4-trechos-estrategicos-de-codigo-e-pseudocodigo)
5. [Mapa Firestore Detalhado](#5-mapa-firestore-detalhado)
6. [Endpoints e APIs](#6-endpoints-e-apis)
7. [Contexts, Hooks, Services, Components e Pages](#7-contexts-hooks-services-components-e-pages)
8. [Regras de Negócio Consolidadas](#8-regras-de-negocio-consolidadas)
9. [Matriz de Riscos Técnicos](#9-matriz-de-riscos-tecnicos)
10. [Checklist para Programador Antes de Alterar o Projeto](#10-checklist-para-programador-antes-de-alterar-o-projeto)
11. [Checklist para Agentes de IA](#11-checklist-para-agentes-de-ia)

---

## 1. APROFUNDAMENTO POR SEÇÃO

### 1.1 Relacional MusicScale x MillionsNest
**O que faz:** Controla a governança de acesso, vinculando a instância do App MusicScale à entidade financeira e de autenticação MillionsNest.
**Arquivos relacionados:** `/contexts/AuthContext.tsx`, `/contexts/EcosystemContext.tsx`, `/services/ecosystem/`, `/pages/TenantOnboarding.tsx`.
**Fluxo técnico:** Ao acessar o MusicScale, a autenticação Firebase base (AuthContext) propaga o estado. O sistema recupera os claims/usuário, busca qual é a `organizationId` persistida para o usuário ativo (ou solicita via Onboarding). O `EcosystemContext` distribui os limites organizacionais (`subscriptionPlan`, `organizationRole`).
**Pontos de atenção:** Se o `organizationId` não for resgatado corretamente, nenhuma query funcionará (todas vão falhar ou na regra de frontend ou nas sub-regras de firestore). Não deve ser permitido cache obsoleto do plano.
**Como validar:** Logar com usuário plano Starter e confirmar se IA/Biblioteca Viva fecham acesso; alterar perfil no Firestore (mock/test) para plano Pro e observar reatividade de features (re-login ou refresh do context local).

### 1.2 Biblioteca Viva
**O que faz:** Importa músicas pré-aprovadas da base global para o acervo local da organização, evitando recadastros.
**Arquivos relacionados:** `/pages/LibraryPage.tsx`, `/components/library/`, `/services/globalLibraryService.ts`, `server.ts` (ou chamadas API diretas mapeadas).
**Fluxo técnico:** O Frontend consulta a coleção global `globalSongs`. Ao clicar em importar, executa chamada à API Backend para (se for caso) decrementar limite em `monthly_usage` (se plano Advanced) e clona os metadados e blocos da cifra para a coleção local `songs` gravando estritamente junto o `organizationId` da banda destinatária.
**Pontos de atenção:** Ações concorrentes podem furar o limite de cotas. Idealmente as chamadas de importação DEVEM processar a gravação cruzada e de contingência pelo backend Express, ou através de features seguradas na SDK transacional.
**Como validar:** Com plano Advanced (limite de 10), realizar execuções de importação atestando o decréscimo; observar o bloqueio imediato na 11ª. No plano Starter, validar que o botão de importação é transmutado num Call to Action apelativo de comercialização de Upgrade de ecossistema.

### 1.3 Inteligência Artificial (Importação / Parse)
**O que faz:** Processa PDFs, áudios ou textos brutos para estruturar metadados das canções, arranjando letras e ancorando as cifras ritmadas.
**Arquivos relacionados:** `/services/aiDirector.ts`, `server.ts` (API AI routes), `SongsPage.tsx` (import tab).
**Fluxo técnico:** O usuário fornece o texto/partitura bruto via UI. O sistema verifica as *capabilities* do locatário e repassa em via `express` servidor ao modelo SDK `@google/genai` protegido. O sistema analisa, classifica blocos e retorna validado ao formulário temporário de Criação. O usuário checa, dá commit manual, então sincroniza em BD local.
**Pontos de atenção:** Exigir na diretriz sistêmica da IA que, repassando ao motor LLM, se a estimativa técnica de música inferir confiança de BPM baixa ou metragens desconhecidas, devolva explicitamente `null` em vez de um fictício e danoso `120`. Isso perverte o ambiente digital rítmico do produtor/worship manager atuante se o arranjo natural fugir dessa pulsação de mock default generativada.
**Como validar:** Inserir cifra sem métricas e sem andamentos; observar o retorno limpo em ausência formal de "Tempo BPM" sem fixações cegas na engine.

### 1.4 Banco de Dados Interno (Configurações da Organização)
**O que faz:** Mantém a interface do administrador flexível para recadastrar nomes operacionais como "Locais", "Equipamentos", "Tags do Ministério", "Tipos e Nomes dos Eventos de Cultos Especiais".
**Arquivos relacionados:** `/pages/DatabasePage.tsx`, `/components/admin/`, `/services/MusicRepository.ts`.
**Fluxo técnico:** As rotas locais de painéis extraem baseadas no Tenant vivo referenciadas. A interface avalia cargos hierárquicos: Somente cargos gerenciais/Owner garantem a UI de alteração/ação de exclusões.
**Pontos de atenção:** Correções pretéritas relatas em bugtracker evidenciaram que confusões organizacionais sobre papéis "globais vs locais" travavam CRUD. Regra estrita: O owner/dono da organization primária sempre subscreve direitos paritários ou maiores absolutos que os locais permitindo fluxo CRUD estável, nunca "rebaixado".
**Como validar:** Simulando log via admin pleno em face à log de visualizador "membro básico". Mantenha CRUD inacessível fisicamente (sem renderizar ícones pen/trash) nas telas listadas na sessão gerencial de um usuário com funções orgânicas puramente instrumentais de palco (ex: Baixista).

---

## 2. INVENTÁRIO DE ARQUIVOS CRÍTICOS

| Arquivo | Responsabilidade | Área do sistema | Risco se alterar errado | Observações |
| :--- | :--- | :--- | :--- | :--- |
| `App.tsx` | Ponto de entrada SPA, Roteamento reativo e encapsulamento em Providers | Core Front | Tela branca massiva (Blank Page CRASH); quebra relacional nos Providers. | Possui implementações de React Router base, e monta Contextos Globais em hierarquia sequencial. |
| `server.ts` | Backend Proxy (Express/Node) local API para segredo SDK AI | Core Back | Módulo offline inviabilizando chamadas restritas (AI e library imports) | Intersecções importantes `GEMINI_API_KEY`. O Vite middleware é anexado. |
| `firestore.rules` | Segurança Macro Lógica | DB Security | Exposição cross-tenant vazamentos severos. | Sempre preserve checagens em match paramétrico na organization id. |
| `/contexts/EcosystemContext.tsx` | Povoa a árvore de componentes com as Entitlements da Organização ativa | Core State | Imposição financeira falha na ponta. | As regras se pautam nas abstrações do Ecosystem para desenhar features na tela. |
| `/contexts/AuthContext.tsx` | Assina login e recupera `currentUser` do IDB nativo Firebase SDK | Core State | Tranca usuários nos flows onboarding de tela | Atua como fundação antes do ecossistema locar e amarrar dados do BD do cliente. |
| `/pages/DashboardPage.tsx` | Dashboard, entry inicial prático do sistema, links vitais e métricas. | UI / Flow | Queda drástica em Performance UI mobile | Adoção e estabilizações (scripts de correção referenciados apontam históricos intensos performáticos de renders paralelos). |
| `/services/globalLibraryService.ts` | Consulta e gerência dos envios da seção Biblioteca Viva musical global | Library | Furto orgânico em infra e burla de planos Advanced. | Interage e engatilha restrições atreladas limitadas em features.ts. |
| `/lib/limits.ts` | Funções booleanas em encapsulamentos de status (`canUseX`) | Business | Permitir acesso acidental aos gates pagáveis da infra | Mapeamentos atestados aos enums dos Planos e Roles base. |

*(Nota: Alguns serviços auxiliares como as lógicas de faturamento/billing puros originam do portal e landing da estruturação inicial do projeto pai [MillionsNest], acessíveis localmente apenas em modo informacional no app MusicScale).*

---

## 3. MAPA DE FLUXOS CRÍTICOS

### 3.1 Inicialização e Resolução de Organização Ativa
**Objetivo:** Identificar com nitidez relacional os limites operacionais estendidos e destinar um banco lógico correto e seguro no isolamento Multi-Tenant do usuário operante na sessão.
**Arquivos envolvidos:** `AuthContext.tsx`, `EcosystemContext.tsx`, `TenantOnboarding.tsx`.
**Collections envolvidas:** `organizations`, subcollection `members` atada ao Firebase auth user profiles.
**Permissões necessárias:** O Auth listener permite que a conta leia na base apenas organizações cuja participação do UID esteja inserida nos domínios ou vinculada na global profile pointer collection (`defaultOrganizationId`).
**Passo a passo técnico:**
1. Motor Firebase Auth repassa o trânsito válido da sessão (O login tem cache token íntegro).
2. O Context Auth espelha esse Profile.
3. O Context Ecosystem dispara uma requisição de captura de status buscando referências em Profile do locatário nativo logado apontado pela última Ordem ou atrelamentos.
4. Identifica planos da locatária (`subscriptionPlan`, `status`). 
5. Emite na raiz estrutural "Contexts Hydrated". As pages React carregam suas query lists localizadas.
**Erros comuns:** Falha na sincronia, loops longos (spinner eternizado) sob perfis virgens recém autenticados sem org linkada no DB transacional em desincronia na cloud function formadora.
**Como testar:** Limpe um BD mockado do vínculo org em DB manual. Garanta no flow limpo o redirecionamento imediato reativo forçado na UI "Complete seu Perfil" / "Selecione Organização".

### 3.2 Validação de Limites de Plano Avançados
**Objetivo:** Impedir importações volumétricas que furam os limitadores impulsionáveis Advanced limit vs Pro unlimited.
**Arquivos envolvidos:** `LibraryPage.tsx`, `/lib/limits.ts`, `server.ts` (API Proxy route).
**Collections envolvidas:** `globalSongs`, `songs`, `monthly_usage` (Contábil contábil transaccional do mês).
**Passo a passo técnico:**
1. Atividade visual do front checa: `if (!canImportLibrary(currentPlan))` → Mostre os limitadores Upsell Premium Modal.
2. Com permissão natural, a UI libera Payload requisição remetido ao `server.ts` proxy Backend.
3. Node verifica a Assinatura Autenticadora base. Processa, incrementa atômicamente (+1 quota limit registry) no `monthly_usage`.
4. Repassa metadados brutos global para tabela do tenant local da requisição, assegurando amarra referencial ao `.organizationId`.
**Erros comuns:** Falta de registro transacional. Caso um erro atípico na network engasgue a UI visual após backend cobrar a cota. Modais demorados, repetições de click "Duplo Envio" do Frontend do utilizador esgotando limiares.
**Como testar:** Forje uma conta mock e manualmente reatribua 9 / 10 cotas usadas no DB. Aplique nova importação e monitore o front ser barrado de acordo com o retorno imposto da 11º transação abortada do back limits.

---

## 4. TRECHOS ESTRATÉGICOS DE CÓDIGO E PSEUDOCÓDIGO

### Fetch Seguro contra Vazamentos Cross-Tenant
*(Código conceitual aplicável nos serviços frontend base de hook DB local)*
```typescript
import { query, collection, where, getDocs } from 'firebase/firestore';

// LOCAL: src/services/firestoreService.ts (ou atrelado a useMusicData.ts hooks)
// OBJETIVO: Extrair métricas musicais restritas operando na camada locatária logada.
export const fetchTenantSongs = async (db, orgId: string) => {
  if (!orgId) throw new Error("[CRITICAL] A identificação tenant organizationId está ausente na transação fetch.");
  const q = query(
    collection(db, "songs"),
    where("organizationId", "==", orgId),
    where("status", "==", "active") 
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
```
**Importância:** Sem ele, expõem-se conteúdos artísticos paralelos, ferindo integridade de negócios logísticos multi-banda das agrupações cadastradas. Modificá-lo inadvertidamente extenua toda segurança base isolativa local do ecossistema.

### API Proxy & Prevenção Sanitizadora do BPM Geminis Generativo IA (Pseudo/Backend route)
```javascript
// LOCAL: server.ts ou camada de rotas api de motor /api/ai/parse
// OBJETIVO: Domar as respostas de inferências LLM e proibir invenções falsas ao ritmo original
function sanitizeAIOutput(llmResponse) {
    let finalBPM = null; // Prioriza o status neutro oficial default de recuo
    
    if (llmResponse.bpm && !isNaN(parseInt(llmResponse.bpm, 10))) {
        // Regra defensiva contra preceito 'criativo genérico' dos modelos Google (bpm mock)
        if (llmResponse.bpm !== 120 || llmResponse.confidenceBPM > 0.8) {
            finalBPM = parseInt(llmResponse.bpm, 10);
        }
    }
    
    return {
        ...llmResponse,
        bpm: finalBPM,
        requiresReview: (llmResponse.confidenceScore < 0.6)
    };
}
```
**Importância da blindagem no backend:** Evitar injeção nativa local sem curadoria rítmica e transferir a decisão criadora artificial duvidosa/fabricada fora do app logístico. O andamento real das partituras das congregações sofre impacto em "auto-scrolls" no Performance Mode caso injetado ritmo fictício e falsificado indevidamente na engine em rotas cegas.

---

## 5. MAPA FIRESTORE DETALHADO

| Collection | Escopo | Finalidade | Campos principais | Quem lê | Quem escreve | Riscos | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `organizations` | Ecossistemas/Hub | Retêm atributos das esferas primárias unificadas MillionsNest. | `name`, `subscriptionPlan`, `status`, `createdAt` | Logged Users | Stripe Hooks / Sistema Principal | Falsa informação no status quebra o painel de acesso global. | Implementado |
| `organizations/{id}/members` | Relacionais Roles | Atestam cargos dos UIDs agregados nestes Tenants | `uid`, `role` (owner/admin/member/guest) | Módulo Context ecosystem | Gerência local convites em app | Bloqueio/escalabilidade falseada travando painéis Admin base. | Implementado |
| `globalSongs` | Global Geral | A Fonte unificada viva de bibliotecas para importações Premium | `title`, `bpm`, `lyrics`, `chords`, `tags` | Apps Premium Accounts Limit | Administradores MillionsNest Internos | Injeções perversas desativar o propósito seguro de repertório validado premium. | Implementado |
| `songs` | Organizacional Locatária | O Repertório orgânico gerencial da equipe para a timeline. | `organizationId` [Critical], `title`, `key`, `bpm` | Org Members | Org Admins/Designated Leaders | Inserir documento solto com campo id organization faltante fura relatórios em telas isoladas. | Implementado |
| `scales` | Organizacional Locatária | Agendas dos cultos interligadas temporalmente com ref_ids de songs | `organizationId`, `eventDate`, `eventName`, `leader`, `bandMapId` | Org Members | Admins | Manipular e droppar deletes desestrutura históricos logísticos salvos contábeis da banda musical. | Implementado |
| `monthly_usage` | Relacional Financeiro Mês | Arquiva as execuções restritas tarifadas como a Cota Biblioteca Advance | `orgId`, `periodId_MMYYYY`, `aiExecutions`, `libraryImports` | Backend Server | Express Proxy Server Limits Validator | Perda do sync de cota, prejuízos nas premissas contabeis operando gratuitamente features restritas API | Pendente contabilidade total/Em refinamento |
| `audit_logs` | Admin / Suporte Interno | Mapas periciáveis logísticos sob quebra relacional estruturado no ambiente base. | `type`, `byUid`, `orgId`, `actionPayload`, `timestamp` | SysOwner (Equipe app) | Handlers do frontend ou webhooks no back | Banco gigante encarecendo operação de tráfego base atinente e não sendo higienizado log rotate temporais. | Em refinamento |

---

## 6. ENDPOINTS E APIS (Via `server.ts` Proxies Backend Lógico)

| Método | Endpoint | Responsabilidade | Auth necessária | Input Base Payload | Output Expected | Arquivo de Setup | Riscos Operacionais Notáveis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/musicscale/library/import` | Transferências dos acervos globais restritos para o banco privado org | JWT Auth Firebase Admin validado header | `{ globalId }` | `200 Code { localSongParsedBody }` | `server.ts` proxy | Contornamento e extração massiva em loop das obras curadas da GlobalSongs ignorando travas. |
| `POST` | `/api/ai/parse_lyrics` | Tratamento GenAI SDK das letras cruas coladas com arranjos puros. | JWT Auth Firebase Admin validado header | `{ rawTextContent, hintContext }` | `200 Code JSON Struct: { title, key, bpm, lyricsBlock } ` | `server.ts` proxy / `aiDirector` | Rate limit na cota geral operatória SDK `@google/genai` com chave corporativa onerada por tráfices espúrios. |

*(Outros hooks de gateway do Stripe repousam em rotas atreladas às instâncias irmãs primárias MillionsNest em esferas operacionais exteriores base, sendo seu consumo indireto no MusicScale apenas informativo passivo via resgates contextuais das flags `subscriptionStatus` espelhada na tabela base `organizations` locatária).*

---

## 7. CONTEXTS, HOOKS, SERVICES, COMPONENTS E PAGES

### Contexts
- **`AuthContext.tsx`**: Provedor mestre de observabilidade `onAuthStateChanged`.
- **`EcosystemContext.tsx`**: Acoplado intimamente às sub-bases. Derrama as diretrizes restritivas: "Fulano é owner daquela Organização atrelada, e operam num plano PRO ilimitado no portal base, injetando flags". O bloqueio vital base passa unificado antes do roteador do App react permitir a tela carregar.
- **`MusicDataContext.tsx`**: Memória operacional (`songs` do tenant) cacheada em estados primários globais reativos com intuito drástico de poupar reads Firebase recorrentes na navegação lateral dashboard/scales.

### Hooks
- **`useMusicData()` / `useEcosystem()`**: Extrações customizadas diretas. Devem sempre abrigar lógicas predeterminantes fallbacks defensivas anti "undefined org state". Evitarão throw errors vermelhos nas sessões vitais em caso transacional network quebra instantes.

### Services
- **`globalLibraryService.ts`**: Focado no resgate indexado (busca/paginação visual otimizada frontend limits) sem repovoar client. 
- **`aiDirector.ts`**: Repositório central das promíscuas lógicas de formatações em prompt engenhariado (Prompt Engineering restrito). Aqui mora as formatações de constraints "retorne strict JSON, não converse".
- **`firebase.ts` / `firebaseAdmin.ts`**: Configuração basal dupla de Client SDK (UI auth/reads) vs ServerAdminSDK (Express rules bypassing).
- **`entitlementsService.ts`**: Helpers engessados puramente logísticos base ex: `resolveFeatureAccess(plan) -> block | allow | warn_quota`.

### Components e Pages principais
- **`DashboardPage.tsx`**: Embasamento unificado e widget resumos práticos. Alvo de refinamentos contínuos contra lags, comumente otimizado com lazy arrays e renders não suspensivos paralelizáveis em base nativa "Premium Vibe Performance Metrics".
- **`SongsPage.tsx` & `ScalesPage.tsx`**: As telinhas com arquiteturas de listagem densas (CRUD), abarcando ações nos modais operatórios. A padronização de modais deve ser restritiva horizontal (Max_W) não vazando scroll inavegável num iPhone mobile format layout vertical.
- **`Performance Mode` (Visualizadores de Acordes)**: Componentes focados restritos sem firulas, exigem background noturna rigorosa high contrast visualizando o texto da letra num setlist dinâmico de cliques rápidos contíguos de scroll vertical contínua, ocultando navegações macro headers distraentes.

---

## 8. REGRAS DE NEGÓCIO CONSOLIDADAS

- O sistema Multi-Tenancy é inviolável; toda instrução de CRUD nas bases isoladas precisa declarar categoricamente na querie local: `.where("organizationId", "==", ecosystem.orgId)`.
- O Billing se rege paralelamente com exclusividade na infra MillionsNest; MusicScale herda, ele NÃO reemite assinaturas lógicas na UI que divergem do portal do dono em hub, portando apenas atalhos informacionais da `Assinatura Base Expirada / Active / Trial`.
- Um "Dono/Fundador Global" que abre a filial local retém as suas capabilities orgânicas máximas plenas, imune a falsas desclassificações caso registros internos na tab de admins locais não tiverem explicitamente recadastrado (FallBack Role Security Rule).
- Os blocos de funções subjacentes como a feature `Biblioteca Viva` comportam restrições em Planos Iniciais (`Starter`) mediante exibição de "Gatetrays visuais", operando não na invisibilização da função inativa, e sim propiciando portais limpos orientados do Upgrade atrativo orgânico à oferta do ecossistema para gerar upgrade monetizado local suave.
- Modelagens sintéticas relativas a importador generativo em Music IA (Bpm incertos ou chaves enredáveis desconexas falsificadas atadas por hallucinações algorítmicas no Parser) perdem validação em prol da flag segura "Null/Não detectado/Revisão Fita". Respeite o campo musical nativo humano contra Mock defaults cegas.

---

## 9. MATRIZ DE RISCOS TÉCNICOS

| Risco | Área afetada | Gravidade | Causa provável | Como prevenir | Como detectar |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Vazamento de informações cruzadas entre Bandas/Orgs diferentes | Database Isolation Core | CRÍTICA | Perda da regra `firestore.rules` central ou Frontend omisso removendo condicional `.where` nas rotas do Client Fetch hook fetch local nativa. | Manutenção estrita nas rules file do cloud console; revisões duplas em código que mexam na pasta services de repositório query index. | Monitorando as reclamações no Painel, via usuários visualizando repertório de outra denominação/igreja invasiva no log error 403 denied local. |
| Injeção Artificial do Default '120 BPM' em músicas Lentas (Worship Acústicas) na IA API Engine do Google resultando quebra de scrollers operacionais de palco logístico de Performance | Motor de Criações Logístico (aiDirector/Proxy) | ALTA | Prompt não refreando confabulações e inventividade LLMs em rotas limitadas onde a IA supõe 120 beats arbitrário perante um texto branco incompleto não audível da congregação formadora. | Regra estrita interceptadora Backend Node Server de Sanitizar a Response caso Confidence Metric do payload seja baixa inferior a 70% rejeitar, adotando o campo original como nulo "null". | Músicos assinalarem auto scroll do palco acelerado descompassado impossibilitando performances Live lendo no tempo nativo da fita em ensaios reportados na métrica suporte logs internos base. |
| Impedimentos Severos ou Botões Desaparecidos de Cadastro de Instrumentos aos Líderes Gestores na página de Sistema Database DB Cruds Form | Administradores Base UI Control | ALTA | Má interpretação e confusão local dos metadados globais no array check Entitlements UI roles check local versus `isOwner` master limitante base da subconta em roles tab. | Revisar as matrizes render-conditionals no DatabasePage.tsx: FallBack obrigatório: Se o systemUserProfile é `owner` unificado na root, herda passe livre irrestrito aos botões Edit, Delete, Plus inibindo falso-negativos base relativas a falta tag role na db. | Líder fundador atesta impossibilidade bloqueante nos actions informacionais relatórios nativos app base não achando edit pen buttons relacional nativo UI frontend bloqueio invisível nativo limit actions. |
| Desconfigurações drásticas e estouros de Layout Transversal nas Modais DatePicker / Seletores Mobile Modais estourantes fora base width CSS container limit | Interface de Usuário Fluid Mobile | MEDIA | Componentes Tailwind modais não abraçando limitações e amarris em `max-w` em resoluções base menores de smartphone (Excesso de fields modais side lists long fixed widths 30rem etc em caixas modals modais do framer em scales list base edit). | Engessamento nos modais estruturais envoltas de BottomSheets e drawers controlados flexiveis via `max-w-md w-full relative h-[80vh] overflow-y-auto`. | Inspecionar relatórios ou testar rotina simulação Device Toggle Mode browser inspeção simulando mobile 375px vertical view width logs visões CSS flex layout limits shift relatórios atrelados app documentação log reports bug issue relatados. |
| Ganhos abusivos de Requests Limit Billing estourando as Chaves Gemini API Gateway base no servidor (Custações Impróprias Server Express API Proxy calls DDoS ou loop limit bug on form component) | Billing Costs da Conta Cloud Gemini Operations Core Server Proxies | ALTA | Botão "Gerar Chords / Extrair AI" na página frontal no click submit sendo exposto sem limitadores debounce duplos, permitindo usuário impaciente enviar e floodar no network XHR backend repetido limit chamadas 200 vezes loop limit bug nativo limit bug nativo limite requisição em tráfego de submissão do formulário componente. | Impor estado "isLoading = true" absoluto travante, atrelado a rate limiting rudimentar na Express Proxy api routes route api calls nativo. Adicionar Toast "Por favor, aguarde o processo heurístico neural, limit." | Padrões explosivos em cotas Google Cloud Log Reports API Costs limits metrics base log limits observadas reports alertas de faturamento atípico base log billing metrics alerts account cloud gcp. |

---

## 10. CHECKLIST PARA PROGRAMADOR ANTES DE ALTERAR O PROJETO

### Antes de mexer em billing ou limites de assinaturas
- [ ] Confirme onde as definições Entitlements base rodam limitadoras (Verificar `/lib/limits.ts` & EcosystemContext).
- [ ] O componente visual possui formatação "Upgrade" engatilhada atrativa limpa para bloqueios parciais em Planos Starter Base?.

### Antes de mexer nas Coleções Firestore Base ou Refatorações Relacionais do Music Scale Repo Data
- [ ] O componente reescrito obedece ao envio de cláusula vital estruturante MultiTenant `where("organizationId", "==", currentOrgId)` obrigatória no fetch base da consulta do hook?.
- [ ] Confirme de não deixar rastros visuais temporários (ex: Testes Mock base soltos em views) vazados no repositório final de aprovações.

### Antes de mexer na UX (Design Pattern Restrições Limitadoras)
- [ ] Nunca adicione barras laterais gigantescas, logos fixos agressivamente brilhantes num escopo focado da página de "Worship Live Mode / Performance Mode". O sistema preza por ser invisível quando no palco. Escores operacionais "Dark Mode", "High Contrast" nas letras e minimalismo temporal em modais essenciais do roteiro.
- [ ] Bottom Sheet Drawers para celular (Touch amigáveis) em desfavor de Alertas Nativos Prompt Box base ou dialogs fixas que transbordam na vertical device.

---

## 11. CHECKLIST PARA AGENTES DE IA

Lista pragmática atestável aos bots de desenvolvimento automático (IA) nas continuidades ou sugestões de codefixes:
- **Consumo Primário:** Leia esta documentação integral antes de propor deleções radicais estruturais atestadas (Verifique as subseções 1.4 de Banco Interno Roles Limits).
- **Sem Intervenções Inventadas:** Não construa ou chame nos scripts rotas de endpoints irreais, a não ser as fixadas em `/api/` documentadas nesta infra (exemplo `server.ts`).
- **Respeite Tenant Rule:** Cláusulas lógicas relacionais `.where("organizationId")` no Firestore JS hook são irrevogáveis e não simplificáveis, em sua formatação base paramétrica, a não ser para query scopes atestados como "Globals Collections Root" documentados na seção mapeada.
- **Diferencie Planejado de Estável Feito:** Utilize tags de "Pendente" quando a diretriz faltante (Ex: Offline idb ServiceWorker Final Setup base) não achar root na codebase, reportando ao mestre usuário humano as falhas.
- **Sustente o UX Premium Dark:** Quando criar componentes, abrace a estética sombria "Cosmic Slate/Midnight Dark Premium vibe" base em tons acinzentados limpos (`bg-zinc-950/900`) nas formatações estritas contínuas das views restritas baseadas do app operacional MusicScale, prescindindo adornos chamativos impertinentes base relacional ou telemetrias esteticamente verbosas na UI dos músicos finais na interface em palco relacional visual.
- **Não Inventar BPM IA MOCKS:** Nas rotinas lógicas atinentes a Modelos (Prompts do aiDirector), reitere restrições "Nunca inferir falso tempo rítmico bpm".

---
*Fim do Enriquecimento de Mapa Profundo Sistêmico MusicScale / Documento Guia Técnico IA/Dev.*
