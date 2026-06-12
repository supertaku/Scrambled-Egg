import { lightColors } from "./themes";

/**
 * Legacy static palette alias. These are the light-theme tokens; the values
 * are byte-identical to the original hardcoded object so existing screens
 * render unchanged.
 *
 * New or migrating code should use `useTheme()` / `useThemeColors()` from
 * `@/theme/ThemeProvider` instead so it picks up dark mode in Phase 2.
 */
export const colors = lightColors;
