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
  const isInteractive = interactive || Boolean(onClick);
  const cardClasses = `
    ms-card
    ${padding === "normal" ? "p-5 sm:p-6 md:p-7" : padding === "large" ? "p-6 sm:p-8 md:p-10" : ""}
    ${isInteractive ? "ms-card-interactive cursor-pointer touch-manipulation" : ""}
    ${className}
  `;

  return (
    <div className={cardClasses} onClick={onClick} {...rest}>
      {children}
    </div>
  );
};

export default Card;