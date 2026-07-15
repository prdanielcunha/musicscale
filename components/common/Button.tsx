import React from "react";

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

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  className = "",
  as = "button",
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center gap-2.5 rounded-[16px] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide shrink-0 whitespace-nowrap outline-none min-h-[44px] premium-interactive transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0";

  const variantClasses = {
    primary:
      "border border-white/10 dark:border-white/5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold tracking-wide shadow-md hover:shadow-xl dark:hover:shadow-white/20 hover:bg-slate-800 dark:hover:bg-slate-50",
    secondary:
      "border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.03] text-slate-700 dark:text-white font-bold tracking-wide shadow-sm hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:shadow-md",
    danger:
      "border border-red-200/50 dark:border-red-500/10 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-500 hover:text-white font-bold tracking-wide shadow-sm hover:shadow-md hover:shadow-red-500/20 active:bg-red-600",
    blue:
      "border border-blue-500/20 bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700 font-bold tracking-wide shadow-md hover:shadow-lg hover:shadow-blue-500/20",
    white:
      "bg-white text-slate-900 hover:text-primary hover:bg-slate-50 font-bold tracking-wide shadow-md border border-slate-200 dark:border-transparent",
    ghost:
      "bg-transparent text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white font-bold tracking-wide border border-transparent",
  };

  const sizeClasses = {
    sm: "px-5 py-2 text-[13px] h-[38px] sm:h-[36px]",
    md: "px-6 py-2.5 text-[14px] h-[46px] sm:h-[44px]",
    lg: "px-8 py-3 text-[15px] h-[52px]",
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  if (as === "a") {
    return (
      <a
        className={combinedClasses}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {leftIcon && (
          <span className="mr-3 flex items-center justify-center shrink-0">
            {leftIcon}
          </span>
        )}
        {children}
        {rightIcon && (
          <span className="ml-3 flex items-center justify-center shrink-0">
            {rightIcon}
          </span>
        )}
      </a>
    );
  }

  return (
    <button
      className={combinedClasses}
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {leftIcon && (
        <span className="mr-3 flex items-center justify-center shrink-0">
          {leftIcon}
        </span>
      )}
      {children}
      {rightIcon && (
        <span className="ml-3 flex items-center justify-center shrink-0">
          {rightIcon}
        </span>
      )}
    </button>
  );
};

export default Button;
