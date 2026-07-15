import { stripTablatureArtifacts } from "./utils/chordEngine.ts";

const input1 = `[Refrão]
A         E/G#
Santo, santo

[Tab - Solo]
Parte 1 de 2
A         E/G#
E|-------------------|
B|----5---5----------|
G|-------------------|

[Ponte]
F#m       D
Eu me rendo`;

console.log(stripTablatureArtifacts(input1));
