import React from "react";

export const DashboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
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
    <rect width="6" height="6" x="4" y="4" rx="1" />
    <rect width="6" height="6" x="14" y="4" rx="1" />
    <rect width="6" height="6" x="14" y="14" rx="1" />
    <rect width="6" height="6" x="4" y="14" rx="1" />
  </svg>
);
