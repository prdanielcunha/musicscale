import { preProcessSongText } from "./utils/chordEngine.js";

const jullianyTestFull = `
Principal
Mais
34
12
34
6ª34
022100
F#m7(11)*
G#m7(11)*
(forma do acorde no tom de E)
Tom: F#
Capotraste: 2ª Casa

[Intro] A2  B2  C#m7  G#m7(11)

[Primeira Parte]

           A2
Eu me deparei
                        B2
Com aquele mestre escrevendo
                G#m7(11)
Com o dedo no chão
                            C#m7
Ouvindo os fariseus a lhes falar

                 A2
Que a Lei de Moisés
                      B2
Me condenava por meus erros
             G#m7(11)
Mas nenhuma pedra
                   C#m7
Ele pegou pra me apedrejar

[Pré-Refrão]

A2
Eu só tinha os meus pecados
  B2
Pra lhe oferecer
             G#m7(11)
Mas mesmo assim me amou
             C#m7
Mas mesmo assim me amou

 A2
Com uma frase: atire a pedra
  B2
Quem nunca pecou
        G#m7(11)
Ele me perdoou
        C#m7
Ele me perdoou

 F#m7(11)   E/G#       A2
Sua irresistível graça me alcançou

[Refrão]
       F#
Quem é esse?
                             D#m7
Que era sem pecado e não me condenou
                             B2
No lugar da morte, vida me ofertou
                              F#/C#
O Cordeiro que por mim se entregou
             C#2
E os meus pecados levou
`;

const resF = preProcessSongText(jullianyTestFull);
console.log("=== Julliany Test Full ===");
console.log(resF.chordsText);
console.log("Metadata:", resF.metadata);
