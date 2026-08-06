# Mapeamento da Arquitetura de Comandos e Respostas de Escalas (MusicScale Backend)

Este documento apresenta o mapeamento detalhado de toda a arquitetura de comandos e respostas do ecossistema MusicScale no backend, consolidando os fluxos transacionais, autenticação, controle de concorrência (idempotência), serviços lógicos e interação com o banco de dados (Firestore).

---

## 1. Entry Points (Express Endpoints)

O backend do MusicScale disponibiliza quatro portas de entrada críticas em `/server.ts` para processar comandos de escalação de banda, publicação de escala de músicas e registro de presenças/respostas individuais.

### A. Publicação de Escala de Música
* **Endpoint:** `POST /api/v1/music-scales/:musicScaleId/publish`
* **Responsabilidade:** Consolida dados refinados da escala de música (data, horário, repertório) no banco, vincula-se a uma escala de banda (se aplicável), desativa as presenças de versões anteriores (em caso de republicação) e distribui as novas notificações e registros de presença de forma atômica.
* **Payload Esperado:** `MusicScalePublishPayload` (objeto contendo opcionalmente `bandScaleId` e `scalePatch` com as atualizações de data, repertório, tom, BPM, etc.).

### B. Registro de Resposta de Presença Individual
* **Endpoint:** `POST /api/v1/music-scales/:musicScaleId/my-response`
* **Responsabilidade:** Permite que um instrumentista/membro escalado registre ou atualize sua intenção de presença (`accepted`, `maybe`, `declined`) em um evento publicado, desde que o evento não tenha começado.
* **Payload Esperado:** `{ status: 'accepted' | 'maybe' | 'declined', reason?: string | null }`

### C. Criação de Escala de Banda (Escala Operacional)
* **Endpoint:** `POST /api/v1/band-scales`
* **Responsabilidade:** Cria uma escala de banda contendo as atribuições específicas de instrumentistas para instrumentos/funções ministeriais sob isolamento de locatário.
* **Payload Esperado:** `BandScaleCreateDTO` (atribuições de `userId`, `instrumentId` e detalhes adicionais).

### D. Atualização de Escala de Banda
* **Endpoint:** `PATCH /api/v1/band-scales/:scaleId`
* **Responsabilidade:** Modifica uma escala de banda existente, executando algoritmos de reconciliação de diferenças (*diff*) para enviar notificações direcionadas de adição, modificação ou remoção.
* **Payload Esperado:** `BandScaleUpdateDTO` acompanhado de `expectedVersion` para validação de concorrência otimista.

---

## 2. Middlewares (Authorization, Verification & Routing)

O tráfego dessas rotas é interceptado e validado por uma malha rigorosa de autenticação e proteção de dados que opera sob o princípio de desconfiança absoluta das informações enviadas pelo lado cliente (frontend).

```
[Cliente] ──(Bearer Token)──► [Firebase Admin SDK Auth]
               │                     │ (Verificação de UID & Validade)
               ▼                     ▼
      [X-Organization-Id] ──► [OrganizationAuthorization / EcosystemAuth]
                                     │ (Validação de isolamento e RBAC real)
                                     ▼
                        [Idempotency-Key Check] ──► [Service Transaction]
```

### A. Verificação de Identidade (Firebase Auth)
Cada requisição extrai o header `Authorization: Bearer <ID_TOKEN>`. O token de ID é decodificado via `verifyIdToken(token, true)` usando o Firebase Admin SDK para garantir que o usuário está autenticado e que sua sessão é legítima.

### B. Isolamento de Locatário (Multi-Tenant Header)
O header `X-Organization-Id` é exigido. O backend valida se a organização correspondente existe, não está arquivada e se o usuário autenticado possui vínculo ativo com ela (ou se possui privilégios de administrador global do ecossistema MillionsNest).

