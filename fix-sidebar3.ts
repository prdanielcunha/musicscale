import fs from 'fs';
let content = fs.readFileSync('components/layout/Sidebar.tsx', 'utf-8');

// NavItem replacement
content = content.replace(
  /className={\({ isActive }\) =>\s*`flex items-center py-2 px-3 mb-1 text-\[13px\] font-medium rounded-\[10px\] transition-all duration-300 relative overflow-hidden touch-manipulation cursor-pointer \${\s*isCollapsed \? "justify-center w-10 h-10 mx-auto" : ""\s*} \${\s*isActive && !link\.to\.startsWith\("action:"\)\s*\? "bg-white\/\[0\.06\] text-white shadow-\[inset_0_1px_1px_rgba\(255,255,255,0\.05\),0_1px_2px_rgba\(0,0,0,0\.2\)\] border border-white\/\[0\.04\] font-semibold"\s*: "text-slate-400 md:hover:bg-white\/\[0\.04\] md:hover:text-slate-200 border border-transparent"\s*}\`/g,
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
