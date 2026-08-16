# QA fallback enquanto GitHub Actions estiver indisponível

## Estado

O workflow canônico `.github/workflows/musicscale-qa.yml` continua sendo a certificação completa do repositório. Em 2026-08-16, os runners do GitHub Actions deixaram de iniciar por bloqueio de billing/spending da conta, antes de qualquer step de código.

Este documento define um fallback temporário e explícito. Ele não reclassifica uma falha de infraestrutura como sucesso e não substitui integralmente o workflow canônico.

## Gate Vercel validado

A branch dedicada `qa-validation` é permitida pelo `vercel.json`. O build da Vercel executa `npm run ci:vercel`, que agora cobre:

```text
npm run test:ci:emulator
  -> bootstrap local e verificado do Amazon Corretto 21
  -> Firebase Auth + Firestore Emulator reais
  -> global-library-search no Emulator
  -> music-scale-security-rules no Emulator
npm run test:ci:portable
  -> npm run lint
  -> npm run test:ui
  -> npm run test:release:core
npm run build
```

A execução de prova em 2026-08-16 confirmou na Vercel:

- Java 21.0.12 carregado pelo script de QA com verificação SHA-256;
- Firebase Auth e Firestore Emulator iniciados com o projeto demo `demo-musicscale`;
- `global-library-search`: 14/14 testes aprovados;
- `music-scale-security-rules`: 45/45 testes aprovados em `SECURITY_RULES_MODE=FIREBASE_EMULATOR`;
- suíte Vitest completa e contratos core executados pelo gate portátil;
- build Vite/PWA/server concluído.

Isso significa que o fallback passou a cobrir também a certificação real das Rules no Emulator. Nenhuma Firebase Rule é implantada por esse processo.

## Limite ainda não substituído: browser E2E

Também foi feita uma prova controlada de Playwright na Vercel. O Chromium e o headless shell foram baixados corretamente e o servidor E2E conseguiu iniciar depois de remover `VERCEL=1` apenas do subprocesso de QA. Porém o browser não conseguiu iniciar porque a imagem de build da Vercel não contém `libnspr4.so` e as demais dependências de sistema do Chromium não são instaladas pelo projeto.

Por isso, enquanto os runners do GitHub estiverem bloqueados, continuam sem substituto equivalente:

- smoke Playwright em desktop-chromium, mobile-chromium, mobile-webkit e tablet-webkit;
- Full E2E QA Suite;
- artefatos Playwright/test-results do workflow oficial.

Não instalar bibliotecas de sistema ad hoc nem relaxar testes para transformar esse bloqueio de ambiente em falso sucesso. Mudanças browser-critical devem registrar explicitamente a ausência do gate E2E até o GitHub Actions voltar.

## Procedimento operacional

1. Desenvolver em branch própria e revisar o diff.
2. Para validação enquanto Actions estiver indisponível, reproduzir o candidato sobre `qa-validation` ou usar o fluxo de validação aprovado que execute o mesmo `ci:vercel`.
3. Exigir status Vercel `success` com execução real do build command; `Canceled by Ignored Build Step` não conta como validação.
4. Para mudanças em Rules/tenant/security, exigir que os logs mostrem `SECURITY_RULES_MODE=FIREBASE_EMULATOR` e o gate real aprovado.
5. Registrar Playwright/E2E como infraestrutura bloqueada enquanto o ambiente alternativo não possuir as dependências necessárias.
6. Restaurar a certificação completa do GitHub Actions assim que o billing/spending da conta for corrigido.

## Incidente de fixture detectado pelo fallback

Na primeira execução real do gate portátil em 2026-08-16, seis testes de `modern-scale-form-attention-routing.test.tsx` falharam porque a BandScale fixture usava `2026-08-15`. O componente corretamente filtra BandScales anteriores ao dia atual, logo o fixture deixou de ser elegível quando a data mudou para 2026-08-16. O teste foi tornado determinístico usando uma data futura estável, sem alterar o comportamento do produto e sem pular/quarentenar a cobertura.