### C. Verificação de Recursos (Feature Flags)
Antes de executar qualquer comando, o backend consulta o documento da organização no Firestore e verifica se a feature flag correspondente está habilitada:
* Publicação: `musicscale.musicScalePublishCommandV1`
* Respostas: `musicscale.scaleResponsesV1`
* Comandos de Banda: `musicscale.bandScaleCommandApiV1`

### D. Resolução de Permissões e RBAC Real (Não Baseado em Frontend)
* **`resolveOrganizationAuthorization`:** Invocado nos endpoints de escala de música para mapear e validar as capacidades efetivas do usuário (ex: `scales.publish`). Ele lê os papéis (`organizationRole` como `admin` ou `owner`), as capabilities explícitas do membro e o perfil global administrativo (como `ceo`, `global_admin`).
* **`requireEcosystemRole`:** Utilizado para endpoints de administração e curadoria global. Valida de forma rígida contra a coleção `users/{uid}` se o usuário possui algum dos papéis autorizados (`ceo`, `global_admin`, `ecosystem_owner`, `founder`).
* **`BandScaleAuthorizationService`:** Valida se o usuário logado possui a permissão de líder de escala/gerenciamento de equipes (`canManageScales`) na organização antes de permitir alterações nas atribuições de banda.

---

## 3. Services (Camada de Lógica de Negócios)

A execução das regras operacionais, normalização de dados e governança de estados é isolada em serviços altamente coesos no backend.

```
                    ┌───────────────────────────────┐
                    │     Express Endpoints         │
                    └───────────────┬───────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│MusicScaleCommand │      │MusicScaleResponse│      │BandScaleCommand  │
│Service           │      │Service           │      │Service           │
└────────┬─────────┘      └────────┬─────────┘      └────────┬─────────┘
         │                         │                         │
         │         ┌───────────────┴────────────────┐        │
         ├────────►│       IdempotencyService       │◄───────┤
         │         └────────────────────────────────┘        │
         ├───────────────────────────────────────────────────┤
         ▼                                                   ▼
┌──────────────────┐                                ┌──────────────────┐
│Notification-     │                                │AssignmentDiff-   │
│Factory           │                                │Service           │
└──────────────────┘                                └──────────────────┘
```

### A. `MusicScaleCommandService`
* **Localização:** `/services/server/scale/musicScaleCommandService.ts`
* **Responsabilidade:** 
  1. Validação estrita de formato de payloads (`validatePayload`).
  2. Execução transacional atômica da publicação.
  3. Reconciliação bidirecional do link entre escalas de música e escalas de banda (garantindo cura automática caso haja divergências).
  4. Geração de registros de presença individuais correspondentes para cada atribuição ativa.

### B. `MusicScaleResponseService`
* **Localização:** `/services/server/scale/musicScaleResponseService.ts`
* **Responsabilidade:** 
  1. Gerenciamento das respostas de presença individuais do instrumentista logado.
  2. Validação temporal rigorosa (impede a gravação de respostas caso o evento já tenha iniciado com base no cruzamento de fuso e horário).
  3. Atualização paralela de todos os registros de presença atrelados àquele mesmo usuário no evento (ex: se o usuário foi escalado como Guitarrista e também como Líder, ambas as respostas são atualizadas harmonicamente).

### C. `BandScaleCommandService`
* **Localização:** `/services/server/bandScale/bandScaleCommandService.ts`
* **Responsabilidade:** Orquestra a criação, modificação e normalização das atribuições de banda. Aciona o `AssignmentDiffService` para comparar atribuições anteriores e atuais para disparar notificações cirúrgicas (ex: notificar quem entrou, quem foi removido e quem teve a função alterada).

### D. `IdempotencyService`
* **Localização:** `/services/server/bandScale/idempotencyService.ts`
* **Responsabilidade:** Motor de garantia de integridade transacional contra cliques duplos acidentais ou reenvio de pacotes de rede. Gera assinaturas determinísticas de payload e gerencia recibos de comandos.

---

## 4. Database Collections (Persistência e Leituras/Escritas)

Todas as ações transacionais são gravadas no Cloud Firestore sob isolamento rigoroso por `organizationId`.

