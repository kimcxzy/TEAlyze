import { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { ProfessionalsMap } from "@/src/components/professionals-map";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, type Palette, shadow } from "@/src/theme";
import { useTheme } from "@/src/hooks/use-themed-colors";

function CaregiverMap() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, user } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [pros, setPros] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/professionals", token);
        setPros(data);
        if (data.length) setSelected(data[0]);
      } catch (e) {
        console.log("pros load error", e);
      }
    })();
  }, [token]);

  // Só aparece no mapa quem tem coordenadas válidas.
  const mapPros = useMemo(
    () =>
      pros
        .map((p) => ({
          id: String(p.id),
          name: p.name as string,
          specialty: p.specialty as string | undefined,
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
        }))
        .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    [pros]
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: font.xl * scale }]}>Profissionais</Text>
        <Text style={[styles.subtitle, { fontSize: font.sm * scale }]}>
          {pros.length} disponíveis próximos
        </Text>
      </View>

      <View style={styles.mapWrap}>
        {mapPros.length ? (
          <ProfessionalsMap
            testID="professionals-map"
            professionals={mapPros}
            selectedId={selected?.id ?? null}
            onSelect={(id) => setSelected(pros.find((p) => p.id === id) ?? null)}
            isDark={isDark}
            colors={colors}
          />
        ) : (
          <View style={styles.mapFallback}>
            <Ionicons name="map" size={64} color={colors.brandSecondary} />
            <Text style={[styles.mapFallbackText, { fontSize: font.base * scale }]}>
              Nenhum profissional com localização no mapa ainda
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.cardsScroll}
        contentContainerStyle={styles.cardsRow}
      >
        {pros.map((p) => (
          <Pressable
            key={p.id}
            testID={`pro-card-${p.id}`}
            style={[styles.proCard, selected?.id === p.id && { borderColor: colors.brandPrimary, borderWidth: 2 }]}
            onPress={() => setSelected(p)}
          >
            <View style={styles.proAvatar}>
              <Text style={styles.proAvatarText}>{(p.name || "?").charAt(0)}</Text>
            </View>
            <Text style={[styles.proName, { fontSize: font.base * scale }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[styles.proSpec, { fontSize: font.sm * scale }]} numberOfLines={2}>
              {p.specialty}
            </Text>
            <View style={styles.crpBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.success} />
              <Text style={styles.crpBadgeText}>CRP {p.crp}</Text>
            </View>
            {user?.role === "caregiver" ? (
              <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.xs }}>
                <Pressable
                  testID={`view-pro-${p.id}`}
                  style={styles.profileBtn}
                  onPress={() => router.push(`/professional/${p.id}`)}
                >
                  <Ionicons name="person" size={14} color={colors.onBrandTertiary} />
                  <Text style={styles.profileBtnText}>Perfil</Text>
                </Pressable>
                <Pressable
                  testID={`chat-with-${p.id}`}
                  style={[styles.chatBtn, { flex: 1 }]}
                  onPress={() => router.push(`/chat/${p.id}`)}
                >
                  <Ionicons name="chatbubble" size={14} color={colors.onBrandPrimary} />
                  <Text style={styles.chatBtnText}>Conversar</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** O mapa é só para cuidadores; se um profissional abrir a rota, volta ao início. */
export default function MapScreen() {
  const { user } = useAuth();
  if (user?.role === "professional") return <Redirect href="/(tabs)/home" />;
  return <CaregiverMap />;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: { fontWeight: "800", color: colors.onSurface },
  subtitle: { color: colors.muted, marginTop: 2 },
  mapWrap: { flex: 1, backgroundColor: colors.surfaceTertiary },
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  mapFallbackText: { color: colors.muted, marginTop: spacing.md, textAlign: "center" },
  // Sem flexGrow 0 o ScrollView horizontal dividia a altura com o mapa e ele ficava minúsculo.
  // O fundo e a linha ficam no ScrollView (e não no conteúdo) para cobrir a largura toda.
  cardsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cardsRow: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  proCard: {
    width: 220,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow.card,
  },
  proAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  proAvatarText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 20 },
  proName: { color: colors.onSurface, fontWeight: "700" },
  proSpec: { color: colors.muted, lineHeight: 18 },
  crpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.successBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  crpBadgeText: { color: colors.successText, fontWeight: "700", fontSize: 11 },
  chatBtn: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  chatBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  profileBtn: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtnText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 13 },
});
