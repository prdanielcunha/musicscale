# README - Configuração E2E
Esse repositório foi atualizado para rodar testes E2E com Playwright em CI (GitHub Actions).

Todos os testes exigem que o projeto Firebase seja estritamente `demo-musicscale`.
Os emuladores (Auth, Firestore) são populados dinamicamente via `globalSetup.ts` que respeita totalmente o schema da aplicação.
Não há dependência de recursos externos, garantindo estabilidade no GitHub Actions.