| Coleção / Subcoleção | Operação | Finalidade no Fluxo de Escalas |
| :--- | :--- | :--- |
| `organizations` | Leitura | Verificação de existência da organização, feature flags, e identificação do Owner da congregação. |
| `organizations/{orgId}/members` | Leitura | Validação de papéis organizacionais e status ativo dos membros da congregação. |
| `organization_members` | Leitura | Mecanismo de fallback/legado para checagem de vínculo ativo de membros. |
| `users` | Leitura | Obtenção de perfis, nomes canônicos e papéis globais na MillionsNest. |
| `scales` | Leitura / Escrita | Documento da escala macro de músicas. Armazena status, data, horário, repertório e as atribuições finais (`eventAssignments`). |
| `scales/{scaleId}/responses` | Leitura / Escrita | Subcoleção contendo as presenças individuais de cada músico escalado em cada função. |
| `bandScales` | Leitura / Escrita | Documento da escala de banda contendo as atribuições operacionais brutas vinculadas. |
| `instruments` | Leitura | Validação de que os instrumentos atribuídos pertencem legitimamente à organização operacional ativa. |
| `organizations/{orgId}/_commandReceipts` | Leitura / Escrita | Subcoleção privada que armazena os recibos de transações executadas para prevenção de duplicidade (Idempotência). |

---

## 5. Fluxos de Interação Inter-Serviços (Dataflow)

### A. Fluxo de Publicação de Escala de Música

```
[Endpoint Post]
       │
       ▼
[Validate Payload] ──► Se inválido, lança ValidationError (400)
       │
       ▼
[Start Firestore Transaction]
       │
       ├─► 1. Busca Recibo de Idempotência
       │      └─► Se existe e fingerprint bate: retorna resultado em cache (200, fromCache: true)
       │      └─► Se existe e fingerprint difere: lança conflito (409)
       │
       ├─► 2. Lê dados do modificador, escala de música atual, e valida multi-tenant
       │
       ├─► 3. Resolve escalas de banda associadas (anterior e nova) e valida propriedade
       │
       ├─► 4. Carrega instrumentos e membros ativos da organização
       │      └─► Se houver integrante escalado inativo ou instrumento órfão: lança erro (400)
       │
       ├─► 5. Deleta/Inativa respostas e presenças ativas anteriores (caso republicação)
       │
       ├─► 6. Gera novos EventAssignments e cria documentos pendentes na subcoleção "responses"
       │
       ├─► 7. Resolve reconciliação de notificações comparando atribuições antigas vs novas
       │      └─► Salva as notificações direcionadas em "organizations/{orgId}/notifications"
       │
       ├─► 8. Executa link bidirecional nas escalas de banda (Cura Automática)
       │
       ├─► 9. Atualiza o documento principal "scales/{scaleId}" com status "published" e nova revisão
       │
       └─► 10. Escreve Recibo de Idempotência em "_commandReceipts"
       │
       ▼
[Commit Transaction] ──► Retorna sucesso (200) ao usuário
```

### B. Fluxo de Registro de Presença Individual

```
[Endpoint Post "/my-response"]
       │
       ▼
[Basic Payload Check] ──► Status deve ser 'accepted', 'maybe' ou 'declined'
       │
       ▼
[Start Firestore Transaction]
       │
       ├─► 1. Busca recibo de idempotência (previne duplicidade)
       │
       ├─► 2. Carrega escala e valida multi-tenant e status "published"
       │
       ├─► 3. Executa verificação de início de evento (Temporal Check)
       │      └─► Se data/horário local do evento já passou: rejeita resposta (400)
       │
       ├─► 4. Filtra atribuições ativas do usuário logado na escala
       │      └─► Se usuário não está escalado: lança erro (400)
       │
       ├─► 5. Para cada função escalada ativa:
       │      ├─► Atualiza/Cria documento sob "scales/{scaleId}/responses/{eventAssignmentId}"
       │      └─► Incrementa a revisão individual da resposta
       │
       ├─► 6. Grava log de auditoria do histórico de presenças
       │
       └─► 7. Grava recibo em "_commandReceipts"
       │
       ▼
[Commit Transaction] ──► Retorna confirmação e revisão atualizada (200)
```

