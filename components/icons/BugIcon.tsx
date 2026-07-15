import React from "react";

export const BugIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8v4c0 4.4 3.6 8 8 8s8-3.6 8-8v-4z"></path>
    <path d="M10 18v-4M14 18v-4"></path>
    <path d="M4 14h16"></path>
    <path d="M4 10h16"></path>
    <path d="M12 4V2"></path>
    <path d="M12 22v-2"></path>
    <path d="m4.9 4.9 1.4 1.4"></path>
    <path d="m17.7 17.7 1.4 1.4"></path>
    <path d="m4.9 19.1 1.4-1.4"></path>
    <path d="m17.7 6.3 1.4-1.4"></path>
  </svg>
);
