import { preProcessSongText } from "./utils/chordEngine.js";

const text = `Quem É Esse?
Julliany Souza
Cifra: Principal (violão e guitarra)
Tom: F# (forma dos acordes no tom de E)

[Intro] A2 B2 C#m7 G#m7(11)

[Primeira Parte]
A2
Eu me deparei
B2
Com aquele mestre escrevendo
`;

console.log(preProcessSongText(text));
