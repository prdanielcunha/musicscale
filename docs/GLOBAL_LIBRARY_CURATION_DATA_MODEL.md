# GLOBAL LIBRARY CURATION (PHASE 3)

## Objetivos
Estabelecer um modelo estrutural restrito (sandbox fechado), para concentrar os esforços de curadoria sem impactar o domínio de contribuições abertas ou o backend existente de uso das igrejas. A ideia principal é usar um modelo relacional "Candidata" -> "Ocorrências".

## Fronteira com songSubmissions
A coleção `songSubmissions` era originalmente a base de importação/exportação e continha a regra `submittedBy` podendo ver/editar as músicas enviadas. Esse comportamento atual fica INTACTO e as contribuições de usuários continuarão caindo lá.
A nova camada do ecossistema usa `globalLibraryCandidates` estritamente server-side. Não devemos vazar o estado dos algoritmos na `songSubmissions`. Esta coleção nova cuidará de merge, agrupamento lógico, score e auditoria privada de aprovação.

## Coleções
- `globalLibraryCandidates`: Objeto raiz, contém a identidade canônica e agregados.
- `globalLibraryCandidates/{candidateId}/occurrences`: Ocorrências brutas provindas de importação, `songSubmissions` ou detectadas. Cada documento tem os metadados do songSnapshot.
- `globalLibraryCandidates/{candidateId}/matches`: Possíveis matches contra a Biblioteca Viva (tendo ID da globalSong).
- `globalLibraryCandidates/{candidateId}/reviewLogs`: Trilha de auditoria da curadoria (imutalidade).

## Privacidade e Segurança
- `firestore.rules`: As coleções de candidatos e sub-coleções SÓ PÓDEM SER LIDAS através da função `isSystemAdmin()`. Não podem ser lidas por membro de organização nem pelo autor que a enviou.
- A Escrita (`write`) é estritamente FECHADA (`allow write: if false;`). Todo provisionamento deverá acontecer pelo NodeJS (Admin SDK). Isto fecha as portas de frontends de terceiros.

## Autorização (Express)
Implementado o middleware `requireEcosystemRole` que confere no token quem está solicitando dados (para uso futuro), bloqueia papéis que não sejam do array `VALID_ECOSYSTEM_ROLES`.

## Política de IDs (Idempotência e Fingerprints)
- Ocorrências ganham IdempotencyKeys na submissão, impedindo o loop the duplicate entry. (No geral sendo a representação de orgId_songId + source fingerprint)
- Candidata são referenciadas via `candidateId` determinístico, ou resolvidos agrupados por similaridade ou fingerprint semântico.
- Nenhuma colisão cyrb53 resulta em auto-merge. Quando há colisão e títulos/letras conflituam, geramos um status de advertência e separamos as identidades.

## Índices
Serão necessários futuramente:
1. `globalLibraryCandidates` (status ASC, lastDiscoveredAt DESC)
2. `globalLibraryCandidates` (status ASC, analysisSummary.overallScore DESC)
3. `globalLibraryCandidates` (status ASC, occurrenceCount DESC)
4. `globalLibraryCandidates` (canonicalIdentity.titleFingerprint ASC)
5. `globalLibraryCandidates` (canonicalIdentity.contentFingerprint ASC)
6. `globalLibraryCandidates` (processing.state ASC, processing.nextRetryAt ASC) - para job queues.

## Limites de Conteúdo
Os limites são checados pelo backend via repository validation:
- MAX_PERSISTED_MATCHES: 10
- MAX_TITLE_LENGTH: 200
- MAX_ARTIST_LENGTH: 200
- MAX_LYRICS_LENGTH: 5000
- MAX_CHORDS_LENGTH: 15000
- MAX_SECTIONS: 50
- MAX_INTERNAL_NOTE_LENGTH: 1000

## Status de Implementação e Planejamento
- [x] Tipagem inicial de domínios, limites e status (Fase 3A).
- [x] Regras no Firestore adicionadas garantindo "backend only and read for admin" (Fase 3A).
- [x] Repositório Server-side utilizando transações fechadas com Firestore SDK/Admin.
- [x] Testes para Repositório de Curation / Idempotência.
- [ ] Processo cron ou function de sweeper (Fase 3B) / Queue baseada em pubsub ou trigger.
- [ ] Páginas visuais do admin para Curadoria.
