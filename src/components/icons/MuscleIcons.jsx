import React from 'react';

export const ChestIcon = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 8 Q3 4 7 4 L17 4 Q21 4 21 8 L21 11 Q21 16 18 18 Q15 19 12 17 Q9 19 6 18 Q3 16 3 11 Z" />
    <line x1="12" y1="7" x2="12" y2="17" opacity="0.4" />
  </svg>
);

export const BackIcon = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M6 4 L12 3 L18 4 L21 12 L18 20 L12 21 L6 20 L3 12 Z" />
    <line x1="12" y1="3" x2="12" y2="21" opacity="0.4" />
    <line x1="6" y1="12" x2="18" y2="12" opacity="0.3" />
  </svg>
);

export const LegsIcon = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M8 3 Q6 4 6 8 L6 14 Q6 18 7 21 L9 21 Q10 18 10 14 L10 8 Q10 4 8 3 Z" />
    <path d="M16 3 Q14 4 14 8 L14 14 Q14 18 15 21 L17 21 Q18 18 18 14 L18 8 Q18 4 16 3 Z" />
  </svg>
);

export const ShouldersIcon = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="8" />
    <path d="M5 12 Q7 6 12 6" opacity="0.6" />
    <path d="M19 12 Q17 6 12 6" opacity="0.6" />
    <line x1="12" y1="6" x2="12" y2="12" opacity="0.4" />
  </svg>
);

export const ArmsIcon = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 18 L5 12 Q5 8 8 7 L12 5 Q16 4 17 8 L19 13 Q20 17 18 19" />
    <path d="M9 9 Q11 6 14 7" opacity="0.5" />
  </svg>
);

export const CoreIcon = ({ size = 18, ...props }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="7" y="3" width="10" height="18" rx="3" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="7" y1="9" x2="17" y2="9" />
    <line x1="7" y1="13" x2="17" y2="13" />
    <line x1="7" y1="17" x2="17" y2="17" />
  </svg>
);
