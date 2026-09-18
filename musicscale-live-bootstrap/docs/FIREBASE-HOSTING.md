# Firebase Hosting — MusicScale Live

MusicScale Live usa o mesmo projeto Firebase canônico do ecossistema:

- project: `millionsnest`
- Auth/Firestore: compartilhados com MusicScale
- Hosting: **site/target separado**

## Target reservado no código

O bundle está configurado para o target:

`musicscale-live`

O target ainda precisa ser associado a um Firebase Hosting site real antes do primeiro deploy. Esta associação não é feita automaticamente nesta branch para não criar/modificar infraestrutura de produção sem o site dedicado existir.

Exemplo de bootstrap quando o site estiver criado:

```bash
firebase target:apply hosting musicscale-live <FIREBASE_SITE_ID> --project millionsnest
firebase deploy --only hosting:musicscale-live --project millionsnest
```

## Regras

- Nunca apontar o target `musicscale-live` para o site atual do MusicScale.
- Live recebe deploy/bundle próprios.
- O deploy não altera Firestore Rules nem Functions.
- Escritas de entidades Live no Firestore continuam desabilitadas até o contrato RBAC + Rules + emulator tests estar fechado.
- O Live Node local não depende deste Hosting durante o culto; após o preflight, a operação pode continuar pela LAN.

## CI/CD futuro

No repositório dedicado `musicscale-live`, o deploy deve reutilizar o WIF já adotado no ecossistema MillionsNest, com:

- build e testes antes da autenticação cloud;
- deploy exclusivo de `hosting:musicscale-live`;
- smoke check do URL oficial;
- produção somente a partir da branch protegida definida para o produto.
