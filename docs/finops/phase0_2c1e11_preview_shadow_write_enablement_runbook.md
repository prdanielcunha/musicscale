# Fase 0.2C.1E.11 — Runbook de Habilitação Controlada da Shadow-Write FinOps em Preview/Staging

Este documento atua como o Runbook oficial, versionado e auditável, orientando a ativação futura de forma totalmente isolada da funcionalidade shadow-write FinOps.

## 1. Estado atual aprovado

*   A funcionalidade shadow-write FinOps está totalmente integrada na rota `/api/ai-import` do `server.ts`.
*   Toda a lógica secundária de escrita paralela está devidamente protegida e isolada de forma condicional através da flag `AI_IMPORT_FINOPS_WRITE_PATH_ENABLED === "true"`.
*   A flag de funcionalidade está configurada como desligada por padrão (default-off).
*   Garantia estrita de que `QUOTA_BLOCKED não bloqueia usuário` nesta fase (eventuais bloqueios por quota ocorridos em transações paralelas não bloqueiam nem prejudicam o fluxo principal de requisições de usuários).
*   Garantia estrita de que `cache/idempotency não fazem short-circuit` (retornos de acertos de cache ou de idempotência interceptados no caminho de sombra não realizam curto-circuito e não alteram a execução da rota para o usuário).
*   A resposta pública fornecida pelo endpoint `/api/ai-import` permanece estritamente inalterada e livre de campos relacionados a faturamento e FinOps.
*   Production permanece fora do escopo desta fase operacional.

## 2. Escopo permitido desta habilitação

*   **Ambientes:** Ativação permitida somente em Preview/Staging (não produtivo).
*   **Production:** Expressamente proibido ativar qualquer flag ou alterar segredos no ambiente de Production.
*   **Modificações:** Nenhuma alteração em código-fonte, regras de segurança do Firestore (`firestore.rules`), comportamento do frontend, sistema de controle de acessos (RBAC), modelos de cobrança ou faturamento do usuário final é permitida durante a vigência desta fase.

## 3. Pré-requisitos obrigatórios

Antes de iniciar qualquer procedimento de habilitação controlada no ambiente correspondente, certifique-se de preencher todos os seguintes critérios:

*   Deploy ativo do ambiente de Preview/Staging apontando diretamente para o commit aprovado na branch `main`.
*   Sistemas de visualização de logs em tempo real (ex: Google Cloud Logging) acessíveis e operacionais.
*   Acesso administrativo ou de leitura ao console do Firestore correspondente ao ambiente de Preview/Staging.
*   Usuário de testes devidamente cadastrado e autorizado a interagir com a API `/api/ai-import`.
*   ID de organização (`organizationId`) válido associado ao usuário de teste.
*   Payload de teste limpo com texto pequeno (ex: letra de música curta e sem dados sensíveis) preparado para importação.
*   Presença obrigatória da variável confidencial `AI_FINOPS_HMAC_SECRET` previamente provisionada no painel de ambiente, sendo um pré-requisito obrigatório antes da flag de controle.
*   Manutenção da variável `AI_IMPORT_FINOPS_WRITE_PATH_ENABLED` no estado inicial desligada antes de iniciar o protocolo.

## 4. Variáveis de ambiente

Estas variáveis governam a ativação transparente da rota paralela de monitoramento:

### `AI_FINOPS_HMAC_SECRET`
*   **Descrição:** Segredo criptográfico utilizado para a geração de assinaturas SHA-256 e hashes determinísticos de dados de entrada do usuário.
*   **Obrigatoriedade:** É obrigatório antes da flag de ativação.
*   **Privacidade:** Valor confidencial de infraestrutura que nunca deve ser exibido, impresso ou exportado nos logs sob nenhuma hipótese. Deve residir somente em Preview/Staging nesta etapa de validação.

### `AI_IMPORT_FINOPS_WRITE_PATH_ENABLED`
*   **Descrição:** Flag principal para acionamento do caminho secundário de shadow-write.
*   **Valores aceitos:** Deve ser configurada exatamente para a string literal `"true"` para ativação. O runbook orienta habilitar exatamente como `AI_IMPORT_FINOPS_WRITE_PATH_ENABLED=true`.
*   **Ativação:** Restrita unicamente a ambientes não produtivos. Configuração permitida somente em Preview/Staging. Não ativar em Production.
*   **Rollback:** Deve ser desligada imediatamente ao menor sinal de anomalia ou desvio do comportamento esperado.

