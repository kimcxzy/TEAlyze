import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";

export default function ProfessionalProfileScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const { scale, highContrast } = useSettings();
  const c = useThemedColors();
  const router = useRouter();
  const [pro, setPro] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch(`/professionals/${id}`, token);
        setPro(data);
      } catch (e) {
        console.log("pro load err", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.surface }]}>
        <ActivityIndicator color={c.brandPrimary} size="large" />
      </View>
    );
  }

  if (!pro) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: c.surface }]}>
        <Text style={{ padding: spacing.lg, color: c.onSurface }}>Profissional não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const initial = (pro.name || "?").charAt(0);
  const isCaregiver = user?.role === "caregiver";

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.surface }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: c.surfaceSecondary, borderBottomColor: c.divider, borderBottomWidth: highContrast ? 2 : 1 }]}>
        <Pressable testID="profile-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.brandPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { fontSize: font.lg * scale, color: c.onSurface }]}>Perfil</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.heroCard, { backgroundColor: c.heroGradient[0] }]}>
          <View style={[styles.avatarBig, { backgroundColor: c.heroOverlay, borderColor: c.heroOverlayBorder }]}>
            <Text style={styles.avatarBigText}>{initial}</Text>
          </View>
          <Text style={[styles.name, { fontSize: font.xxl * scale }]} numberOfLines={2}>
            {pro.name}
          </Text>
          <Text style={[styles.spec, { fontSize: font.base * scale }]}>{pro.specialty}</Text>
          <View style={styles.crpPill}>
            <Ionicons name="shield-checkmark" size={14} color={c.successText} />
            <Text style={{ color: c.successText, fontWeight: "700", fontSize: 12 }}>
              CRP {pro.crp} · Verificado
            </Text>
          </View>
        </View>

        {pro.bio ? (
          <Section title="Sobre" c={c} scale={scale}>
            <Text style={[styles.body, { fontSize: font.base * scale, color: c.onSurface }]}>
              {pro.bio}
            </Text>
          </Section>
        ) : null}

        {pro.formation ? (
          <Section title="Formação" c={c} scale={scale}>
            <View style={[styles.formationRow, { borderColor: c.border, borderWidth: highContrast ? 2 : 1 }]}>
              <Ionicons name="school" size={22} color={c.brandPrimary} />
              <Text style={[styles.body, { fontSize: font.base * scale, color: c.onSurface, flex: 1 }]}>
                {pro.formation}
              </Text>
            </View>
          </Section>
        ) : null}

        <Section title="Localização" c={c} scale={scale}>
          <View style={[styles.formationRow, { borderColor: c.border, borderWidth: highContrast ? 2 : 1 }]}>
            <Ionicons name="location" size={22} color={c.brandPrimary} />
            <Text style={[styles.body, { fontSize: font.base * scale, color: c.onSurface, flex: 1 }]}>
              {pro.address}
            </Text>
          </View>
        </Section>

        {pro.phone ? (
          <Section title="Contato" c={c} scale={scale}>
            <View style={[styles.formationRow, { borderColor: c.border, borderWidth: highContrast ? 2 : 1 }]}>
              <Ionicons name="call" size={22} color={c.brandPrimary} />
              <Text style={[styles.body, { fontSize: font.base * scale, color: c.onSurface }]}>
                {pro.phone}
              </Text>
            </View>
          </Section>
        ) : null}

        {isCaregiver ? (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Pressable
              testID="book-appointment-button"
              style={[styles.primaryBtn, { backgroundColor: c.brandPrimary }]}
              onPress={() => router.push(`/appointment/new?professionalId=${pro.id}`)}
            >
              <Ionicons name="calendar" size={18} color={c.onBrandPrimary} />
              <Text style={{ color: c.onBrandPrimary, fontWeight: "800", fontSize: font.lg * scale }}>
                Agendar consulta
              </Text>
            </Pressable>
            <Pressable
              testID="chat-professional-button"
              style={[styles.secondaryBtn, { backgroundColor: c.brandTertiary }]}
              onPress={() => router.push(`/chat/${pro.id}`)}
            >
              <Ionicons name="chatbubble" size={18} color={c.brandPrimary} />
              <Text style={{ color: c.brandPrimary, fontWeight: "700", fontSize: font.base * scale }}>
                Enviar mensagem
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, c, scale, children }: any) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={[styles.sectionTitle, { color: c.muted, fontSize: font.sm * scale }]}>
        {title.toUpperCase()}
      </Text>
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { fontWeight: "700" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    gap: spacing.sm,
    ...cardChrome(colors),
  },
  avatarBig: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginBottom: spacing.xs,
  },
  avatarBigText: { color: colors.onHero, fontWeight: "800", fontSize: 36 },
  name: { color: colors.onHero, fontWeight: "800", textAlign: "center" },
  spec: { color: colors.onHeroMuted, textAlign: "center" },
  crpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.heroCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  sectionTitle: { fontWeight: "700", letterSpacing: 0.5 },
  body: { lineHeight: 22 },
  formationRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
});
