import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { View, useColorScheme } from "react-native";
import { storage } from "@/src/utils/storage";
import { darkColors, lightColors } from "@/src/theme";

type FontSize = "sm" | "md" | "lg" | "xl";
/** "system" segue o claro/escuro do aparelho ou do navegador. */
export type ThemeMode = "system" | "light" | "dark";

type Settings = {
  fontSize: FontSize;
  highContrast: boolean;
  brightness: number; // 0..1 dim overlay opacity (1 = normal, 0.5 = 50% dim)
  themeMode: ThemeMode;
};

type Ctx = Settings & {
  setFontSize: (s: FontSize) => void;
  setHighContrast: (b: boolean) => void;
  setBrightness: (v: number) => void;
  setThemeMode: (m: ThemeMode) => void;
  scale: number;
  /** Tema efetivo (já considera "system"). */
  isDark: boolean;
};

const KEY = "tealyze_settings_v1";
const DEFAULT: Settings = { fontSize: "md", highContrast: false, brightness: 1, themeMode: "system" };
const THEME_MODES: ThemeMode[] = ["system", "light", "dark"];
const SCALE_MAP: Record<FontSize, number> = { sm: 0.9, md: 1, lg: 1.15, xl: 1.35 };

const SettingsContext = createContext<Ctx | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Settings>(DEFAULT);
  const [ready, setReady] = useState(false);
  const systemScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      try {
        const raw = await storage.getItem<any>(KEY, null as any);
        if (raw && typeof raw === "object") {
          const themeMode = THEME_MODES.includes(raw.themeMode) ? raw.themeMode : DEFAULT.themeMode;
          setState({ ...DEFAULT, ...raw, themeMode });
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: Settings) => {
    setState(next);
    await storage.setItem(KEY, next as any);
  }, []);

  const isDark = state.themeMode === "dark" || (state.themeMode === "system" && systemScheme === "dark");

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      scale: SCALE_MAP[state.fontSize],
      isDark,
      setFontSize: (s) => persist({ ...state, fontSize: s }),
      setHighContrast: (b) => persist({ ...state, highContrast: b }),
      setBrightness: (v) => persist({ ...state, brightness: v }),
      setThemeMode: (m) => persist({ ...state, themeMode: m }),
    }),
    [state, isDark, persist]
  );

  // Espera as preferências salvas para não piscar o tema errado na abertura.
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: systemScheme === "dark" ? darkColors.surface : lightColors.surface,
        }}
      />
    );
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
