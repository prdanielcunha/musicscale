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
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-[14px] whitespace-nowrap font-semibold outline-none transition-[transform,background-color,border-color,color,box-shadow,filter] duration-200 focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.975] motion-reduce:transition-none motion-reduce:active:scale-100";

  const variantClasses = {
    primary:
      "border border-white/[0.12] bg-[linear-gradient(135deg,#4f8cff,#6f67f8)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_30px_-16px_rgba(79,140,255,0.8)] hover:brightness-105",
    secondary:
      "border border-white/[0.075] bg-white/[0.045] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-white",
    danger:
      "border border-red-400/[0.16] bg-red-500/[0.09] text-red-300 hover:border-red-400/[0.28] hover:bg-red-500/[0.16] hover:text-red-200",
    blue:
      "border border-blue-300/[0.16] bg-[linear-gradient(135deg,#3f82f7,#5877ed)] text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.9)] hover:brightness-105",
    white:
      "border border-white/[0.18] bg-white text-[#101014] shadow-[0_10px_26px_-18px_rgba(255,255,255,0.5)] hover:bg-[#f5f5f7]",
    ghost:
      "border border-transparent bg-transparent text-white/55 hover:border-white/[0.055] hover:bg-white/[0.04] hover:text-white/90",
  };

  const sizeClasses = {
    sm: "min-h-[38px] px-4 py-2 text-[12px]",
    md: "min-h-[44px] px-5 py-2.5 text-[13px]",
    lg: "min-h-[50px] px-6 py-3 text-[14px]",
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  const content = (
    <>
      {leftIcon && <span className="flex shrink-0 items-center justify-center">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex shrink-0 items-center justify-center">{rightIcon}</span>}
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
