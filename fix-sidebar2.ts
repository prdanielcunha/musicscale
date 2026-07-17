import fs from 'fs';
let content = fs.readFileSync('components/layout/Sidebar.tsx', 'utf-8');
content = content.replace(
  `overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700/30 hover:scrollbar-thumb-slate-600/50 scrollbar-track-transparent`,
  `overflow-y-auto custom-scrollbar`
);
fs.writeFileSync('components/layout/Sidebar.tsx', content);

let css = fs.readFileSync('index.css', 'utf-8');
css = css.replace(
  `::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);`,
  `::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.15);`
).replace(
  `::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);`,
  `::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.3);`
);
fs.writeFileSync('index.css', css);
