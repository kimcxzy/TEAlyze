import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

export default function LoginScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { signIn } = useAuth();
  const { scale } = useSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setError(e.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.heroGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.hero}>
              <View style={styles.logoBadge}>
                <Image
                  source={require("../../assets/images/tealyze-logo.png")}
                  style={styles.logoImg}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.title, { fontSize: font.xxl * scale }]}>TEAlyze</Text>
              <Text style={[styles.subtitle, { fontSize: font.base * scale }]}>
                Cuidado conectado para o Espectro Autista
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={[styles.cardTitle, { fontSize: font.xl * scale }]}>Bem-vindo(a) de volta</Text>

              <Text style={[styles.label, { fontSize: font.sm * scale }]}>E-mail</Text>
              <TextInput
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="voce@exemplo.com"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, { fontSize: font.lg * scale }]}
              />

              <Text style={[styles.label, { fontSize: font.sm * scale }]}>Senha</Text>
              <TextInput
                testID="login-password-input"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, { fontSize: font.lg * scale }]}
              />

              {error ? (
                <Text testID="login-error" style={[styles.error, { fontSize: font.sm * scale }]}>
                  {error}
                </Text>
              ) : null}

              <Pressable
                testID="login-submit-button"
                onPress={handleLogin}
                disabled={loading}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={[styles.primaryBtnText, { fontSize: font.lg * scale }]}>Entrar</Text>
                )}
              </Pressable>

              <Pressable
                testID="go-to-register-button"
                onPress={() => router.push("/auth/register")}
                style={styles.linkBtn}
              >
                <Text style={[styles.linkText, { fontSize: font.base * scale }]}>
                  Não tem conta? <Text style={{ fontWeight: "700" }}>Cadastre-se</Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.heroGradient[0] },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: spacing.xl },
  logoBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.logoBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.heroOverlayBorder,
    overflow: "hidden",
  },
  logoImg: { width: "82%", height: "82%" },
  title: { color: colors.onHero, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: colors.onHeroMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...cardChrome(colors),
  },
  cardTitle: { fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg },
  label: { color: colors.onSurfaceTertiary, marginBottom: spacing.xs, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    color: colors.onSurface,
    backgroundColor: colors.surfaceTertiary,
  },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  linkBtn: { alignItems: "center", marginTop: spacing.lg, paddingVertical: spacing.sm },
  linkText: { color: colors.brandPrimary },
  error: {
    color: colors.errorText,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
});
