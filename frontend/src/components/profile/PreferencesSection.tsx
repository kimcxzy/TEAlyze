import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { useSettings, type ThemeMode } from "@/src/settings";
import { spacing, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { Card, Segmented, SectionTitle } from "./ui";

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
];

const SIZES: { value: "sm" | "md" | "lg" | "xl"; label: string }[] = [
  { value: "sm", label: "Pequeno" },
  { value: "md", label: "Padrão" },
  { value: "lg", label: "Grande" },
  { value: "xl", label: "Extra" },
];

const BRIGHTNESS_LEVELS: { value: number; label: string }[] = [
  { value: 1, label: "100%" },
  { value: 0.85, label: "85%" },
  { value: 0.7, label: "70%" },
  { value: 0.5, label: "50%" },
];

/** Aparência, acessibilidade e sair — antiga aba "Ajustes". */
export function PreferencesSection() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { signOut } = useAuth();
  const {
    scale,
    fontSize,
    setFontSize,
    highContrast,
    setHighContrast,
    brightness,
    setBrightness,
    themeMode,
    setThemeMode,
  } = useSettings();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth/login");
  };

  return (
    <View>
      <SectionTitle>Aparência</SectionTitle>
      <Card>
        <Text style={[styles.label, { fontSize: font.base * scale }]}>Tema</Text>
        <Segmented options={THEME_OPTIONS} value={themeMode} onChange={setThemeMode} testIDPrefix="theme" />
        <Text style={[styles.sub, { fontSize: font.sm * scale }]}>
          “Sistema” acompanha o modo claro/escuro do seu aparelho ou navegador.
        </Text>
      </Card>

      <SectionTitle>Acessibilidade</SectionTitle>
      <Card>
        <Text style={[styles.label, { fontSize: font.base * scale }]}>Tamanho da letra</Text>
        <Segmented options={SIZES} value={fontSize} onChange={setFontSize} testIDPrefix="font" />
      </Card>

      <Card>
        <Text style={[styles.label, { fontSize: font.base * scale }]}>Luminosidade</Text>
        <Segmented options={BRIGHTNESS_LEVELS} value={brightness} onChange={setBrightness} testIDPrefix="brightness" />
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.labelNoMargin, { fontSize: font.base * scale }]}>Alto contraste</Text>
            <Text style={[styles.sub, { fontSize: font.sm * scale }]}>
              Aumenta a legibilidade (letras mais fortes, bordas grossas)
            </Text>
          </View>
          <Switch
            testID="high-contrast-switch"
            value={highContrast}
            onValueChange={setHighContrast}
            trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
            thumbColor={colors.surfaceSecondary}
          />
        </View>
      </Card>

      <SectionTitle>Conta</SectionTitle>
      <Pressable testID="sign-out-button" accessibilityRole="button" onPress={handleSignOut}>
        <Card style={styles.signOut}>
          <Ionicons name="log-out" size={22} color={colors.errorText} />
          <Text style={[styles.signOutText, { fontSize: font.base * scale }]}>Sair</Text>
        </Card>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    label: { color: colors.onSurface, fontWeight: "600", marginBottom: spacing.md },
    labelNoMargin: { color: colors.onSurface, fontWeight: "600" },
    sub: { color: colors.muted, marginTop: spacing.sm },
    rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    signOut: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: 0 },
    signOutText: { color: colors.errorText, fontWeight: "600" },
  });
