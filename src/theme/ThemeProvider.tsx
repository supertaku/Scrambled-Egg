import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { StyleSheet, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/utils/logger";
import { darkTheme, lightTheme, type Theme, type ThemePreference } from "./themes";

const THEME_PREFERENCE_KEY = "haki.themePreference";

/**
 * All screens consume theme tokens (Phase 2), so "system" follows the OS
 * appearance. The campus map keeps its intentional retro palette.
 */
const SYSTEM_DARK_ENABLED = true;

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  setPreference: () => undefined,
  theme: lightTheme
});

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((stored) => {
        if (mounted && isThemePreference(stored)) {
          setPreferenceState(stored);
        }
      })
      .catch((error) => {
        logger.ui.warn("Could not load theme preference; using system.", {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch((error) => {
      logger.ui.warn("Could not persist theme preference.", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }, []);

  const theme = useMemo(() => {
    if (preference === "dark") {
      return darkTheme;
    }
    if (preference === "system" && SYSTEM_DARK_ENABLED && systemScheme === "dark") {
      return darkTheme;
    }
    return lightTheme;
  }, [preference, systemScheme]);

  const value = useMemo(
    () => ({ preference, setPreference, theme }),
    [preference, setPreference, theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  return useContext(ThemeContext).theme.colors;
}

/**
 * Memoized themed StyleSheet factory:
 * `const styles = useThemedStyles((t) => StyleSheet.create({ card: { backgroundColor: t.colors.card } }))`
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (theme: Theme) => T
): T {
  const { theme } = useContext(ThemeContext);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- factory is expected to be stable per call site
  return useMemo(() => factory(theme), [theme]);
}
