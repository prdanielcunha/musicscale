import React from "react";

interface TagProps {
  children: React.ReactNode;
  className?: string;
}

const Tag: React.FC<TagProps> = ({ children, className = "" }) => {
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap bg-white/50 dark:bg-white/[0.03] text-slate-700 dark:text-white/70 border border-slate-200/60 dark:border-white/[0.06] text-[10px] md:text-[11px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full shadow-sm backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  );
};

export default Tag;
