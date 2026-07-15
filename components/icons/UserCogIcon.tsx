import React from "react";

export const UserCogIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="18" cy="15" r="3" />
    <circle cx="9" cy="7" r="4" />
    <path d="M12 15h-1a4 4 0 0 0-4 4v2" />
    <path d="m19.5 12.57-1.21 1.21" />
    <path d="m16.29 18.71 1.21-1.21" />
    <path d="M15 18h.01" />
    <path d="M21 15h-.01" />
    <path d="M17 12v.01" />
    <path d="M19 18v-.01" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
