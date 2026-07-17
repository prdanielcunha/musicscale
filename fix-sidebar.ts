import fs from 'fs';

let content = fs.readFileSync('components/layout/Sidebar.tsx', 'utf-8');

// 1. Surface and Container
content = content.replace(
  'bg-white/5 dark:bg-[#111115]/95 backdrop-blur-3xl border-r border-slate-200/50 dark:border-white/[0.08] shadow-[4px_0_24px_rgba(0,0,0,0.15)] pt-2 md:pt-4 relative overflow-hidden rounded-r-3xl md:rounded-none',
  'bg-[#07080A]/95 backdrop-blur-[28px] border border-white/[0.08] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.03)] pt-3 md:pt-4 relative overflow-hidden rounded-[24px] ring-1 ring-inset ring-white/[0.02]'
);

content = content.replace(
  '${isCollapsed ? "w-20" : "w-64"}',
  '${isCollapsed ? "w-20" : "w-[min(88vw,304px)] md:w-[256px]"}'
);

// 2. Header
const oldHeader = `<div
        className={\`flex items-center px-4 mb-4 relative z-10 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] \${
          isCollapsed ? "justify-center" : "justify-between"
        }\`}
      >
        <button
          onClick={navigateToEcosystem}
          className="group flex items-center justify-center p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.05] hover:border-white/[0.1] transition-all duration-300 shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] focus:outline-none"
          title={t("nav.back_to_ecosystem", "Voltar para MillionsNest")}
        >
          <MoveLeft className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
        </button>
      </div>`;

const newHeader = `<div className={\`flex flex-col px-4 mb-6 relative z-10 transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] \${isCollapsed ? "items-center" : "items-stretch"}\`}>
        <button
          onClick={navigateToEcosystem}
          className={\`group flex items-center justify-center h-10 rounded-full bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.05] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.985] \${isCollapsed ? "w-10 px-0" : "w-full px-4 mb-6"}\`}
          title={t("nav.back_to_ecosystem", "Voltar")}
        >
          <MoveLeft className={\`w-4 h-4 text-slate-300 group-hover:text-white transition-colors \${!isCollapsed && "mr-2"}\`} />
          {!isCollapsed && <span className="text-[13px] font-medium text-slate-300 group-hover:text-white transition-colors">{t("nav.back_to_ecosystem", "Voltar")}</span>}
        </button>

        {!isCollapsed && (
          <div className="flex flex-col items-center text-center px-2">
             <div className="w-[42px] h-[42px] rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-3 shadow-[0_8px_16px_-6px_rgba(99,102,241,0.4)] border border-white/[0.12]">
                <MusicNoteIcon className="w-5 h-5 text-white" />
             </div>
             <h2 className="text-[15px] font-bold text-white tracking-tight leading-tight">MusicScale</h2>
             {organization && (
               <p className="text-[12px] font-medium text-indigo-300 truncate w-full max-w-full mt-1">
                 {effectiveOrganizationName || organization.name}
               </p>
             )}
          </div>
        )}
      </div>`;
content = content.replace(oldHeader, newHeader);

// 3. NavItem
const oldNavItemClass = `className={({ isActive }) =>
        \`flex items-center py-2 px-3 mb-1 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative overflow-hidden touch-manipulation cursor-pointer \${
          isCollapsed ? "justify-center w-10 h-10 mx-auto" : ""
        } \${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.06] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.2)] border border-white/[0.04] font-semibold"
            : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200 border border-transparent"
        }\`
      }`;

const newNavItemClass = `className={({ isActive }) =>
        \`flex items-center py-[10px] px-3 mb-1 text-[14px] rounded-[12px] transition-all duration-200 relative touch-manipulation cursor-pointer group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#07080A] \${
          isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-start gap-3"
        } \${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.07] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-semibold"
            : "text-slate-300 hover:bg-white/[0.03] hover:text-slate-100 border border-transparent font-medium"
        }\`
      }
      aria-current={location.pathname === link.to ? "page" : undefined}`;
      
content = content.replace(oldNavItemClass, newNavItemClass);

// We need to pass `location` to NavItem or use `window.location`. Actually NavLink handles `aria-current="page"` automatically.
content = content.replace(`aria-current={location.pathname === link.to ? "page" : undefined}`, '');

