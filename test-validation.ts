import { preProcessSongText } from "./utils/chordEngine.js";

const txt = `
[Intro] A2  B2  C#m7  G#m7(11)
`;

const res = preProcessSongText(txt);
console.log(res.chordsText);

// Simulate the checks
if (/\bA2\b/.test(res.chordsText)) console.error("FAILED A2 check");
