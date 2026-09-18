# MusicScale Live

Implementação executável do **MusicScale Live**, derivada do Blueprint Mestre v0.1.

> Este diretório continua temporariamente em uma branch isolada do repositório MusicScale para permitir desenvolvimento imediato. A estrutura é repo-ready e deve migrar 1:1 para `prdanielcunha/musicscale-live` quando o repositório dedicado existir.

## Princípios congelados

- LAN-first, cloud-synced e offline-capable.
- Provider-agnostic: Holyrics, ProPresenter e Resolume são adapters, nunca o domínio.
- Control Plane separado do Media Plane.
- PWA Live/Studio + MusicScale Live Node.
- PT/EN/ES desde o início.
- Segurança fail-closed, tenant-scoped e comandos idempotentes.
- Mesmo Firebase/Auth/Firestore canônico do MusicScale/MillionsNest.

## Estrutura

- `apps/live`: PWA React/Vite com Studio, Live e modo Local Recovery.
- `packages/domain`: contratos neutros, capabilities, commands, ProviderLink e ServicePlan.
- `packages/live-node`: serviço local, pairing, cache offline, provider runtime e console local.
- `packages/adapters-holyrics`: primeiro adapter profundo, isolado do domínio.
- `docs`: arquitetura, threat model e gates.

## Rodar em desenvolvimento

```bash
npm run setup
npm run typecheck
npm test
npm run build
npm run dev:live
npm run dev:node
```

## Primeiro setup do Live Node

1. Inicie o Live Node no computador de produção.
2. Abra `http://127.0.0.1:4317/node` nesse computador.
3. Configure o Holyrics informando a URL local da API e o token criado no próprio Holyrics.
4. Use o QR exibido no console para abrir o MusicScale Live em um tablet/celular da mesma LAN.
5. Faça o pareamento com o PIN temporário exibido apenas no computador do Node.
6. No Studio conectado à nuvem, execute o preflight da próxima escala. Correspondências seguras de músicas são vinculadas automaticamente; ambiguidades exigem escolha humana.
7. Quando o preflight fica 100% resolvido, o ServicePlan + ProviderLinks são armazenados no Node. O modo Local Recovery passa a operar o culto mesmo sem Firebase/internet.

Credenciais de providers nunca são enviadas ao browser ou à nuvem. A configuração local do Holyrics fica no diretório privado de estado do Live Node; migração para credential vault nativo do sistema operacional permanece uma etapa de hardening antes do release estável.

## Compatibilidade com MusicScale

O bridge usa os dados canônicos atuais de usuários, organizações, escalas e músicas do projeto `millionsnest`. Ele também respeita `songSettings` de cada escala (tom/BPM selecionados), mantendo IDs de música estáveis — inclusive após o fluxo atual de substituição segura do MusicScale.

Nenhuma coleção Live nova é escrita no Firestore ainda. O estado operacional novo é persistido localmente no Node até que as regras/contratos de RBAC das coleções Live sejam aprovados e testados.
