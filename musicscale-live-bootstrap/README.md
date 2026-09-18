# MusicScale Live

Bootstrap executável do novo **MusicScale Live**, criado a partir do Blueprint Mestre v0.1.

> Este diretório está temporariamente hospedado em uma branch isolada do repositório MusicScale apenas para permitir implementação imediata. Ele foi estruturado como um repositório independente e deve ser movido sem alterações conceituais para `prdanielcunha/musicscale-live` assim que o repositório dedicado existir.

## Princípios congelados

- LAN-first, cloud-synced e offline-capable.
- Provider-agnostic: Holyrics, ProPresenter e Resolume são adapters, nunca o domínio.
- Control Plane separado do Media Plane.
- PWA Live/Studio + MusicScale Live Node.
- PT/EN/ES desde o primeiro commit.
- Segurança fail-closed e comandos idempotentes.
- Mesmo Firebase/Auth/Firestore do ecossistema MillionsNest/MusicScale.

## Estrutura

- `apps/live`: PWA React/Vite para Live + Studio.
- `packages/domain`: contratos neutros, capabilities, commands e Event Bus.
- `packages/live-node`: serviço local Node.js, preparado para adapters e transporte LAN.
- `docs`: decisões, threat model e gates.

## Rodar

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev:live
npm run dev:node
```

O PWA lê os mesmos usuários, organizações, escalas e músicas do projeto Firebase `millionsnest`. Nesta fundação, os dados Live novos ainda não são persistidos; o primeiro passo é validar os contratos antes de adicionar coleções e regras definitivas.
