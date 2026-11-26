import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { PersonalSection } from "@/src/components/profile/PersonalSection";
import { LaudosSection } from "@/src/components/profile/LaudosSection";
import { TriagemSection } from "@/src/components/profile/TriagemSection";
import { PreferencesSection } from "@/src/components/profile/PreferencesSection";
import { PrimaryButton } from "@/src/components/profile/ui";
import type { ProfileData } from "@/src/components/profile/types";

type SectionKey = "dados" | "laudos" | "triagem" | "ajustes";

const SECTIONS: { key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap; caregiverOnly?: boolean }[] = [
  { key: "dados", label: "Dados", icon: "person" },
  { key: "laudos", label: "Laudos", icon: "document-text", caregiverOnly: true },
  { key: "triagem", label: "Triagem", icon: "clipboard", caregiverOnly: true },
  { key: "ajustes", label: "Ajustes", icon: "settings" },
];

export default function ProfileScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { scale } = useSettings();
  const params = useLocalSearchParams<{ section?: string }>();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<SectionKey>("dados");

  const load = useCallback(async () => {
    try {
      const data: ProfileData = await apiFetch("/profile", token);
      // Mantém o mesmo objeto se nada mudou: evita descartar o que a pessoa está digitando.
      setProfile((prev) => (prev && JSON.stringify(prev) === JSON.stringify(data) ? prev : data));
      setError("");
    } catch (e: any) {
      setError(e?.message || "Não foi possível carregar o perfil.");
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const available = useMemo(
    () => SECTIONS.filter((s) => !s.caregiverOnly || profile?.role !== "professional"),
    [profile?.role]
  );

  // ?section=laudos abre direto na seção pedida (ex.: depois de enviar um laudo).
  useEffect(() => {
    const wanted = params.section as SectionKey | undefined;
    if (wanted && SECTIONS.some((s) => s.key === wanted)) setSection(wanted);
  }, [params.section]);

  // Se a seção escolhida não existe para este perfil, volta para "Dados".
  useEffect(() => {
    if (profile && !available.some((s) => s.key === section)) setSection("dados");
  }, [profile, available, section]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!profile) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.center}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="cloud-offline" size={40} color={colors.muted} />
              <Text style={[styles.errorText, { fontSize: font.base * scale }]}>{error}</Text>
              <PrimaryButton testID="profile-retry" label="Tentar novamente" icon="refresh" onPress={load} />
            </View>
          ) : (
            <ActivityIndicator color={colors.brandPrimary} size="large" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const isCaregiver = profile.role === "caregiver";
  const initial = (profile.account.name || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandPrimary}
            colors={[colors.brandPrimary]}
            progressBackgroundColor={colors.surfaceSecondary}
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarText, { fontSize: font.xxl * scale }]}>{initial}</Text>
          </View>
          <Text testID="profile-header-name" style={[styles.name, { fontSize: font.xl * scale }]} numberOfLines={2}>
            {profile.account.name}
          </Text>
          <Text style={[styles.meta, { fontSize: font.sm * scale }]} numberOfLines={1}>
            {profile.account.email} · {isCaregiver ? "Cuidador(a)" : "Profissional"}
          </Text>
          <View style={styles.stats}>
            <Stat label="Consultas" value={profile.stats.appointments} />
            <Stat label="Próximas" value={profile.stats.upcoming_appointments} />
            {isCaregiver ? <Stat label="Laudos" value={profile.stats.laudos} /> : null}
          </View>
        </View>

        <View style={styles.tabs}>
          {available.map((s) => {
            const active = s.key === section;
            return (
              <Pressable
                key={s.key}
                testID={`profile-tab-${s.key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSection(s.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons name={s.icon} size={16} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                <Text style={[styles.tabText, { fontSize: font.sm * scale }, active && styles.tabTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {section === "dados" ? <PersonalSection profile={profile} onSaved={setProfile} /> : null}
        {section === "laudos" && isCaregiver ? <LaudosSection onChanged={load} /> : null}
        {section === "triagem" && isCaregiver ? <TriagemSection profile={profile} /> : null}
        {section === "ajustes" ? <PreferencesSection /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { scale } = useSettings();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { fontSize: font.xl * scale }]}>{value}</Text>
      <Text style={[styles.statLabel, { fontSize: font.sm * scale }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
    errorBox: { alignItems: "center", gap: spacing.md },
    errorText: { color: colors.errorText, textAlign: "center" },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    hero: {
      alignItems: "center",
      backgroundColor: colors.heroGradient[0],
      borderRadius: radius.lg,
      padding: spacing.xl,
      gap: spacing.xs,
      ...cardChrome(colors),
    },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.heroOverlay,
      borderWidth: 2,
      borderColor: colors.heroOverlayBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    avatarText: { color: colors.onHero, fontWeight: "800" },
    name: { color: colors.onHero, fontWeight: "800", textAlign: "center" },
    meta: { color: colors.onHeroMuted, textAlign: "center" },
    stats: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
    stat: {
      minWidth: 84,
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.heroCard,
    },
    statValue: { color: colors.onSurface, fontWeight: "800" },
    statLabel: { color: colors.muted, fontWeight: "600" },
    tabs: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceTertiary,
    },
    tabActive: { backgroundColor: colors.brandPrimary },
    tabText: { color: colors.onSurfaceTertiary, fontWeight: "700" },
    tabTextActive: { color: colors.onBrandPrimary },
  });
