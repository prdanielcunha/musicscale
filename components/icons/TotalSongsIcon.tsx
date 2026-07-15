import React from "react";

export const TotalSongsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 16.22a2.25 2.25 0 01-1.07-1.916V9.01M9 9V4.5M9 9l-1.06-1.68a2.25 2.25 0 00-1.922-1.029H4.5A2.25 2.25 0 002.25 4.5v.75M9 9l3-3m-3 3l-3 3m-3-3l3-3m0 0l3 3"
    />
  </svg>
);
