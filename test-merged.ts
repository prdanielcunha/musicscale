import { preProcessSongText } from "./utils/chordEngine.js";

const txt = `Quem É Esse?
Julliany Souza
Tom: F#
Capotraste na 2ª casa

[Pré-Refrão]

A2
Eu só tinha os meus pecados
  B2
Pra lhe oferecer
             G#m7(11)
Mas mesmo assim me amou
             C#m7
Mas mesmo assim me amou

 F#m7(11)   E/G#       A2
Sua irresistível graça me alcançou


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

const res = preProcessSongText(txt);
console.log(res.chordsText);
