# MusicScale — entrada direta e SSO MillionsNest

## Origem oficial

A URL oficial do produto é `https://musicscale.millionsnest.com/start`.
Endereços técnicos `*.web.app` podem existir como infraestrutura de Firebase Hosting, mas não são a URL canônica do produto.

## Autoridade

O MillionsNest Hub (`https://www.millionsnest.com`) continua sendo a autoridade central de identidade, organização ativa, RBAC e entitlement. O MusicScale não cria uma segunda autoridade de conta ou billing.

## Fluxo de entrada direta

1. O usuário abre `https://musicscale.millionsnest.com/start`.
2. `EcosystemProvider` tenta consumir `ecosystem_ctx` antes de inicializar o restante do contexto.
3. Se o handoff existe, `handoffHelper` valida app/protocolo/uid/expiração, remove o segredo da URL e faz `signInWithCustomToken` no Firebase Auth local.
4. Se não existe handoff e já há uma sessão Firebase local válida do MusicScale, o fluxo continua normalmente.
5. Se não existe sessão local e o host é exatamente `musicscale.millionsnest.com`, `StartGateway` redireciona para `https://www.millionsnest.com/musicscale/launch`.
6. O Hub reutiliza sua sessão Firebase/Google central quando disponível; se necessário, autentica e retorna ao launch path allowlisted.
7. O Hub revalida a organização e o acesso no servidor e usa o handoff canônico já existente para retornar ao `/start` do MusicScale.
8. Desenvolvimento/localhost e a rota explícita `/login` preservam o comportamento standalone existente.

## Fronteiras de segurança

- Nunca compartilhar cookies crus entre subdomínios.
- Nunca confiar em role, organizationId ou entitlement recebidos apenas do browser como autoridade.
- O handoff é curto, específico para `musicscale` e revalidado pelo Hub.
- O `ecosystem_ctx` é retirado do histórico/URL antes do trabalho assíncrono.
- Handoff inválido, expirado ou indisponível falha fechado pelo `handoffHelper` e não deve criar loop de redirect.
- Esta integração não altera billing, membership, Firestore Rules nem as permissões internas do MusicScale.

## Arquivos de referência

- `pages/StartGateway.tsx`: decide a entrada direta quando não há sessão local.
- `services/ecosystem/directEntry.ts`: origem/launch canônicos e política testável de redirect.
- `services/ecosystem/handoffHelper.ts`: consumo e validação do handoff.
- `contexts/EcosystemContext.tsx`: bootstrap do contexto MillionsNest.
- `tests/unit/direct-official-domain-sso.test.ts`: regressão do contrato de entrada direta.

A configuração global de domínios, os estados de rollout dos demais apps e o passo a passo de Firebase Hosting/DNS ficam no repositório do Hub em `docs/ECOSYSTEM_APP_DOMAINS_AND_SSO.md`.
