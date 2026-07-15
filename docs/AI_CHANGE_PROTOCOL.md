# Protocolo de Mudanças (AI Change Protocol)

Este documento define o protocolo OBRIGATÓRIO de validação para qualquer mudança (Pull Request, Alteração via IDE ou Execução autônoma de Agentes GenAI) a ser injetada no repositório MusicScale. Se você é uma Inteligência Artificial operando no projeto, siga estas etapas incondicionalmente.

## PARTE A — ANTES DE ALTERAR

1. **Documentação e Compreensão**
   - Ler integralmente o arquivo `/AGENTS.md`.
   - Ler integralmente o arquivo `/docs/ARCHITECTURE_CURRENT.md`.
   - Identificar exatamente qual é o pedido ou intenção operacional da modificação.

2. **Demarcação de Escopo e Limites**
   - Definir de maneira binária o que ESTÁ e o que NÃO ESTÁ dentro do escopo da solicitação de alteração. Se pediram a cor de um botão, não altere o arquivo de autenticação associado.

3. **Mapeamento de Riscos e Impactos**
   - Localizar os arquivos de origem que exigem edição e entender suas dependências de sub-módulos e serviços.
   - Analisar exaustivamente o risco no escopo "Multi-tenant". A alteração afeta a limitação por `organizationId`?
   - Analisar o impacto na hierarquia e roles "RBAC" (A alteração de frontend ou endpoint permite acessos indevidos?).
   - Ler as "Firestore Rules" (caso as alterações passem por tráfego de dados sensível) testando intelectualmente se as escritas serão aceitas pelas políticas correntes.
   
4. **Acordo Operacional**
   - Registrar o comportamento e estado atuais exatos da infraestrutura (Como as coisas funcionam agora?).
   - Definir com precisão empírica os "Critérios de Aceite" do ticket.
   - Definir como você vai testar se a entrega foi bem-sucedida.

---

## PARTE B — DURANTE A ALTERAÇÃO

1. **Cirurgia de Precisão**
   - Fazer alterações limitando-se ao tamanho mínimo viável que resolve o problema.
   - Não editar as estruturas ou formatar arquivos completos atrelados que não dependam imperativamente do patch.
   - Omitir "Refatorações de Boa Vontade" (Aquele código legível ou sintaxe preferida) que corrompem o histórico sem vínculo ao ticket funcional original.

2. **Estabilidade de Operação Padrão**
   - Preservar sem modificação as premissas de Isolamento e Locatário (Organização Ativa e RBAC/Roles).
   - Não basear o bloqueio apenas no "Hidden da View". Front-End não é segurança real, ele apenas aterra visibilidade. Nunca confiar no status exposto sem espelhar uma validação expressa equivalente e correspondente no Backend.
   - Não duplicar estruturas lógicas funcionais que já existam na aplicação (Serviços centrais de chamada devem ser reaproveitados em vez de copiados).

3. **Padronização Exigida**
   - Manter as restrições da arquitetura multilinguagem (`i18next`). Textos não padronizados e rígidos no JSX ou UI Component (pt-br puros sem transliteração) desativam a universalização do ecossistema.
   - O aplicativo atua em formato Responsive Cross-Device (Tablets e Mobiles). Garantir a reatividade da grid.
   - Cobrir transições vitais: Estado Vazio (Empty State), Estado de Carga (Spinners e Skeletons), Status Positivo (Success Feedback) e Tratamento de Queda e Recusa do EndPoint (Error Bounds e Logs/Toasts).
   - Operações Críticas pedem a prevenção à Idempotência ou tráfego múltiplo do botão submetido de forma acidental (Prevenir dupla inserção por concorrência).
   - Sob pena grave de bloqueio, não imputar códigos provisórios falsos, Hard-Codeds como UIDs específicos de usuário ou "Logs Mock" vazados e expostos à visualização no ambiente dev ou prod.

---

## PARTE C — APÓS A ALTERAÇÃO

1. **Auditoria Regressa do Patch (Verificação Local Automática)**
   - Revisar integralmente o diff dos arquivos que modificou. Algum import vazou? Um arquivo indesejado foi tocado? Reverta.
   - Rodar validação sintática padronizada:
     - Executar o linter interno: O comando `npm run lint` ou correspondente `npx tsc --noEmit` no terminal. Se emitir Warning de tipo inserido no pacote, interromper.
     - Compilar simulando o empacotamento operacional: `npm run build`.

2. **Auditoria Regressa do Código e UI (Verificação Humana Cognitiva)**
   - Auditar a segurança em base da inserção da Org ID (`organizationId`).
   - Auditar e conferir o RBAC (O botão submisso valida os claims da Role de Membro vs Master Owner?).
   - Internacionalização funcional presente no dicionário JSON atrelado (`locales/*.json`)?
   - Inspecionar a adaptabilidade responsiva mínima requerida ao design (Desktop e Mobile visualizados na grid).
   - Validar testes se eles passarem ou exigirem updates atrelados as reatividades alteradas no escopo do teste unitário nativo original.

3. **Separação Responsável de Contextos Falhos**
   - Informar os "Erros Preexistentes" e desvincular das "Avarias Introduzidas pela Mudança Recente". Se algo estava defeituoso antes, declare explicitamente no documento log final e não aborde, para proteção do sistema corrente.

4. **Documentação e Despacho ao Usuário Base**
   - Emitir o relatório claro. Informar arquivos alterados. Indicar os comandos invocados (Especialmente `lint`, `typecheck`, `build`) e os resultados verificáveis de Output destes comandos executados na consola local.
   - Declarar e enumerar as configurações manuais pendentes, chaves a definir de sistema pelo administrador (Ex: Env Var), se existir.

---

## PARTE D — CRITÉRIOS DE BLOQUEIO E REJEIÇÃO

A sua submissão será negada imediatamente ou declarada "Não Concluída" se:

- Induzir ou preservar falha no Builder do app original ou de compilação local (Erro de Webpack/Vite Build).
- Resultar na interdição ou falhas das camadas TypeScript inseridas.
- Impetrar Lint Errors como impeditivos gerados das quebras propostas.
- Derrubar testes unitários ou e2e correlacionados já estabelecidos antes por estresse indevido não intencional de comportamento original do método avaliado.
- Quebrar ou corromper funções de escopos isolados (Mudou mais que devia).
- Misturar visualização entre instâncias Organizacionais diferentes do Multi-Tenant.
- Travar a mecânica de Roles Autorizada de forma "Hard Coded", forçando ByPass provisórios (IF email === x THEN allow).
- Deixar a Segurança atestada integralmente nas Views Front-End, deixando o Server vulnerável.
- Exibir e enviar Senhas Pessoais, Tokens e chaves sistêmicas não autorizadas aos Logs externos e/ou ao repositório público (Exposição massiva e gravíssima).
- Não estampar a formatação linguística obrigatória dos elementos visíveis (i18n inexistente).
- Não estampar mensagens para Tratamentos de Erro ou EmptyStates ao submeter processamentos demorados no Front/Fluxos Críticos.
- Omitir o relatório de Evidências comprobatório dos Comandos da Validação Declarados (Atestar falso positivo de testes executados sem prints na simulação).
- Omitir Configuração Exigida em tempo real de aplicação e de deployment.
