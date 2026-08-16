# QA fallback enquanto GitHub Actions estiver indisponível

## Estado

O workflow canônico `.github/workflows/musicscale-qa.yml` continua sendo a certificação completa do repositório. Em 2026-08-16, os runners do GitHub Actions deixaram de iniciar por bloqueio de billing/spending da conta, antes de qualquer step de código.

Este documento define um fallback temporário e explícito. Ele não reclassifica uma falha de infraestrutura como sucesso e não substitui os gates que dependem de Firebase Emulator, Java ou Playwright.

## Gate portátil na Vercel

A branch dedicada `qa-validation` é permitida pelo `vercel.json`. Quando um commit é enviado a essa branch, a Vercel executa:

```text
npm run ci:vercel
  -> npm run lint
  -> npm run test:ui
  -> npm run test:release:core
  -> npm run build
```

Esse gate cobre TypeScript, a suíte Vitest completa, os contratos core do servidor e o build real Vite/server no ambiente de build da Vercel.

## O que continua exclusivo do gate completo

Enquanto os runners do GitHub estiverem bloqueados, permanecem sem substituto equivalente:

- Firebase Auth/Firestore Emulator completo;
- instalação e execução dos browsers Playwright;
- smoke em desktop-chromium, mobile-chromium, mobile-webkit e tablet-webkit;
- Full E2E QA Suite;
- artefatos Playwright/test-results do workflow oficial.

Mudanças de alto risco em autenticação, Firestore Rules, isolamento multi-tenant ou fluxos browser-critical não devem ser consideradas plenamente certificadas apenas pelo fallback portátil.

## Procedimento operacional

1. Desenvolver em branch própria e revisar o diff.
2. Para uma validação portátil quando Actions estiver indisponível, reproduzir o candidato sobre `qa-validation` ou usar uma branch explicitamente habilitada de validação.
3. Exigir status Vercel `success` com o build command `npm run ci:vercel` — um status `Canceled by Ignored Build Step` não conta como validação.
4. Registrar qualquer gate não executado como infraestrutura bloqueada.
5. Restaurar a certificação completa assim que o billing/spending do GitHub Actions for corrigido.

## Incidente de fixture detectado pelo fallback

Na primeira execução real do gate portátil em 2026-08-16, seis testes de `modern-scale-form-attention-routing.test.tsx` falharam porque a BandScale fixture usava `2026-08-15`. O componente corretamente filtra BandScales anteriores ao dia atual, logo o fixture deixou de ser elegível quando a data mudou para 2026-08-16. O teste foi tornado determinístico usando uma data futura estável, sem alterar o comportamento do produto e sem pular/quarentenar a cobertura.
