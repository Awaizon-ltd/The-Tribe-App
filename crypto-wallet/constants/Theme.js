// Theme.js
// Monochrome palette — grayscale only (no hue) for both light and dark modes.
// Chain/token brand colors (chain icons, logos) are intentionally left out of
// this file and untouched elsewhere so chains stay visually distinguishable.
//
// ── PAIRING RULES (read before using a color as text on a colored bg) ──────
// Every "on*" token is guaranteed to contrast against its matching background
// token. Never pair two tokens from the primary family as bg+fg together
// (e.g. text: primary on backgroundColor: primaryDark) — they're intentionally
// close in lightness within a theme and will look invisible in at least one
// mode. Use the matching on* token instead:
//   backgroundColor: primary      → color: onPrimary
//   backgroundColor: primaryDark  → color: onPrimaryDark
//   backgroundColor: primaryLight → color: onPrimaryLight
//   backgroundColor: surface/card/background → color: text / textSecondary
//   disabled buttons → backgroundColor: disabledBackground, color: disabledText
// ─────────────────────────────────────────────────────────────────────────

const lightTheme = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',

  text: '#000000',
  textSecondary: '#5C5C5C',
  // Was '#8F8F8F' — only ~3.23:1 against white (fails 4.5:1 for normal text)
  // and ~2.76:1 against primaryLight (#EDEDED), which is likely what you're
  // seeing on info boxes/chips/hint text. Darkened to hit ~4.9:1 vs white
  // and ~4.2:1 vs primaryLight.
  textTertiary: '#707070',

  // Accent — near-black so it reads as the "brand" color while staying monochrome
  primary: '#141414',
  primaryDark: '#000000',
  primaryLight: '#EDEDED', // subtle tinted-background variant (info boxes, chips)

  // "On-color" tokens — text/icon color guaranteed to contrast against the
  // matching background token. Use these instead of reusing surface/text
  // or another primary-family token as a stand-in.
  onPrimary: '#FFFFFF',
  onPrimaryDark: '#FFFFFF',
  onPrimaryLight: '#141414',

  // Disabled state — dedicated tokens instead of repurposing border/textTertiary.
  disabledBackground: '#E0E0E0',
  // Was '#9A9A9A' — only ~2.13:1 against disabledBackground (#E0E0E0), the
  // actual "can't see text on the button" bug. Darkened to ~4.0:1.
  disabledText: '#6B6B6B',
  disabledBorder: '#D0D0D0',

  // Semantic status — grayscale, differentiated by lightness (darker = more urgent)
  success: '#3D3D3D',
  error: '#000000',
  warning: '#707070',
  info: '#707070', // kept equal to textTertiary, same fix applied

  border: '#E0E0E0',
  divider: '#EEEEEE',
};

const darkTheme = {
  background: '#0a0a0a',
  surface: '#131313',
  card: '#1C1C1C',

  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textTertiary: '#808080',

  // Accent — near-white so it reads as the "brand" color while staying monochrome
  primary: '#D4D4D4',
  primaryDark: '#A8A8A8',
  primaryLight: '#1E1E1E', // subtle tinted-background variant (info boxes, chips)

  // "On-color" tokens — text/icon color guaranteed to contrast against the
  // matching background token.
  onPrimary: '#000000',
  onPrimaryDark: '#000000',
  onPrimaryLight: '#D4D4D4',

  // Disabled state — dedicated tokens instead of repurposing border/textTertiary.
  disabledBackground: '#2A2A2A',
  disabledText: '#8C8C8C', // ~4.27:1 vs disabledBackground — already fine
  disabledBorder: '#333333',

  // Semantic status — grayscale, differentiated by lightness (lighter = more urgent)
  success: '#B8B8B8',
  error: '#FFFFFF',
  warning: '#8C8C8C',
  info: '#737373',

  border: '#2A2A2A',
  divider: '#2A2A2A',
};

// Non-color values remain constant
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONTS = {
  regular: "System",
  medium: "System",
  semiBold: "System",
  bold: "System",
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    base: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    xxxl: 34,
  },
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 8,
  },
};

export const THEMES = {
  light: lightTheme,
  dark: darkTheme,
};

// Default export for backward compatibility (uses dark theme)
export const COLORS = darkTheme;