### `AI_IMPORT_FINOPS_READ_PATH_ENABLED`
*   **Descrição:** Flag governando o comportamento paralelo do shadow-read path.
*   **Separação:** Funciona como controle independente. Não deve ser confundida com a flag de escrita (`AI_IMPORT_FINOPS_WRITE_PATH_ENABLED`). Pode permanecer desligada durante a execução deste runbook de escrita paralela.

## 5. Procedimento de habilitação em Preview/Staging

Siga rigidamente este procedimento passo-a-passo:

1.  **Verificar Commit:** Confirme se o deploy de Preview reflete exatamente o estado homologado da branch `main`.
2.  **Verificar Escopo de Production:** Assegure que as chaves e painéis de Production não estão sofrendo alterações.
3.  **Configurar Secret:** Configure a variável `AI_FINOPS_HMAC_SECRET` com um segredo forte de teste no painel de ambiente do Preview/Staging.
4.  **Confirmar Inércia:** Execute um teste básico de importação com a flag de ativação desligada e valide se a rota responde normalmente sem logs ou caminhos de sombra ativos.
5.  **Ativar Flag:** Configure a variável `AI_IMPORT_FINOPS_WRITE_PATH_ENABLED=true` no ambiente de Preview/Staging.
6.  **Redeploy:** Permita que a plataforma aplique as configurações do ambiente de forma estável.
7.  **Enviar Requisição:** Faça o envio do payload de teste no endpoint `/api/ai-import` usando as credenciais e organização de teste autorizadas.
8.  **Verificar Resposta Pública:** Valide se o retorno HTTP recebido é idêntico ao formato clássico e funcional, garantindo o response público inalterado.
9.  **Auditar Response:** Assegure de forma estrita que o response não contém nenhum dos seguintes metadados de infraestrutura FinOps: `finOps`, `aiFinOps`, `cacheHit`, `idempotencyHit`, `quotaStatus`, `quotaBlocked`, `billing`, `usage`, `plan` ou `entitlement`.
10. **Inspecionar Logs:** Abra o gerenciador de logs e filtre pelo `requestId` da requisição enviada. Confirme que os logs secundários executaram sem vazamentos ou erros de infraestrutura.
11. **Conferir Firestore:** Acesse o console do Firestore no ambiente de teste e confirme se os documentos de contabilidade e cache foram gerados nos paths esperados.
12. **Desligar Imediatamente:** Caso ocorra qualquer exceção 500, desvio de comportamento ou aumento anômalo de latência, desligue a flag imediatamente seguindo o procedimento de rollback.

## 6. Paths esperados no Firestore

A contabilidade silenciosa da transação paralela deve persistir registros estritamente nos seguintes caminhos de documento:

*   `organizations/{orgId}/aiUsage/{monthKey}` (Contador mensal de consumo de tokens)
*   `organizations/{orgId}/aiDailyUsage/{dayKey}` (Contador diário de consumo de tokens)
*   `organizations/{orgId}/aiUsage/{monthKey}/events/{requestId}` (Documento de auditoria de eventos FinOps)
*   `organizations/{orgId}/aiIdempotency/{idempotencyKey}` (Controle de concorrência e idempotência do job)
*   `organizations/{orgId}/aiCache/{cacheKey}` (Registro de cache de respostas higienizadas)
*   `organizations/{orgId}/aiRateLimits/{rateLimitBucketKey}` (Identificador de slots de concorrência e controle de limites rápidos)

### Garantia de Privacidade
É **terminantemente proibido** salvar ou persistir quaisquer conteúdos brutos das entradas ou saídas do usuário final nessas coleções, incluindo:
*   `rawText` (texto bruto de entrada)
*   `url completa` (links originais informados)
*   `lyrics` (letras de músicas originais ou estruturadas)
*   `chords` (cifras geradas ou informadas)
*   `prompt` (prompts de sistema enviados ao Gemini)
*   `headers`, `cookies`, `authorization`, `token`, `secret` (cabeçalhos e tokens de tráfego)
*   `html` (códigos HTML de páginas raspadas)
*   `stack` ou `message bruta` (pilhas completas de rastreamento de erro)
*   `resposta crua da IA` (strings brutas extraídas das requisições externas)

## 7. Checklist de logs seguros

### Logs Autorizados (Dados de Infraestrutura Seguros)
Os registros em console de logs podem conter apenas:
*   `requestId`
*   `status` (status operacional da transação de faturamento)
*   `outcome` (sucesso ou tipo seguro de falha mapeado)
*   `estimatedInputTokens`
*   `estimatedOutputTokens`
*   `hasPaths` (flag indicando se as rotas de persistência existem)
*   `hasCacheKey`
*   `hasIdempotencyKey`
*   `hasRateLimitBucketKey`
*   `quotaStatusCode`
*   `safeErrorCode` (código de erro higienizado e padronizado)

