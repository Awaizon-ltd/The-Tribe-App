// Minimal outline icon set, hand-drawn to match the app's Ionicons-outline
// visual language (1.6 stroke, round joins) rather than pulling in an icon
// library for a dozen glyphs.
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const IconGlobe = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.8 2.6 4.2 5.7 4.2 9s-1.4 6.4-4.2 9c-2.8-2.6-4.2-5.7-4.2-9S9.2 5.6 12 3Z" />
  </svg>
);

export const IconLayers = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
  </svg>
);

export const IconSwap = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M4 8h13M17 8l-3-3M17 8l-3 3" />
    <path d="M20 16H7M7 16l3 3M7 16l3-3" />
  </svg>
);

export const IconChart = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M4 19V9M11 19V4M18 19v-6" />
    <path d="M3 19h18" />
  </svg>
);

export const IconKey = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l8-8M16 4l3 3M13.2 6.8l2 2" />
  </svg>
);

export const IconShield = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const IconPeople = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M15.5 14.2c2.6.3 4.5 2 4.5 4.8" />
  </svg>
);

export const IconVote = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M4 21h16M6 21V9l6-5 6 5v12M10 21v-6h4v6" />
  </svg>
);

export const IconLock = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconPuzzle = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M9 4h4v2.2a1.6 1.6 0 0 0 2.6 1.3A1.6 1.6 0 0 1 18 8.9V13h-2.2a1.6 1.6 0 1 0 0 3.2H18v4h-4v-2.2a1.6 1.6 0 1 0-3.2 0V20H7v-4H4.8a1.6 1.6 0 1 1 0-3.2H7V9H4v-4h5v-1Z" />
  </svg>
);

export const IconChat = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <path d="M4 5h16v11H9l-5 4V5Z" />
    <path d="M8 10h8M8 13h5" />
  </svg>
);

export const IconCheckCircle = (p) => (
  <svg viewBox="0 0 24 24" width={22} height={22} {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </svg>
);

export const IconGoogle = (p) => (
  <svg viewBox="0 0 24 24" width={18} height={18} {...p}>
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.56-5.17 3.56-8.66Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l3.99-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.61l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
    />
  </svg>
);

export const IconChevronRight = (p) => (
  <svg viewBox="0 0 24 24" width={16} height={16} {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export const IconArrowUpRight = (p) => (
  <svg viewBox="0 0 24 24" width={14} height={14} {...base} {...p}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);
