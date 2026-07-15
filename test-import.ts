import { preProcessSongText } from "./utils/chordEngine.js";

const text = `
[Intro] C  G  Am  F

[Primeira Parte]
C                       G
Eu me deparei
Am                       F
Com aquele mestre escrevendo
`;

console.log(preProcessSongText(text));
