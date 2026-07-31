import fs from 'fs';
let content = fs.readFileSync('components/layout/BottomNav.tsx', 'utf8');

content = content.replace(
  '  return (\n    <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[100] flex justify-center pointer-events-none">\n      <div className="pointer-events-auto flex justify-between items-center relative w-full max-w-[400px] p-[5px] bg-[#111115]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.10] rounded-[2.25rem] shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.06)]">\n        <GlobalCreateAction variant="mobile" />',
  '  return (\n    <div className="md:hidden fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-[100] flex flex-col items-center pointer-events-none gap-4">\n      <GlobalCreateAction variant="mobile" />\n      <div className="pointer-events-auto flex justify-between items-center relative w-full max-w-[400px] p-[5px] bg-[#111115]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.10] rounded-[2.25rem] shadow-[0_24px_70px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.06)]">'
);

fs.writeFileSync('components/layout/BottomNav.tsx', content);
