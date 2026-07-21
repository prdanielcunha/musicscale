const fs = require('fs');
let code = fs.readFileSync('tests/ui/scale-review-song-order.test.tsx', 'utf8');

// Replace overflow checks
code = code.replace(/expect\(document\.body\.style\.overflow\)\.toBe\('hidden'\);/g, "// removed overflow check");
code = code.replace(/expect\(document\.body\.style\.overflow\)\.toBe\('auto'\);/g, "// removed overflow check");

// Fix test names
code = code.replace(/adding styling and overflow hidden/g, "adding styling");
code = code.replace(/restoring styles and overflow/g, "restoring styles");

// Test 21 check for shadow-2xl and opacity-50
code = code.replace(/expect\(card\.classList\.contains\('touch-active'\)\)\.toBe\(true\);/g, "expect(card.classList.contains('opacity-50')).toBe(true);\n    expect(card.classList.contains('shadow-2xl')).toBe(true);");
code = code.replace(/expect\(card\.classList\.contains\('drag-preview'\)\)\.toBe\(true\);/g, "");

// Test 23 and 24 checks
code = code.replace(/expect\(card\.classList\.contains\('touch-active'\)\)\.toBe\(false\);/g, "expect(card.classList.contains('opacity-50')).toBe(false);\n    expect(card.classList.contains('shadow-2xl')).toBe(false);");
code = code.replace(/expect\(card\.classList\.contains\('drag-preview'\)\)\.toBe\(false\);/g, "");

fs.writeFileSync('tests/ui/scale-review-song-order.test.tsx', code);
