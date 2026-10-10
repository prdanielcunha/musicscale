# MusicScale — Release Guard permanente

O Release Guard sincroniza o SHA exato entre `main` e `production` somente depois de QA integral e checagens de histórico. **SHA igual não equivale a deploy Firebase realizado.**

## Regras
1. Desenvolver em branch de trabalho; integrar por PR em `main`; proteger `production`.
2. Exigir o workflow completo `MusicScale QA Automation` com sucesso em push na `main` para o SHA específico, incluindo jobs `test` e `functions`.
3. Aceitar somente `fast-forward` sem force. Nunca fazer migração, reset, rebase destrutivo, alteração em dados de clientes, billing ou infraestrutura durante sincronização.
4. Bloquear mudanças sensíveis (auth, Firestore, RBAC/Hub, server, Functions, Stripe, marcadores e workflows de deploy, o próprio guardião e AGENTS.md). Elas exigem release assistida com revisão separada e aprovação explícita.
5. Revalidar as refs imediatamente antes de avançar; confirmar SHAs iguais depois.

## Arquivos adicionados
- `scripts/release-guard.mjs`: validador e promotor GitHub API com `force:false`.
- `scripts/release-guard.test.mjs`: testes unitários de políticas.
- `.github/workflows/release-guard.yml`: testes em PR e promoção somente por `workflow_dispatch` com SHA completo e confirmação `PROMOTE`.

## Configuração GitHub fora do código
- Manter em `production` as regras contra force push/exclusão e os checks `test` e `functions`.
- Para segurança permanente, exigir Pull Request para colaboradores comuns. A automação direta precisará de um GitHub App de release com bypass estritamente limitado, configurado por administrador. O `GITHUB_TOKEN` sozinho não é bypass e pode ser bloqueado corretamente.
- A declaração de `environment: release-synchronization` no YAML não habilita aprovação obrigatória; revisores do ambiente exigem configuração administrativa.
- Eventos GitHub Actions gerados por `GITHUB_TOKEN` podem não disparar QA e deploy em push. Certificar publicação no Firebase separadamente.

## Deploy e preservação de clientes
O workflow **não** executa Firebase Hosting, Cloud Run, Functions, Firestore, migrations nem Stripe. `ops/hosting-release.txt` aciona o Hosting atual; o Cloud Run possui filtros diferentes. Para publicação real, seguir os workflows oficiais, QA, smoke, autenticação e conferência do SHA implantado. Preservar escalas, funções ministeriais, convites, organizações, IA, assinaturas e permissões. Se as branches divergirem ou houver arquivos críticos, bloquear e resolver por revisão/PR, jamais force push.
