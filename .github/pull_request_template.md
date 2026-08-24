## Objetivo

Descreva o problema e a menor mudança necessária para resolvê-lo.

## Escopo

- [ ] A alteração está limitada ao objetivo declarado.
- [ ] Não há refatoração cosmética ou arquivo alheio ao escopo.
- [ ] Não há segredo, token, credencial, dado real de produção ou informação pessoal no diff/logs/artifacts.

## Segurança e arquitetura

- [ ] Multi-tenant e `organizationId` foram preservados.
- [ ] RBAC/Auth/membership/owner continuam validados no backend quando aplicável.
- [ ] Firestore Rules não foram enfraquecidas.
- [ ] Billing/entitlements continuam pertencendo ao MillionsNest.
- [ ] Nenhuma ação de produção, backfill ou deploy está implícita neste PR.

## Produto

- [ ] Strings visíveis novas/alteradas respeitam PT/EN/ES quando aplicável.
- [ ] Mobile/PWA/offline foram considerados quando aplicável.
- [ ] Estados de loading/erro/vazio foram preservados quando aplicável.

## Evidências

Liste somente comandos realmente executados e seus resultados:

- [ ] Testes direcionados relevantes
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`

### Resultados

```
Cole aqui um resumo dos resultados, sem segredos ou dados de produção.
```

## Produção

- [ ] Este PR não exige ação produtiva; ou
- [ ] A ação produtiva necessária está documentada abaixo e continua PENDENTE de autorização explícita.

Ação pendente, se houver:

> Nenhuma.

## Licença e contribuição

Ao enviar este PR, confirmo que li `CONTRIBUTING.md` e que tenho direito de submeter as alterações propostas sob os termos de contribuição ali descritos.
