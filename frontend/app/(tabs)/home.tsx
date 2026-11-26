import { useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { AutoImage } from "@/src/components/AutoImage";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";

function formatShort(iso: string) {
  const d = new Date(iso);
  const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const diffMs = d.getTime() - Date.now();
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor(diffMs / 3600000);
  let rel = "";
  if (days > 1) rel = `em ${days} dias`;
  else if (days === 1) rel = "amanhã";
  else if (hours >= 1) rel = `em ${hours}h`;
  else if (diffMs > 0) rel = "hoje mesmo";
  return { dayLabel, time, rel };
}

export default function HomeScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, token } = useAuth();
  const { scale, highContrast } = useSettings();
  const c = colors;
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [nextAppt, setNextAppt] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const isCaregiver = user?.role === "caregiver";

  const load = useCallback(async () => {
    try {
      const [postsData, upcoming] = await Promise.all([
        apiFetch("/posts", token),
        apiFetch("/appointments/upcoming", token).catch(() => null),
      ]);
      setPosts(postsData);
      setNextAppt(upcoming);
    } catch (e) {
      console.log("home load error", e);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greeting = isCaregiver ? user?.caregiver_name : user?.name;
  const borderW = highContrast ? 2 : 1;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.surface }]} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.brandPrimary}
            colors={[c.brandPrimary]}
            progressBackgroundColor={c.surfaceSecondary}
          />
        }
      >
        <View style={[styles.heroCard, { backgroundColor: c.heroGradient[0] }]}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.hello, { fontSize: font.sm * scale }]}>Olá,</Text>
              <Text style={[styles.name, { fontSize: font.xxl * scale }]} numberOfLines={1}>
                {greeting || "Bem-vindo(a)"}
              </Text>
              {isCaregiver && user?.patient_name ? (
                <Text style={[styles.patient, { fontSize: font.base * scale }]}>
                  Cuidando de <Text style={{ fontWeight: "700" }}>{user.patient_name}</Text>
                </Text>
              ) : (
                <Text style={[styles.patient, { fontSize: font.base * scale }]}>{user?.specialty}</Text>
              )}
            </View>
            <View style={styles.heroBadge}>
              <Image
                source={require("../../assets/images/tealyze-logo.png")}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            </View>
          </View>

          {isCaregiver && user?.aq_score !== null && user?.aq_score !== undefined ? (
            <View style={styles.aqPill}>
              <Ionicons name="clipboard" size={14 * scale} color={c.brandPrimary} />
              <Text style={[styles.aqPillText, { fontSize: font.sm * scale, color: c.brandPrimary }]}>
                AQ: {user.aq_score}/50
              </Text>
            </View>
          ) : null}
        </View>

        {nextAppt ? (
          <Pressable
            testID="reminder-card"
            onPress={() => router.push("/(tabs)/agenda")}
            style={[styles.reminderCard, { backgroundColor: c.warningBg, borderColor: c.warning, borderWidth: borderW + 1 }]}
          >
            <View style={[styles.reminderIcon, { backgroundColor: c.warning }]}>
              <Ionicons name="alarm" size={24} color={c.onWarning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.warningText, fontWeight: "800", fontSize: font.sm * scale }}>
                LEMBRETE DE CONSULTA
              </Text>
              {(() => {
                const f = formatShort(nextAppt.scheduled_at);
                const otherName = isCaregiver ? nextAppt.professional_name : nextAppt.caregiver_name;
                const isConfirmed = nextAppt.status === "confirmed";
                return (
                  <>
                    <Text style={{ color: c.onSurface, fontWeight: "700", fontSize: font.lg * scale, marginTop: 4 }}>
                      {isCaregiver ? "Consulta " : "Atendimento "}
                      {f.rel ? `${f.rel} ` : ""}
                      <Text style={{ color: c.brandPrimary }}>({f.time})</Text>
                    </Text>
                    <Text style={{ color: c.onSurfaceTertiary, fontSize: font.sm * scale, marginTop: 2 }}>
                      {f.dayLabel} · com {otherName}
                    </Text>
                    {isCaregiver ? (
                      <View style={styles.confirmRow}>
                        <Ionicons
                          name={isConfirmed ? "checkmark-circle" : "hourglass"}
                          size={13}
                          color={isConfirmed ? c.successText : c.warningText}
                        />
                        <Text
                          style={{
                            color: isConfirmed ? c.successText : c.warningText,
                            fontWeight: "700",
                            fontSize: 12 * scale,
                            marginLeft: 4,
                          }}
                        >
                          {isConfirmed
                            ? "Confirmada pelo profissional"
                            : "Aguardando confirmação do profissional"}
                        </Text>
                      </View>
                    ) : null}
                  </>
                );
              })()}
            </View>
            <Ionicons name="chevron-forward" size={22} color={c.warningText} />
          </Pressable>
        ) : null}

        {isCaregiver ? (
          <>
            <Pressable
              testID="upload-laudo-card"
              style={[styles.actionCard, { backgroundColor: c.surfaceSecondary, borderColor: c.border, borderWidth: borderW }]}
              onPress={() => router.push("/laudo")}
            >
              <View style={[styles.actionIcon, { backgroundColor: c.warningBg }]}>
                <Ionicons name="document-text" size={28 * scale} color={c.warningText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: c.onSurface, fontSize: font.lg * scale }]}>
                  Enviar Laudo Médico
                </Text>
                <Text style={[styles.actionDesc, { color: c.muted, fontSize: font.sm * scale }]}>
                  Envie uma foto e valide com OCR
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22 * scale} color={c.muted} />
            </Pressable>

            <Pressable
              testID="find-pro-card"
              style={[styles.actionCard, { backgroundColor: c.surfaceSecondary, borderColor: c.border, borderWidth: borderW }]}
              onPress={() => router.push("/(tabs)/map")}
            >
              <View style={[styles.actionIcon, { backgroundColor: c.brandTertiary }]}>
                <Ionicons name="location" size={28 * scale} color={c.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionTitle, { color: c.onSurface, fontSize: font.lg * scale }]}>
                  Encontrar Profissionais
                </Text>
                <Text style={[styles.actionDesc, { color: c.muted, fontSize: font.sm * scale }]}>
                  Veja no mapa perto de você
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={22 * scale} color={c.muted} />
            </Pressable>
          </>
        ) : (
          <Pressable
            testID="create-post-card"
            style={[styles.actionCard, { backgroundColor: c.surfaceSecondary, borderColor: c.border, borderWidth: borderW }]}
            onPress={() => router.push("/post/new")}
          >
            <View style={[styles.actionIcon, { backgroundColor: c.brandTertiary }]}>
              <Ionicons name="images" size={28 * scale} color={c.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: c.onSurface, fontSize: font.lg * scale }]}>
                Publicar Material
              </Text>
              <Text style={[styles.actionDesc, { color: c.muted, fontSize: font.sm * scale }]}>
                Compartilhe atividades e fotos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22 * scale} color={c.muted} />
          </Pressable>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.onSurface, fontSize: font.lg * scale }]}>
            {isCaregiver ? "Atualizações" : "Suas publicações"}
          </Text>
        </View>

        {posts.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: c.surfaceSecondary, borderColor: c.border, borderWidth: borderW }]}>
            <Ionicons name="leaf" size={48 * scale} color={c.brandSecondary} />
            <Text style={[styles.emptyText, { color: c.muted, fontSize: font.base * scale }]}>
              {isCaregiver
                ? "Nenhuma atualização ainda. Encontre um profissional para começar."
                : "Nenhuma publicação. Crie a primeira!"}
            </Text>
          </View>
        ) : (
          posts.map((p) => (
            <Pressable
              key={p.id}
              testID={`post-${p.id}`}
              onPress={() => router.push(`/post/${p.id}`)}
              style={({ pressed }) => [
                styles.postCard,
                { backgroundColor: c.surfaceSecondary, borderColor: c.border, borderWidth: borderW },
                pressed && { opacity: 0.85 },
              ]}
            >
              <AutoImage
                uri={`data:${p.mime_type || "image/jpeg"};base64,${p.image_base64}`}
                backgroundColor={c.surfaceTertiary}
                maxHeight={560}
                accessibilityLabel="Imagem da publicação"
              />
              <View style={styles.postBody}>
                <Text style={[styles.postAuthor, { color: c.brandPrimary, fontSize: font.sm * scale }]}>
                  {p.author_name}
                </Text>
                <Text style={[styles.postCaption, { color: c.onSurface, fontSize: font.base * scale }]} numberOfLines={3}>
                  {p.caption}
                </Text>
                <View style={styles.tapHint}>
                  <Ionicons name="expand" size={14} color={c.muted} />
                  <Text style={{ color: c.muted, fontSize: 12, marginLeft: 4 }}>Toque para ampliar</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroCard: { padding: spacing.xl, borderRadius: radius.lg, marginBottom: spacing.lg },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  hello: { color: colors.onHeroMuted, fontWeight: "600" },
  name: { color: colors.onHero, fontWeight: "800", marginTop: 2 },
  patient: { color: colors.onHeroMuted, marginTop: 6 },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.logoBg,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroLogo: { width: "82%", height: "82%" },
  aqPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.heroCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  aqPillText: { fontWeight: "700" },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...cardChrome(colors),
  },
  reminderIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  confirmRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.lg,
    ...cardChrome(colors),
  },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontWeight: "700" },
  actionDesc: { marginTop: 2 },
  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.md },
  sectionTitle: { fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing.xxl, borderRadius: radius.lg, gap: spacing.md },
  emptyText: { textAlign: "center", lineHeight: 22 },
  postCard: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...cardChrome(colors),
  },
  postBody: { padding: spacing.lg },
  postAuthor: { fontWeight: "700", marginBottom: 4 },
  postCaption: { lineHeight: 22 },
  tapHint: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
});