content = content.replace(
  `{isReallyActive && !isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary dark:bg-white/30 rounded-r-full pointer-events-none"></div>}`,
  `{isReallyActive && !isCollapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[20px] bg-gradient-to-b from-indigo-400 to-violet-500 rounded-r-full pointer-events-none"></div>}`
);
content = content.replace(
  `<span
          className={\`flex-shrink-0 transition-transform duration-300 pointer-events-none \${isReallyActive ? "text-primary dark:text-white drop-shadow-sm" : ""}\`}
        >`,
  `<span
          className={\`flex-shrink-0 transition-transform duration-200 pointer-events-none \${isReallyActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}\`}
        >`
);
content = content.replace(
  `<span className="ml-3 whitespace-nowrap pointer-events-none flex-1 truncate">{link.text}</span>`,
  `<span className="whitespace-nowrap pointer-events-none flex-1 truncate">{link.text}</span>`
);

// 4. SubNavItem
const oldSubNavClass = `className={({ isActive }) =>
        \`flex items-center py-2 px-3 pl-10 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative my-0.5 overflow-hidden touch-manipulation cursor-pointer \${
          isActive && !link.to.startsWith("action:")
            ? "text-white bg-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.1)] border border-white/[0.04] font-semibold"
            : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200 border border-transparent"
        }\`
      }`;
const newSubNavClass = `className={({ isActive }) =>
        \`flex items-center py-2 px-3 pl-[42px] mb-0.5 text-[13.5px] rounded-[10px] transition-all duration-200 relative touch-manipulation cursor-pointer group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary \${
          isActive && !link.to.startsWith("action:")
            ? "bg-white/[0.07] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] font-semibold"
            : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent font-medium"
        }\`
      }`;
content = content.replace(oldSubNavClass, newSubNavClass);

content = content.replace(
  `{isReallyActive && <div className="absolute left-8 top-1/2 -translate-y-1/2 w-1 h-1 bg-primary dark:bg-white/40 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.5)]"></div>}`,
  `{isReallyActive && <div className="absolute left-[24px] top-1/2 -translate-y-1/2 w-[3px] h-[3px] bg-indigo-400 rounded-full"></div>}`
);
content = content.replace(
  `<div className="flex items-center flex-1 min-w-0">
               <span
                 className={\`w-4 h-4 flex-shrink-0 mr-2 transition-transform duration-300 pointer-events-none \${isReallyActive ? "text-primary dark:text-white drop-shadow-sm" : "opacity-70"}\`}
               >
                 {link.icon}
               </span>
               <span className="whitespace-nowrap pointer-events-none truncate mr-2">{link.text}</span>
            </div>`,
  `<div className="flex items-center gap-3 flex-1 min-w-0">
               <span
                 className={\`flex-shrink-0 transition-transform duration-200 pointer-events-none \${isReallyActive ? "text-white" : "text-slate-500 group-hover:text-slate-300"}\`}
               >
                 {React.cloneElement(link.icon as React.ReactElement, { className: "w-4 h-4" })}
               </span>
               <span className="whitespace-nowrap pointer-events-none truncate">{link.text}</span>
            </div>`
);

// 5. CollapsibleNavItem
const oldCollapClass = `className={\`w-full flex items-center py-2 px-3 text-[13px] font-medium rounded-[10px] transition-all duration-300 relative touch-manipulation group \${
          isCollapsed ? "justify-center w-10 h-10 mx-auto" : "justify-between"
        } \${
          isParentActive
            ? "bg-white/[0.04] text-white"
            : "text-slate-400 md:hover:bg-white/[0.04] md:hover:text-slate-200"
        }\`}`;
const newCollapClass = `className={\`w-full flex items-center py-[10px] px-3 text-[14px] rounded-[12px] transition-all duration-200 relative touch-manipulation group outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-[#07080A] \${
          isCollapsed ? "justify-center w-11 h-11 mx-auto" : "justify-start gap-3"
        } \${
          isParentActive
            ? "text-slate-100 font-semibold"
            : "text-slate-300 hover:bg-white/[0.03] hover:text-slate-100 font-medium border border-transparent"
        }\`}`;
content = content.replace(oldCollapClass, newCollapClass);

content = content.replace(
  `<div className="flex items-center pointer-events-none">
          <span
            className={\`flex-shrink-0 transition-transform duration-300 \${
              isParentActive ? "text-primary dark:text-white" : ""
            }\`}
          >
            {React.cloneElement(link.icon as React.ReactElement, {
              className: "w-[18px] h-[18px]",
            })}
          </span>
          {!isCollapsed && <span className="ml-3 truncate">{link.text}</span>}
        </div>
        {!isCollapsed && (
          <ChevronRightIcon
            className={\`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-300 pointer-events-none \${
              isOpen ? "rotate-90" : ""
            }\`}
          />
        )}`,
  `<div className="flex items-center gap-3 pointer-events-none flex-1 min-w-0">
          <span
            className={\`flex-shrink-0 transition-transform duration-200 \${
              isParentActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
            }\`}
          >
            {React.cloneElement(link.icon as React.ReactElement, {
              className: "w-[18px] h-[18px]",
            })}
          </span>
          {!isCollapsed && <span className="truncate flex-1 text-left">{link.text}</span>}
        </div>
        {!isCollapsed && (
          <ChevronRightIcon
            className={\`w-4 h-4 flex-shrink-0 transition-transform duration-200 pointer-events-none text-slate-500 \${
              isOpen ? "rotate-90 text-slate-300" : ""
            }\`}
          />
        )}`
);

