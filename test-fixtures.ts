import { preProcessSongText } from "./utils/chordEngine.js";

const fixtures = {
"Fixture 1": `Cifra Principal
Tom: F#
Forma dos acordes no tom de E
Capotraste na 2ª casa

X02200
244322

[Intro] A2 B2 C#m7 G#m7(11)
A2
Letra`,

"Fixture 2": `G
Grandes coisas fez o Senhor por nós
Em
Por isso estamos alegres
C
Grandes coisas fez o Senhor por nós
D
Por isso estamos alegres`,

"Fixture 3": `Key: G
Capo: 2nd fret
[Verse]
C
Amazing grace
G
How sweet the sound`,

"Fixture 4": `Tono: D
Cejilla: 2
[Verso]
C
Sublime gracia
G
Del Señor`,

"Fixture 5": `{title: Amazing Grace}
{artist: John Newton}
{key: G}
[G]Amazing [C]grace, how [G]sweet the sound`,

"Fixture 6": `Eu nasci de novo
Eu nasci de novo
E não vou morrer`,

"Fixture 7": `[Intro]
E|----------------|
B|------0---------|
G|------4---------|
D|--2h4-----------|
A|----------------|
E|----------------|`,

"Fixture 8": `Spotify
Apple Music
Remove ads
Remover anúncios
Quitar anuncios
[Verso]
A
Deus
B
Deus`,

"Fixture 9": `Shape: 7x777x
xx7655
355433
[Intro] A B C`,

"Fixture 10": `Caminho aberto
Amor sem fim
Fé em Deus
Em mim`
};

for (const [name, text] of Object.entries(fixtures)) {
   console.log("=== " + name + " ===");
   const res = preProcessSongText(text);
   console.log(res);
}
