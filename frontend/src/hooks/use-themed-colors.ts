import { useMemo } from "react";
import { useSettings } from "@/src/settings";
import { buildPalette, type Palette } from "@/src/theme";

export type { Palette };

/**
 * Paleta de cores da tela atual: já considera o tema (claro/escuro/sistema)
 * e o alto contraste. Toda tela deve usar esta paleta — nunca cores fixas.
 */
export function useThemedColors(): Palette {
  const { isDark, highContrast } = useSettings();
  return useMemo(() => buildPalette(isDark, highContrast), [isDark, highContrast]);
}

/** Paleta + flags do tema (para StatusBar, mapa, etc.). */
export function useTheme() {
  const { isDark, highContrast } = useSettings();
  const colors = useMemo(() => buildPalette(isDark, highContrast), [isDark, highContrast]);
  return { colors, isDark, highContrast };
}

/** Small helper: bold weight when high contrast is on */
export function useHCTextWeight(): "600" | "800" {
  const { highContrast } = useSettings();
  return highContrast ? "800" : "600";
}
