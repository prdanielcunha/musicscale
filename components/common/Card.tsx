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
  const isInteractive = interactive ?? Boolean(onClick);
  const cardClasses = `
    ms-surface relative overflow-hidden
    transition-[transform,background-color,border-color,box-shadow] duration-200
    ${padding === "normal" ? "p-5 sm:p-6 md:p-7" : padding === "large" ? "p-6 sm:p-8 md:p-10" : ""}
    ${isInteractive ? "cursor-pointer touch-manipulation hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-[#151922] hover:shadow-[0_18px_48px_rgba(0,0,0,0.24)] active:translate-y-0 active:scale-[0.995]" : ""}
    ${className}
  `;

  return (
    <div className={cardClasses} onClick={onClick} {...rest}>
      {children}
    </div>
  );
};

export default Card;
