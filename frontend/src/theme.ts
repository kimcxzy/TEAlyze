export type Palette = {
  // Superfícies e o texto que vai em cima delas
  surface: string;
  onSurface: string;
  surfaceSecondary: string;
  onSurfaceSecondary: string;
  surfaceTertiary: string;
  onSurfaceTertiary: string;
  surfaceInverse: string;
  onSurfaceInverse: string;
  // Marca
  brand: string;
  brandPrimary: string;
  onBrandPrimary: string;
  brandSecondary: string;
  onBrandSecondary: string;
  brandTertiary: string;
  onBrandTertiary: string;
  // Estados (fundo sólido + texto que vai em cima)
  success: string;
  onSuccess: string;
  warning: string;
  onWarning: string;
  error: string;
  onError: string;
  info: string;
  onInfo: string;
  // Estados em "etiqueta": texto colorido legível sobre fundo suave
  successText: string;
  successBg: string;
  warningText: string;
  warningBg: string;
  errorText: string;
  errorBg: string;
  // Linhas e textos auxiliares
  border: string;
  borderStrong: string;
  divider: string;
  cardBorder: string;
  muted: string;
  /** Véu atrás de modais/menus. */
  scrim: string;
  /** Cor do texto de dica (placeholder) dos campos. */
  placeholder: string;
  // Cabeçalhos em degradê (login, início, perfil do profissional)
  heroGradient: [string, string, string];
  onHero: string;
  onHeroMuted: string;
  /** Cartão que fica por cima do degradê. */
  heroCard: string;
  heroOverlay: string;
  heroOverlayBorder: string;
  /** Fundo atrás do logo: o logo foi desenhado para fundo branco nos dois temas. */
  logoBg: string;
};

export const lightColors: Palette = {
  surface: "#F7FAFC",
  onSurface: "#0F172A",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1E293B",
  surfaceTertiary: "#F1F5F9",
  onSurfaceTertiary: "#334155",
  surfaceInverse: "#0F172A",
  onSurfaceInverse: "#F8FAFC",
  brand: "#2C6491",
  brandPrimary: "#2C6491",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#4A78A3",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E0EAF5",
  onBrandTertiary: "#1C4263",
  success: "#047857",
  onSuccess: "#FFFFFF",
  warning: "#F59E0B",
  onWarning: "#1C1917",
  error: "#DC2626",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",
  successText: "#047857",
  successBg: "#ECFDF5",
  warningText: "#92400E",
  warningBg: "#FEF3C7",
  errorText: "#B91C1C",
  errorBg: "#FEF2F2",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  divider: "#F1F5F9",
  cardBorder: "transparent",
  muted: "#5A687C",
  scrim: "rgba(15,23,42,0.45)",
  placeholder: "#5A687C",
  heroGradient: ["#2C6491", "#41709B", "#E0EAF5"],
  onHero: "#FFFFFF",
  onHeroMuted: "#F1F6FB",
  heroCard: "rgba(255,255,255,0.95)",
  heroOverlay: "rgba(255,255,255,0.2)",
  heroOverlayBorder: "rgba(255,255,255,0.4)",  logoBg: "#FFFFFF",
};

export const darkColors: Palette = {
  surface: "#0B1220",
  onSurface: "#E6EDF7",
  surfaceSecondary: "#131C2E",
  onSurfaceSecondary: "#E2E8F0",
  surfaceTertiary: "#1B2740",
  onSurfaceTertiary: "#CBD5E1",
  surfaceInverse: "#E6EDF7",
  onSurfaceInverse: "#0B1220",
  brand: "#5B9FD8",
  brandPrimary: "#5B9FD8",
  onBrandPrimary: "#06192E",
  brandSecondary: "#7DB2E0",
  onBrandSecondary: "#06192E",
  brandTertiary: "#1B3A5C",
  onBrandTertiary: "#BBD6F2",
  success: "#34D399",
  onSuccess: "#052E1F",
  warning: "#FBBF24",
  onWarning: "#2B1B00",
  error: "#F87171",
  onError: "#2B0505",
  info: "#60A5FA",
  onInfo: "#06192E",
  successText: "#6EE7B7",
  successBg: "#0F2E26",
  warningText: "#FCD34D",
  warningBg: "#35270A",
  errorText: "#FCA5A5",
  errorBg: "#3B1418",
  border: "#26344D",
  borderStrong: "#3A4B6B",
  divider: "#1B2740",
  cardBorder: "#26344D",
  muted: "#94A3B8",
  scrim: "rgba(0,0,0,0.65)",
  placeholder: "#8A9BB4",
  heroGradient: ["#0B2A47", "#12395E", "#0B1220"],
  onHero: "#FFFFFF",
  onHeroMuted: "#C9DAEE",
  heroCard: "rgba(19,28,46,0.96)",
  heroOverlay: "rgba(255,255,255,0.14)",
  heroOverlayBorder: "rgba(255,255,255,0.3)",  logoBg: "#FFFFFF",
};