---

## 6. Tratamento de Erros e Motor de Idempotência

O ecossistema utiliza uma estratégia defensiva baseada em transações e tratamento padronizado de exceções para manter a integridade operacional.

### Mecânica de Idempotência
1. **Identificador Único (`ReceiptId`):** Computado de forma estável no backend através do algoritmo SHA-256 combinando a ID da organização e a chave enviada:
   $$\text{ReceiptId} = \text{SHA256}(\text{orgId} + ":" + \text{idempotencyKey})$$
2. **Impressão Digital do Payload (`Fingerprint`):** Computado recursivamente ordenando as chaves do objeto de payload de entrada para garantir estabilidade sintática:
   $$\text{Fingerprint} = \text{SHA256}(\text{DeterministicString}(\text{payload}))$$
3. **Casos de Proteção:**
   * **Reenvio Idêntico:** Se o mesmo `ReceiptId` e `Fingerprint` forem detectados, a transação aborta leituras adicionais de negócio e retorna instantaneamente o resultado persistido do cache do recibo, garantindo velocidade de resposta (latência ultra baixa) e sem gerar duplicidade física de notificações/registros.
   * **Reenvio Conflitante:** Se o mesmo `ReceiptId` for enviado com `Fingerprint` diferente, o sistema retorna `409 Conflict`, blindando a integridade e impedindo a gravação de dados incongruentes.

### Tabela de Mapeamento de Códigos de Erro HTTP

| Código do Erro de Negócio | Status HTTP | Causa Raiz | Mensagem Retornada ao Cliente |
| :--- | :--- | :--- | :--- |
| `IDEMPOTENCY_CONFLICT` | `409 Conflict` | Reenvio da mesma chave de idempotência com payload ou usuário modificado. | "Esta chave de idempotência já foi utilizada com um payload diferente." |
| `BAND_SCALE_ALREADY_LINKED` | `409 Conflict` | Tentativa de associar uma escala de banda que já está vinculada a outra escala de músicas. | "A escala de banda especificada já está vinculada a outra escala de músicas." |
| `TENANT_SCOPE_MISMATCH` | `403 Forbidden` | Tentativa de acessar/modificar recursos que pertencem a outra organização (vazamento multi-tenant). | "Acesso negado: o recurso não pertence a esta organização." |
| `VALIDATION_ERROR` | `400 Bad Request` | Formato incorreto de payload, datas impossíveis ou campos não permitidos. | Detalhes específicos de validação (ex: "Formato de data inválido. Deve ser YYYY-MM-DD.") |
| `PAYLOAD_CONFLICT` | `400 Bad Request` | Divergência lógica entre campos do payload (ex: `payload.bandScaleId` difere de `scalePatch.bandScaleId`). | "Divergência entre payload.bandScaleId e scalePatch.bandScaleId." |
| `USER_NOT_ACTIVE_MEMBER` | `400 Bad Request` | Tentativa de escalar um integrante inativo ou que foi removido da congregação. | "Usuário {uid} não é membro ativo da organização." |
| `INSTRUMENT_NOT_FOUND` | `400 Bad Request` | Tentativa de atribuir um instrumento ou função ministerial que não existe na organização ativa. | "Instrumento {id} não encontrado na organização." |
| `EVENT_ALREADY_STARTED` | `400 Bad Request` | Tentativa de responder presença para um evento que já foi iniciado. | "O horário deste evento já começou e a resposta não pode mais ser alterada." |
| `NOT_ASSIGNED` | `400 Bad Request` | Usuário logado tentou registrar presença em um evento onde não foi formalmente escalado. | "Você não está escalado neste evento." |
| `NOT_PUBLISHED` | `400 Bad Request` | Tentativa de registrar presença em uma escala de músicas que ainda está em rascunho. | "A escala não está publicada." |
