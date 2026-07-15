import { isChordToken, transposeChord, transposeChordLinePreserveSpacing } from "./utils/chordEngine.js";

console.log(isChordToken("G#m7(11)"));
console.log(transposeChord("G#m7(11)", 2));
console.log(transposeChordLinePreserveSpacing("[Intro] A2  B2  C#m7  G#m7(11)", 2));
console.log(transposeChordLinePreserveSpacing("F#m7(11)   E/G#        A2", 2));
console.log(transposeChordLinePreserveSpacing("( A2  B2  C#m7  G#m7(11) )", 2));
