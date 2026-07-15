console.log("1: " + /\bG#\b/.test("G#m7"));
console.log("2: " + /\bG#\b/.test(" G# "));
console.log("3: " + /(?:^|\s)G#(?:\s|$)/.test(" G# "));
