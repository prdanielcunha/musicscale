import { 
    cleanChordsText, 
    removeChordOnlyLinesFromLyrics,
    removeOrphanInstrumentalLabelsFromLyrics,
    removeEmptyOrInstrumentalSectionsFromLyrics,
    validateLyricsHasOnlySingableSections
} from "./utils/chordEngine.ts";

function runTest(name: string, input: any, expected: any, pipeline: Function) {
    let output = '';
    try {
        output = pipeline(input);
        if (output === expected) {
            console.log(`✅ [PASS] ${name}`);
        } else {
            console.log(`❌ [FAIL] ${name}`);
            console.log('--- EXPECTED ---');
            console.log(expected);
            console.log('--- GOT ---');
            console.log(output);
        }
    } catch(e: any) {
        if (expected === 'ERROR') {
             console.log(`✅ [PASS] ${name} (Exception successfully caught: ${e.message})`);
        } else {
             console.log(`❌ [FAIL] ${name} threw exception: ${e.message}`);
        }
    }
}

const lyricsPipeline = (lyrics: string) => {
    let l = removeChordOnlyLinesFromLyrics(lyrics);
    l = removeOrphanInstrumentalLabelsFromLyrics(l);
    l = removeEmptyOrInstrumentalSectionsFromLyrics(l);
    validateLyricsHasOnlySingableSections(l);
    return l;
};

runTest(
    "Test 1 - Remover partes técnicas órfãs",
    `Pois Tua graça
Joga a minha carne ao chão

Parte 1 de 3
Parte 2 de 3
Parte 3 de 3

[Pré-Refrão]
Não adianta fingir`,
    `Pois Tua graça
Joga a minha carne ao chão

[Pré-Refrão]

Não adianta fingir`,
    lyricsPipeline
);

runTest(
    "Test 2 - Preservar Refrão 1",
    `[Refrão 1]

Ah, Jesus
Quebra o meu orgulho`,
    `[Refrão 1]

Ah, Jesus
Quebra o meu orgulho`,
    lyricsPipeline
);

runTest(
    "Test 3 - Preservar Refrão Final",
    `[Refrão Final]

Santo, Santo
Tu és digno`,
    `[Refrão Final]

Santo, Santo
Tu és digno`,
    lyricsPipeline
);

runTest(
    "Test 4 - Remover Intro instrumental vazia",
    `[Intro]

[Primeira Parte]
Quem foi muito perdoado`,
    `[Primeira Parte]

Quem foi muito perdoado`,
    lyricsPipeline
);

runTest(
    "Test 5 - Remover Solo vazio",
    `[Solo]

[Refrão]
Ah, Jesus`,
    `[Refrão]

Ah, Jesus`,
    lyricsPipeline
);

runTest(
    "Test 6 - Não remover Primeira Parte com letra",
    `[Primeira Parte]

Quem foi muito perdoado`,
    `[Primeira Parte]

Quem foi muito perdoado`,
    lyricsPipeline
);

runTest(
    "Test 7 - Remover Part 1 of 3 em inglês",
    `Part 1 of 3
Part 2 of 3

[Chorus]
Amazing grace`,
    `[Chorus]

Amazing grace`,
    lyricsPipeline
);

runTest(
    "Test 8 - Remover Parte 1 de 3 em espanhol/português",
    `Parte 1 de 3
Parte 2 de 3

[Coro]
Sublime gracia`,
    `[Coro]

Sublime gracia`,
    lyricsPipeline
);

// End-to-End Real Test Request
console.log("------------------------");
console.log("== End-To-End Exemplo Real ==");

import { preProcessSongText } from "./utils/chordEngine.ts";

let inputChords = `A7(9)
Am7
Bm
Bm7
C
C7M
C9
Cm/Eb
D
Em7
G
G/B
G9
[Intro] C7M  G/B  Am7  A7(2)  Am7

[Primeira Parte]

  G
Quem foi muito perdoado
Deveria saber o valor de ser amado

Mas por outro lado

O bem que eu quero fazer
De fato eu não faço
E, dependendo do pecado
Eu nem me sinto incomodado
Então esbarro na Tua palavra

E sou confrontado

[Pré-Refrão]

Não adianta fingir que está tudo bem
Se de Ti eu recebi perdão

Mas não consigo perdoar ninguém

[Refrão 1]

C7M
Ah, Jesus

Quebra o meu orgulho
E faz-me olhar pra cruz
Tira a dureza do meu coração

C7M
De joelhos, eu imploro o Teu perdão`;

const preProcessed = preProcessSongText(inputChords);

const c = cleanChordsText(preProcessed.chordsText);
const l = lyricsPipeline(preProcessed.lyricsText);

console.log("--- FINAL CHORDS TEXT ---");
console.log(c);
console.log("--- FINAL LYRICS TEXT ---");
console.log(l);
console.log("--- VALIDATIONS OK ---");