/** Alto contraste sobre o tema claro: letras pretas e bordas fortes. */
const highContrastLight: Partial<Palette> = {
  onSurface: "#000000",
  onSurfaceSecondary: "#000000",
  onSurfaceTertiary: "#000000",
  onSurfaceInverse: "#FFFFFF",
  muted: "#1E293B",
  placeholder: "#334155",
  border: "#0F172A",
  borderStrong: "#000000",
  divider: "#0F172A",
  cardBorder: "#0F172A",
  brand: "#0B3B62",
  brandPrimary: "#0B3B62",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#1C4263",
  brandTertiary: "#B9D0E3",
  onBrandTertiary: "#000000",
  surface: "#FFFFFF",
  surfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#F1F5F9",
  error: "#B91C1C",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  success: "#065F46",
  errorText: "#7F1D1D",
  warningText: "#78350F",
  successText: "#064E3B",
  heroGradient: ["#0B3B62", "#0B3B62", "#B9D0E3"],
  onHeroMuted: "#FFFFFF",
  heroCard: "#FFFFFF",
  heroOverlay: "rgba(255,255,255,0.3)",
  heroOverlayBorder: "#FFFFFF",
};

/** Alto contraste sobre o tema escuro: letras brancas em fundo preto. */
const highContrastDark: Partial<Palette> = {
  surface: "#000000",
  surfaceSecondary: "#000000",
  surfaceTertiary: "#10161F",
  onSurface: "#FFFFFF",
  onSurfaceSecondary: "#FFFFFF",
  onSurfaceTertiary: "#FFFFFF",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#000000",
  muted: "#E2E8F0",
  placeholder: "#CBD5E1",
  border: "#FFFFFF",
  borderStrong: "#FFFFFF",
  divider: "#FFFFFF",
  cardBorder: "#FFFFFF",
  brand: "#9CCBF5",
  brandPrimary: "#9CCBF5",
  onBrandPrimary: "#000000",
  brandSecondary: "#B7DBF8",
  onBrandSecondary: "#000000",
  brandTertiary: "#0F2A44",
  onBrandTertiary: "#FFFFFF",
  successText: "#A7F3D0",
  warningText: "#FDE68A",
  errorText: "#FECACA",
  errorBg: "#2A0A0E",
  successBg: "#052117",
  warningBg: "#241800",
  heroGradient: ["#000000", "#06121F", "#000000"],
  onHeroMuted: "#FFFFFF",
  heroCard: "#000000",
  heroOverlay: "rgba(255,255,255,0.2)",
  heroOverlayBorder: "#FFFFFF",
};

export function buildPalette(isDark: boolean, highContrast: boolean): Palette {
  const base = isDark ? darkColors : lightColors;
  if (!highContrast) return base;
  return { ...base, ...(isDark ? highContrastDark : highContrastLight) };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const font = {
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const shadow = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};

/**
 * Aparência de um cartão: sombra (some no escuro) + contorno. No tema claro o
 * contorno é transparente (visual idêntico ao original); no escuro ele separa
 * o cartão do fundo, onde a sombra não aparece.
 */
export function cardChrome(colors: Palette) {
  return {
    ...shadow.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  } as const;
}
