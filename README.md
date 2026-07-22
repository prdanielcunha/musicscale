# MusicScale

O **MusicScale** é o módulo de gestão de escalas musicais, repertórios e times, operando como um satélite integrado ao ecossistema **MillionsNest**. Todas as fontes de identidade, organizações, memberships e RBAC emanam da plataforma principal MillionsNest, enquanto o MusicScale provê as ferramentas específicas para o ministério de louvor.

## Repositório e Branches

* **Repositório:** `prdanielcunha/musicscale`
* **Branch `main`:** Ambiente de desenvolvimento e homologação. Todas as novas features devem ser implementadas e testadas aqui.
* **Branch `production`:** Ambiente aprovado e publicado. Esta branch não deve ser alterada diretamente, apenas atualizada via sincronização após aprovação.

## Pré-requisitos

* **Node.js** (versão 22.x ou compatível) instalado.

## Comandos Principais

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento local
npm run dev

# 3. Validar tipagem e regras estáticas
# (Atualmente configurado para executar typecheck via tsc --noEmit)
npm run lint

# 4. Construir para produção (Vite + esbuild)
npm run build
```

## Comandos de Teste

O projeto possui gates rigorosos para validar integridade e contratos.

```bash
# Executar a bateria de testes de validação para release
npm run test:release

# (O comando acima roda internamente: test:release:core, test:release:scale-review, test:starter-pack-ui, test:ui, lint, build)
```

## Variáveis de Ambiente e Segurança

* **NÃO VERSIONE SECRETS:** Chaves de API privadas (como `GEMINI_API_KEY` ou credenciais do Firebase Admin) nunca devem ser commitadas. Use variáveis de ambiente (via `.env` local).
* **Variáveis Públicas:** Variáveis prefixadas com `VITE_` serão expostas ao cliente no navegador. Certifique-se de usar este prefixo apenas para valores que podem ser públicos.

## Infraestrutura Externa (Firebase)

Os seguintes recursos possuem ciclo de deploy separado e não são construídos pelo frontend:
* **Firebase Security Rules** (`firestore.rules`)
* **Índices do Firestore** (`firestore.indexes.json`)
* **Firebase Functions** (código de backend)