content = content.replace(
  `fixed z-[1000] min-w-[200px] bg-[#111115]/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-2xl overflow-y-auto`,
  `fixed z-[1000] min-w-[200px] bg-[#07080A]/95 backdrop-blur-[28px] border border-white/[0.08] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] rounded-[16px] overflow-hidden`
);
content = content.replace(
  `bg-[#111115]/95 backdrop-blur-md z-10`,
  `bg-[#07080A]/95 backdrop-blur-md z-10`
);

// 6. Section Titles
content = content.replace(
  `<h3 className="px-3 mb-2 text-[10px] font-bold tracking-[0.2em] text-slate-500 uppercase">`,
  `<h3 className="px-3 mt-6 mb-2 text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">`
);

// 7. Footer
content = content.replace(
  `className={\`mt-auto bg-transparent flex-shrink-0 pb-4 \${isCollapsed ? "p-2" : "px-4"}\`}`,
  `className={\`mt-auto bg-transparent flex-shrink-0 pb-6 pt-4 \${isCollapsed ? "px-2" : "px-4"}\`}`
);

// User Profile NavLink
const oldProfileClass = `className={\`flex items-center gap-3 p-2.5 rounded-[12px] transition-all duration-300 group \${isCollapsed ? "justify-center w-10 h-10 mx-auto" : "hover:bg-white/[0.04]"}\`}`;
const newProfileClass = `className={\`flex items-center gap-3 p-2.5 rounded-[12px] transition-all duration-200 group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-primary \${isCollapsed ? "justify-center w-11 h-11 mx-auto" : "hover:bg-white/[0.03]"}\`}`;
content = content.replace(oldProfileClass, newProfileClass);

content = content.replace(
  `w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 p-[1px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] overflow-hidden transition-transform group-hover:scale-105 duration-300`,
  `w-9 h-9 rounded-full bg-gradient-to-br from-white/10 to-white/5 p-[1px] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] overflow-hidden transition-transform group-hover:scale-105 duration-200`
);
content = content.replace(
  `font-semibold text-sm text-slate-900 dark:text-white truncate tracking-tight`,
  `font-semibold text-[13px] text-white truncate tracking-tight`
);

content = content.replace(
  `text-[#FFD700] drop-shadow-[0_0_2px_rgba(255,215,0,0.5)]`,
  `text-amber-400/90`
);
content = content.replace(
  `text-[#A855F7] dark:text-[#C084FC]`,
  `text-purple-400`
);

// Logout button
const oldLogoutClass = `className={\`flex items-center gap-3 p-2.5 rounded-[12px] text-[13px] font-semibold text-red-500/90 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 group active:scale-[0.98] \${isCollapsed ? "justify-center w-10 h-10 mx-auto" : "w-full"}\`}`;
const newLogoutClass = `className={\`flex items-center gap-3 p-2.5 rounded-[12px] text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-200 group active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-red-500 \${isCollapsed ? "justify-center w-11 h-11 mx-auto" : "w-full"}\`}`;
content = content.replace(oldLogoutClass, newLogoutClass);

content = content.replace(
  `<LogoutIcon className="w-4 h-4 ml-0.5" />`,
  `<LogoutIcon className="w-4 h-4 ml-0.5 text-red-400 group-hover:text-red-300 transition-colors" />`
);
content = content.replace(
  `whitespace-nowrap \${isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"}`,
  `whitespace-nowrap text-left \${isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"}`
);

// 8. Custom Scrollbar adjustment
// In index.css it probably defines .custom-scrollbar.
// But we don't need to change index.css unless requested. Wait, the prompt says "Não ocultar totalmente o indicador em desktop. No mobile, permitir scrollbar nativa discreta ou ocultação apenas visual, mantendo scroll funcional."
// Let's modify index.css if needed, or add a class in Sidebar.
content = content.replace(
  `overflow-y-auto custom-scrollbar`,
  `overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700/30 hover:scrollbar-thumb-slate-600/50 scrollbar-track-transparent`
);

// Write back
fs.writeFileSync('components/layout/Sidebar.tsx', content);
