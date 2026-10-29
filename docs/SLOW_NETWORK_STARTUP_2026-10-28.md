# MusicScale — abertura em conexões lentas (2026-10-28)

Base auditada: `013cbdef62b80011856f8a49ab25b2812131bd0f` (main e production idênticas no início). A leitura HTTP do domínio oficial retornou versão `0.11.2-beta.6`; o arquivo de entrada servido contém `APP_BOOT_TIMEOUT` e `I18N_BOOT_TIMEOUT`, confirmando esse defeito no bundle público atual.

## Causas comprovadas no código

1. `index.tsx` rejeitava permanentemente o `React.lazy` após 12 segundos. Um download bem-sucedido mais tarde não removia a tela de erro sem recarga.
2. A inicialização de i18n importava PT/EN/ES e um módulo de diagnóstico que também importava os três catálogos. A verificação completa, usada em Perfil, entrava no caminho crítico.
3. O registro automático do service worker no evento load podia iniciar o precache completo antes da tela operacional. O build original prevê 134 entradas / 4.142 MiB descomprimidos; isso não equivale a bytes transferidos em toda abertura.
4. O CSS da fonte Inter, hospedado fora do domínio, era uma folha de estilo que bloqueava a primeira pintura.

## Alterações

- O aviso estático começa a contar antes de DOMContentLoaded, que pode ficar retido pelo download do script de entrada. Mantém PT/EN/ES.
- Downloads de App/i18n continuam pendentes enquanto houver carregamento; falhas reais preservam o ErrorBoundary e a recuperação de chunks existentes. Após 12s, a tela leve PT/EN/ES informa que continua carregando e oferece recarga manual.
- Português permanece integrado como fallback. EN/ES são importados sob demanda, com o backend já instalado do i18next. A entrada aguarda `i18nReady`; mudanças de idioma continuam funcionando. Extensões de curadoria, Premium e novidades foram preservadas.
- O rastreador de chaves ausentes foi separado da comparação completa dos catálogos; a API existente de diagnóstico continua exportada para Perfil.
- O service worker passa a ser registrado três segundos depois da primeira tela operacional, da prontidão do gateway ou da tela pública de login. Espera conexão/aba visível. Mantém todos os recursos previstos para offline e o mecanismo existente de atualização, sem forçar recarga de formulários.
- Inter continua sendo a fonte final, mas sua folha externa não bloqueia a pintura; há fallback noscript.

## Comparação reproduzível dos builds

Ambos os builds usaram as mesmas dependências instaladas e Vite em modo production. O grafo foi percorrido com `es-module-lexer`, contando somente imports estáticos, sem duplicação. A etapa pública inclui entrada + App + i18n em PT; a etapa painel acrescenta PrivateApp + DashboardPage. Gzip calculado arquivo a arquivo com Node zlib. Não representa LCP, tempo de autenticação ou medição de rede real.

| JavaScript | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| Etapa inicial, bytes sem compressão | 873992 | 670651 | 23,3% |
| Etapa inicial, bytes gzip | 283312 | 217146 | 23,4% |
| Até o painel, bytes gzip | 612608 | 546480 | 10,8% |

O pacote offline completo continua com aproximadamente 4,15 MiB sem compressão: a melhoria é a prioridade de download, preservando o conteúdo offline, além da redução do grafo crítico. O navegador pode verificar automaticamente atualizações de um worker previamente instalado durante uma navegação, independentemente do registro explícito adiado; a mudança não promete eliminar toda concorrência de atualizações em clientes antigos.

## Validação

- `npm run lint`: aprovado.
- `npm run test:ui`: 267 arquivos aprovados, 8 ignorados; 2.133 testes aprovados, 174 ignorados. Inclui abertura com import resolvendo após 20s, registro da PWA após prontidão, caminho público, reconexão e cancelamento ao desmontar.
- Teste do aviso estático sem DOMContentLoaded: três casos aprovados (PT/EN/ES).
- Teste adicional real de i18next: três casos aprovados (PT-BR, EN-US, ES-ES), incluindo troca de idioma durante a sessão.
- Build completo: materialização de assets, Vite, esbuild do backend e contrato de branding/dist aprovados.
- Core release: os dez scripts de `test:release:core` e os contratos shell-split/login-deferral aprovados.
- Neste executor o CLI `tsx` tenta abrir um socket Unix bloqueado (`EPERM`). `npm run build` foi tentado e falhou por essa restrição; as mesmas etapas foram executadas com `node --import tsx` no lugar do wrapper CLI. Nenhuma alteração no build ou nas dependências foi necessária.

## Limites e publicação

Não houve alteração em Auth, EcosystemContext, Firestore, billing, regras, schemas ou dados. As verificações canônicas de acesso continuam obrigatórias. O primeiro acesso ainda precisa de conexão para obter os arquivos e validar a conta; cache não concede acesso.

Esses resultados locais não certificam navegação autenticada em produção, Safari real ou rede 3G real. O QA completo/E2E do SHA do PR e a prévia ainda devem ser conferidos antes da promoção pelo Release Guard. Este documento não é comprovação de deploy. O primeiro envio foi bloqueado pela revisão automática; em seguida o proprietário autorizou explicitamente o envio ao GitHub, a conclusão da publicação e a sincronização final das branches. Release assistida: a única alteração sensível é o marcador de Hosting, revisado para acionar apenas a publicação frontend oficial. A promoção continua condicionada ao QA completo no SHA exato da main.

## Referências primárias pesquisadas

- https://web.dev/learn/performance/code-split-javascript
- https://www.i18next.com/how-to/add-or-load-translations
- https://www.i18next.com/overview/configuration-options
- https://vite-pwa-org.netlify.app/guide/register-service-worker
- https://vite-pwa-org.netlify.app/guide/faq
- https://firebase.google.com/docs/firestore/manage-data/enable-offline
