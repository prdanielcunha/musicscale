# Cifras legíveis e solos opcionais — 2026-11-01

## Comportamento

- A transposição usa classes de altura (12 semitons) para fundamentais e baixos invertidos. Menores, sétimas, extensões e alterações permanecem semanticamente intactos.
- As saídas usam notas naturais e acidentes simples; não geram B#, E#, Cb, Fb ou acidentes duplos. Grafias antigas são interpretadas corretamente, inclusive na prévia sem mudança de tom. A transposição A → Db mantém a preferência por bemóis.
- Solos explícitos e tablaturas ficam recolhidos na leitura principal e são acessíveis por “Ver solo / tablatura”. Multipartes técnicas não entram no navegador de seções cantadas.
- Acompanhamento de introdução/instrumental e versos numerados com letra continuam visíveis. Helpers legados são recolhidos apenas com evidência de tablatura; o texto original permanece disponível dentro do controle.
- Tablaturas já extraídas em `song.tabs` são recolocadas na seção correspondente ou, sem correspondência, ao final da cifra. Casas/digitação são preservadas e isso é explicado ao abrir o bloco.
- Mudança somente em interpretação/apresentação. Não há migração, alteração em autenticação, autorização, cobrança, Firestore ou gravação automática de cifras.

## Validação

- `npm run lint`: passou.
- 16 arquivos de testes relacionados: 126 testes passaram. A matriz adicional cobre 3.312 combinações de notas e tons, verificando fundamentais e baixos.
- Build Vite + esbuild + contrato dos assets: passou. O CLI `tsx` não pode abrir seu socket IPC neste ambiente; os mesmos estágios do script foram executados por `node --import tsx`.
- A suíte geral local foi bloqueada pela revisão automática por possível contato com Firestore real sem escopo estabelecido. Não foi repetida. QA completo e smoke de publicação permanecem requisitos de release.
- Não foi realizada validação visual em iPhone físico nesta sessão.

## Referências consultadas

- Guia oficial de cifras/tablaturas do Cifra Club: https://suporte.cifraclub.com.br/pt-BR/support/solutions/articles/64000236814-conheca-o-padr%C3%A3o-para-envio-de-cifras-e-tablaturas
- A página da música no Cifra Club respondeu 429; não foi possível verificar diretamente seu controle atual de ocultação. A implementação usa um disclosure nativo acessível, independente da implementação de terceiros.
