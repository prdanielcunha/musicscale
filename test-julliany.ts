import { preProcessSongText } from "./utils/chordEngine.js";

const jullianyTest1 = `
Principal
Mais
34
12
34
6ª34
022100
F#m7(11)*
(forma do acorde no tom de E)
Tom: F#
Capotraste: 2ª Casa

[Intro] A2  B2  C#m7  G#m7(11)

           A2
Eu me deparei
                        B2
Com aquele mestre escrevendo
`;

const jullianyTest3 = `
Tom: F#
Capotraste: 2ª casa

[Refrão]
D#m7
B2
F#/C#
C#2
F#
`;

const res1 = preProcessSongText(jullianyTest1);
console.log("=== Julliany Test 1 (Should strip noise and transpose to F#) ===");
console.log(res1.chordsText);
console.log("Metadata:", res1.metadata);

const res3 = preProcessSongText(jullianyTest3);
console.log("=== Julliany Test 3 (Should NOT transpose already concert key segment) ===");
console.log(res3.chordsText);
console.log("Metadata:", res3.metadata);
