import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: "none" | "normal" | "large";
  interactive?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = "",
  onClick,
  padding = "normal",
  interactive,
  ...rest
}) => {
  const cardClasses = `
    bg-white dark:bg-white/[0.02] dark:backdrop-blur-3xl border border-black/[0.04] dark:border-white/5
    rounded-[24px]
    shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.05)]
    transition-all duration-300
    ${padding === "normal" ? "p-6 md:p-8" : padding === "large" ? "p-8 md:p-12" : ""}
    ${onClick ? "cursor-pointer touch-manipulation hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.1)] hover:border-black/10 dark:hover:border-white/10" : ""}
    ${className}
  `;

  return (
    <div className={cardClasses} onClick={onClick} {...rest}>
      {children}
    </div>
  );
};

export default Card;
