interface BrandIconProps {
  size?: number;
  className?: string;
}
export function BrandIcon({ size = 38, className = "" }: BrandIconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandGlow" x1="5" y1="4" x2="43" y2="44">
          <stop offset="0" stopColor="var(--accent-bright)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="42" height="42" rx="12" fill="var(--brand-bg)" />
      <path
        d="M15 13h18a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3Z"
        fill="none"
        stroke="url(#brandGlow)"
        strokeWidth="2"
      />
      <path
        d="M20 19h8.5a4.5 4.5 0 0 1 0 9H24v-4h4.5a.5.5 0 0 0 0-1H20v9"
        fill="none"
        stroke="url(#brandGlow)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="17" r="1.5" fill="#ef5168" />
      <circle cx="32" cy="17" r="1.5" fill="#52d988" />
      <circle cx="16" cy="31" r="1.5" fill="#52d988" />
      <circle cx="32" cy="31" r="1.5" fill="#4f8cff" />
    </svg>
  );
}
