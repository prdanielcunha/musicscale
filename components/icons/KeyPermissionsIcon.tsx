import React from "react";

export const KeyPermissionsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
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
    <circle cx="8" cy="15" r="4" />
    <path d="M10.88 12.12l5.4-5.4a2 2 0 1 1 2.83 2.83l-5.4 5.4" />
    <path d="M18 8l4 4" />
    <path d="m21.12 9.88-2.24 2.24" />
  </svg>
);
