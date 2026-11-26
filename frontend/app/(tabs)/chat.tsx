import { useCallback, useState, useMemo } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

export default function ChatListScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, user } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [convs, setConvs] = useState<any[]>([]);
  const [pros, setPros] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        apiFetch("/chat", token),
        user?.role === "caregiver" ? apiFetch("/professionals", token) : Promise.resolve([]),
      ]);
      setConvs(c);
      setPros(p);
    } catch (e) {
      console.log("chat list error", e);
    }
  }, [token, user?.role]);

  // Recarrega ao voltar para a aba (ex.: depois de enviar a primeira mensagem).
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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontSize: font.xl * scale }]}>Mensagens</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
        {convs.length === 0 && pros.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={64 * scale} color={colors.brandSecondary} />
            <Text style={[styles.emptyText, { fontSize: font.base * scale }]}>
              Nenhuma conversa ainda
            </Text>
          </View>
        ) : null}

        {convs.map((c) => (
          <Pressable
            key={c.other_user.id}
            testID={`conv-${c.other_user.id}`}
            style={styles.row}
            onPress={() => router.push(`/chat/${c.other_user.id}`)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(c.other_user.name || c.other_user.caregiver_name || "?").charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowName, { fontSize: font.base * scale }]} numberOfLines={1}>
                {c.other_user.name || c.other_user.caregiver_name}
              </Text>
              <Text style={[styles.rowLast, { fontSize: font.sm * scale }]} numberOfLines={1}>
                {c.last_text}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        ))}

        {user?.role === "caregiver" && pros.length > 0 ? (
          <>
            <Text style={[styles.section, { fontSize: font.sm * scale }]}>
              Iniciar conversa com um profissional
            </Text>
            {pros.map((p) => (
              <Pressable
                key={p.id}
                testID={`start-conv-${p.id}`}
                style={styles.row}
                onPress={() => router.push(`/chat/${p.id}`)}
              >
                <View style={[styles.avatar, { backgroundColor: colors.brandSecondary }]}>
                  <Text style={styles.avatarText}>{(p.name || "?").charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { fontSize: font.base * scale }]}>{p.name}</Text>
                  <Text style={[styles.rowLast, { fontSize: font.sm * scale }]}>{p.specialty}</Text>
                </View>
                <Ionicons name="add-circle" size={22} color={colors.brandPrimary} />
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
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
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  empty: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  emptyText: { color: colors.muted },
  section: { color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
    ...cardChrome(colors),
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 18 },
  rowName: { color: colors.onSurface, fontWeight: "700" },
  rowLast: { color: colors.muted, marginTop: 2 },
});
