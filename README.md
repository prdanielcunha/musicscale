# MusicScale (music-scale-manager)

> [!IMPORTANT]
> **Publicly viewable source, proprietary software.** This repository is **not open source**. Public visibility does not grant permission to commercialize, redistribute, host, sublicense, white-label, or create a competing product from the MusicScale code. See [`LICENSE`](./LICENSE), [`SECURITY.md`](./SECURITY.md), and [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## 1. Visão Geral
O **MusicScale** é uma plataforma SaaS para gestão de ministérios de louvor, oferecendo gestão de repertório, escalas de banda e programação, visualizador para performance ao vivo (letras, cifras, auto-scroll e BPM), bem como um repositório central de músicas (Biblioteca Viva).

Atua como um aplicativo satélite integrado à **MillionsNest** (que gerencia autenticação, locatário/Organização, faturamento e papéis globais). O MusicScale gerencia a operação musical com restrições baseadas na assinatura fornecida pela plataforma principal.

## 2. Estado Atual
Produção e desenvolvimento contínuo.

## 3. Stack Principal
* **Frontend:** React 19, React Router v7, Vite v6, Tailwind CSS v4, Motion (Framer Motion).
* **Backend:** Node.js (Express integrado via Vite e standalone no build), Firebase Auth, Cloud Firestore, Firebase Admin.
* **Tipagem:** TypeScript.
* **PWA/Offline:** vite-plugin-pwa, idb, dexie, workbox-window.
* **Testes:** Vitest (unitários e servidor) e Playwright (E2E).
* **IA:** `@google/genai` (executado exclusivamente no server-side).

## 4. Estrutura Principal de Diretórios
* `/components/`: Componentes de UI (escala, songs, library, admin, layout).
* `/contexts/`: React Contexts (auth, tenants, offline).
* `/hooks/`: React Custom Hooks.
* `/pages/`: Componentes roteáveis das páginas.
* `/services/`: Integração com Firebase e outras camadas de infraestrutura web.
* `/docs/`: Manuais e protocolos detalhados de arquitetura e regras de IA.
* `/tests/`: Testes rigorosos e2e, unitários e QA do sistema.
* `server.ts`: Ponto de entrada do backend Express.

## 5. Pré-requisitos
* **Node.js** 22.x ou compatível.
* Ferramentas do **Firebase Emulator** para execução da suíte E2E (opcional mas recomendado).

## 6. Instalação e Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar servidor local de desenvolvimento
npm run dev

# Fazer o Build para Produção (Vite frontend + esbuild server)
npm run build
```

A instalação local acima é disponibilizada para desenvolvimento autorizado, avaliação, pesquisa de segurança e contribuição conforme os limites da licença. Ela não concede autorização para colocar cópias do MusicScale em produção ou oferecer o software a terceiros.

## 7. Testes e Qualidade
O projeto possui gates rigorosos de lançamento, divididos em scripts do `package.json`.

```bash
# Validação de Tipagem
npm run lint

# Testes de UI e Testes Unitários
npm run test:ui

# Testes E2E via Emulator (Playwright)
npm run test:e2e

# QA unificada (Lint + Build + UI + E2E)
npm run test:qa

# Suíte Final de Release
npm run test:release
```

## 8. Variáveis de Ambiente
Baseie-se no `.env.example`. NUNCA exponha credenciais, secrets ou tokens de produção nestes arquivos.

* **Client-Side (Públicas, prefixo `VITE_`):** `VITE_APP_URL`, variáveis de Emulador E2E (`VITE_E2E_MODE`, etc).
* **Server-Side (Secrets):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FIREBASE_SERVICE_ACCOUNT`, `GEMINI_MODEL`, `AI_FINOPS_HMAC_SECRET`, etc.

Segredos reais devem existir somente nos cofres/configurações apropriados (por exemplo GitHub Actions, Vercel, Firebase/Google Cloud) e nunca em commits, issues, PRs, logs públicos ou artifacts.

## 9. Arquitetura Resumida
A arquitetura é offline-first baseada no banco **Cloud Firestore**. Todas as operações persistem nativamente. A aplicação Node atua como ponte para integrações de segurança e uso de tokens/chaves privadas (IA e Stripe), protegendo os segredos do client-side. A leitura mais profunda da arquitetura encontra-se em `docs/ARCHITECTURE_CURRENT.md`.

## 10. Integrações
* **MillionsNest:** Plataforma central de Tenant e Autenticação.
* **Stripe:** Gestão de assinaturas / Webhooks no backend.
* **Firebase:** Auth, Firestore e Functions (para indexação de banco e segurança via `firestore.rules`).
* **OpenAI Codex / Gemini:** Motores de inteligência artificial.

## 11. Banco de Dados e Segurança (Firestore)
A base de dados é isolada usando o conceito de `organizationId`. Nenhuma organização pode acessar documentos alheios. Estas diretrizes são policiadas através das `firestore.rules`, sendo de longe a fronteira de segurança mais crítica.

## 12. Autenticação e Autorização
O `Firebase Auth` (com validações da MillionsNest) assegura o fluxo de usuários, delegando acesso baseado no `organizationRole`. O Frontend nunca é tratado como fonte de verdade para permissões.

## 13. Deploy
A execução do comando `npm run build` cria um bundle otimizado. No ambiente produtivo, o ponto de partida é o arquivo `dist/server.cjs`, gerado pelo Esbuild.

Publicar um PR ou ter acesso ao código não autoriza nenhum deploy. Alterações em produção, dados, regras, índices, Functions ou credenciais exigem autorização operacional separada.

## 14. Segurança, licença e contribuições

* Vulnerabilidades: [`SECURITY.md`](./SECURITY.md)
* Licença proprietária/source-available: [`LICENSE`](./LICENSE)
* Regras para contribuições: [`CONTRIBUTING.md`](./CONTRIBUTING.md)

O uso de **MusicScale**, **MillionsNest**, logotipos e demais elementos de marca não é concedido pela disponibilização pública deste código.

## 15. Documentação Adicional
Consulte os documentos em `/docs` para manuais técnicos focados:
* `docs/ARCHITECTURE_CURRENT.md`
* `docs/AI_CHANGE_PROTOCOL.md`
* `docs/GLOBAL_LIBRARY_CURATION_DATA_MODEL.md`
* E o arquivo `AGENTS.md` (mandatório para IA).
