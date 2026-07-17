import fs from 'fs';
let content = fs.readFileSync('components/layout/Sidebar.tsx', 'utf-8');

// The file currently has:
/*
className={({ isActive }) =>
        `flex items-center py-[10px] px-3 mb-1 text-[14px] rounded-[12px] transition-all duration-200 relative touch-manipulation cursor-pointer group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#07080A] ${
          isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-start gap-3"
        } ${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.07] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-semibold"
            : "text-slate-300 hover:bg-white/[0.03] hover:text-slate-100 border border-transparent font-medium"
        }`
      }
    }
*/

content = content.replace(
  /className={\({ isActive }\) =>[\s\S]*?hover:text-slate-100 border border-transparent font-medium"\n\s*}\`\n\s*}\n\s*}/,
  `className={({ isActive }) =>
        \`flex items-center py-[10px] px-3 mb-1 text-[14px] rounded-[12px] transition-all duration-200 relative touch-manipulation cursor-pointer group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#07080A] \${
          isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-start gap-3"
        } \${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.07] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-semibold"
            : "text-slate-300 hover:bg-white/[0.03] hover:text-slate-100 border border-transparent font-medium"
        }\`
      }`
);

fs.writeFileSync('components/layout/Sidebar.tsx', content);