### Logs Bloqueados (Dados Sensíveis / PII)
**NUNCA** logar ou despejar nas ferramentas de log as variáveis ou propriedades:
*   `rawText`
*   `url completa`
*   `lyrics`
*   `chords`
*   `prompt`
*   `headers`, `cookies`, `authorization`, `token`, `secret`
*   `html`
*   `stack` ou `message bruta`
*   `resposta crua da IA`

## 8. Critérios de sucesso

A habilitação controlada em Preview/Staging será considerada um sucesso absoluto se:

*   A importação de músicas por IA ocorre sem apresentar novos erros ou falhas de usuário.
*   A resposta pública fornecida ao usuário final permanece estritamente inalterada (response público inalterado).
*   Todas as saídas de logs observadas cumprem os requisitos estritos de logs seguros e ausência de vazamento de PII.
*   Os documentos correspondentes são gravados corretamente no Firestore de Preview nos caminhos estipulados.
*   O documento de idempotência (`aiIdempotency`) correspondente transita com sucesso para o estado final `COMPLETED` ou `FAILED`, evitando permanecer preso na fase intermediária `PROCESSING`.
*   O cache gerado (`aiCache`) preenche as chaves de forma higienizada e livre de conteúdo bruto de letras/cifras originais.
*   Mesmo em simulação de estouro de quota (`QUOTA_BLOCKED`), a operação primária do usuário transcorre sem bloqueios ou interrupções.
*   O ambiente de Production permanece intocado e inalterado.

## 9. Critérios de rollback imediato

A flag `AI_IMPORT_FINOPS_WRITE_PATH_ENABLED` deve ser desligada de forma urgente se ocorrer:

*   Qualquer erro HTTP 500 originado durante a execução da rota de importação após a habilitação.
*   Lentidão relevante ou aumento injustificado no tempo de processamento da resposta (`processingTimeMs`).
*   Alterações repentinas ou inclusão de novos campos no formato de payload retornado publicamente ao frontend.
*   Identificação de vazamento de dados sensíveis, credenciais ou valores criptográficos nas saídas de console.
*   Persistência inadequada de strings de letras de música, dados de entrada ou URLs originais no Firestore.
*   Criação de novos caminhos ou subcoleções inesperadas fora da modelagem especificada no Firestore.
*   Prejuízos, erros de permissão ou bloqueios inexplicáveis à experiência legítima do usuário.

## 10. Procedimento de rollback

1.  **Desativar Flag:** Altere o valor e execute o comando para desligar AI_IMPORT_FINOPS_WRITE_PATH_ENABLED de forma definitiva no ambiente de Preview/Staging.
2.  **Redeploy:** Faça o redeploy se necessário para garantir o estado original e limpo.
3.  **Testar Rota:** Repita a requisição de importação de teste e confirme o comportamento padrão em inércia.
4.  **Confirmar Normalidade:** Valide se os logs paralelos pararam de ser emitidos.
5.  **Registrar Ocorrência:** Documente o `requestId`, o horário do incidente e descreva detalhadamente o motivo do rollback para depuração segura no repositório.
6.  **Barrar Promoção:** Alerta crítico para não promover para Production até o isolamento e saneamento do bug detectado.

## 11. Proibições explícitas

*   **Ativação em Production:** Terminantemente proibido ativar ou testar em Production sob qualquer circunstância.
*   **Alteração de Código:** Proibido alterar `server.ts` ou componentes produtivos durante o teste de viabilidade operacional.
*   **Firestore Rules:** Proibido alterar o arquivo `firestore.rules`.
*   **Mudança de Resposta:** Proibido retornar chaves de faturamento ou cache FinOps na interface visível do cliente.
*   **Bloqueios Falsos:** Proibido tratar `QUOTA_BLOCKED` como negação HTTP legítima nesta fase.
*   **Interferências:** Proibido expor o usuário final aos dados em voo da transação paralela.
*   **Garantias adicionais:** É estritamente proibido retornar qualquer informação ao client público, ou seja, de forma alguma vamos retornar cache hit ou retornar idempotency hit ao usuário.
*   **Saneamento de logs:** Sob nenhuma hipótese devemos logar rawText, url completa, lyrics, chords ou prompt.

## 12. Próxima fase possível

Uma vez consolidada a fase de runbook e testes estáticos com sucesso e segurança:
*   **Próxima Fase:** `0.2C.1E.12 — Execução controlada em Preview/Staging e auditoria dos artefatos gerados`.
*   **Restrições:** Mesmo em fases futuras, a operação continuará livre de ativação em Production, livre de bloqueio real ao usuário final, e sem retorno público de dados FinOps/cache na resposta.
