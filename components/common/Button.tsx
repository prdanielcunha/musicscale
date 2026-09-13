import React, { forwardRef } from "react";

type ButtonAsButton = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: "button";
  href?: never;
};

type ButtonAsAnchor = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  as: "a";
};

export type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "blue" | "white" | "ghost";
  size?: "sm" | "md" | "lg";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
} & (ButtonAsButton | ButtonAsAnchor);

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(({
  children,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  as = "button",
  ...props
}, ref) => {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-[14px] focus:outline-none disabled:opacity-45 disabled:cursor-not-allowed shrink-0 whitespace-nowrap min-h-[44px] premium-interactive font-semibold tracking-[-0.005em] border";

  const variantClasses = {
    primary:
      "bg-[#f4f5f8] text-[#0b0d12] border-white/80 shadow-[0_6px_20px_rgba(0,0,0,0.20)] hover:bg-white hover:shadow-[0_10px_28px_rgba(0,0,0,0.28)]",
    secondary:
      "bg-[#151922] text-slate-200 border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:bg-[#1b202a] hover:border-white/[0.13] hover:text-white",
    danger:
      "bg-red-500/[0.09] text-red-300 border-red-400/[0.16] hover:bg-red-500/[0.16] hover:border-red-400/[0.28]",
    blue:
      "bg-[#696ff5] text-white border-indigo-300/[0.18] shadow-[0_8px_24px_rgba(70,76,210,0.24)] hover:bg-[#777dfb] hover:shadow-[0_12px_30px_rgba(70,76,210,0.32)]",
    white:
      "bg-white text-slate-950 border-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:bg-slate-100",
    ghost:
      "bg-transparent text-slate-400 border-transparent hover:bg-white/[0.05] hover:text-white hover:border-white/[0.05]",
  };

  const sizeClasses = {
    sm: "px-4 py-2 text-[13px] h-[40px] sm:h-[38px]",
    md: "px-5 py-2.5 text-[14px] h-[46px] sm:h-[44px]",
    lg: "px-6 py-3 text-[15px] h-[52px]",
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const content = (
    <>
      {leftIcon && <span className="flex items-center justify-center shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex items-center justify-center shrink-0">{rightIcon}</span>}
    </>
  );

  if (as === "a") {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={combinedClasses}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={combinedClasses}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
});

Button.displayName = "Button";

export default Button;
