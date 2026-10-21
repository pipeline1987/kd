export function LeafMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M20 18 32 6l12 12"
        fill="#f4efe6"
        stroke="#1a1a1c"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="36" rx="20" ry="22" fill="#f4efe6" />
      <ellipse cx="32" cy="36" rx="20" ry="22" stroke="#1a1a1c" strokeWidth="2" />
      <path d="M16 32c7 3 10 9 11 14" stroke="#c41e3a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M48 32c-7 3-10 9-11 14" stroke="#c41e3a" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="24.5" cy="34" rx="4.6" ry="6" fill="#0b0b0d" />
      <ellipse cx="39.5" cy="34" rx="4.6" ry="6" fill="#0b0b0d" />
      <path d="M29 46h6" stroke="#c41e3a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}