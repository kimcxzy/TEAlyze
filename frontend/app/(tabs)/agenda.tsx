import { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { DocumentSummaryCard } from "@/src/components/DocumentSummary";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { showConfirm, showAlert } from "@/src/utils/webAlert";

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return { day, time, ts: d.getTime() };
  } catch {
    return { day: iso, time: "", ts: 0 };
  }
}

export default function AgendaScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, user } = useAuth();
  const { scale, highContrast } = useSettings();
  const c = useThemedColors();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/appointments/mine", token);
      setItems(data);
    } catch (e) {
      console.log("agenda load err", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // As abas ficam montadas: sem isto, uma consulta recém-agendada (ou confirmada
  // pelo profissional) só aparecia depois de puxar a tela para atualizar.
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

  const isCaregiver = user?.role === "caregiver";

  const handleConfirm = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/appointments/${id}/confirm`, token, { method: "POST" });
      await load();
    } catch (e: any) {
      showAlert("Não foi possível confirmar", e?.message || "Tente novamente.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string) => {
    const doDecline = async () => {
      setBusyId(id);
      try {
        await apiFetch(`/appointments/${id}`, token, { method: "DELETE" });
        await load();
      } catch (e: any) {
        showAlert("Não foi possível recusar", e?.message || "Tente novamente.");
      } finally {
        setBusyId(null);
      }
    };
    showConfirm(
      "Recusar consulta",
      "Tem certeza que deseja recusar este agendamento? Isso ajuda a evitar agendamentos indevidos.",
      { text: "Recusar", style: "destructive", onPress: doDecline },
      { text: "Voltar" }
    );
  };

  const now = Date.now();
  const upcoming = items.filter((i) => {
    const t = new Date(i.scheduled_at).getTime();
    return i.status !== "cancelled" && t >= now;
  });
  const past = items.filter((i) => {
    const t = new Date(i.scheduled_at).getTime();
    return i.status === "cancelled" || t < now;
  });

  const pendingCount = upcoming.filter((i) => i.status === "scheduled").length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.surface }]} edges={["top"]}>
      <View style={[styles.header, { backgroundColor: c.surfaceSecondary, borderBottomColor: c.divider, borderBottomWidth: highContrast ? 2 : 1 }]}>
        <Text style={[styles.title, { color: c.onSurface, fontSize: font.xl * scale }]}>Agenda</Text>
        <Text style={[styles.subtitle, { color: c.muted, fontSize: font.sm * scale }]}>
          {upcoming.length} {upcoming.length === 1 ? "consulta agendada" : "consultas agendadas"}
          {!isCaregiver && pendingCount > 0
            ? ` · ${pendingCount} aguardando ${pendingCount === 1 ? "sua confirmação" : "confirmação"}`
            : ""}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={c.brandPrimary} size="large" />
        </View>
      ) : (
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
          {upcoming.length === 0 && past.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={64 * scale} color={c.brandSecondary} />
              <Text style={{ color: c.muted, fontSize: font.base * scale, textAlign: "center", marginTop: spacing.md }}>
                {isCaregiver
                  ? "Nenhuma consulta agendada.\nEncontre um profissional no mapa para começar."
                  : "Nenhuma consulta agendada com você ainda."}
              </Text>
            </View>
          ) : null}

          {upcoming.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: c.brandPrimary, fontSize: font.sm * scale }]}>
                PRÓXIMAS
              </Text>
              {upcoming.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  c={c}
                  scale={scale}
                  highContrast={highContrast}
                  isCaregiver={isCaregiver}
                  busy={busyId === a.id}
                  onConfirm={() => handleConfirm(a.id)}
                  onDecline={() => handleDecline(a.id)}
                />
              ))}
            </>
          ) : null}

          {past.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: c.muted, fontSize: font.sm * scale, marginTop: spacing.xl }]}>
                HISTÓRICO
              </Text>
              {past.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appt={a}
                  c={c}
                  scale={scale}
                  highContrast={highContrast}
                  isCaregiver={isCaregiver}
                  isPast
                />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatusBadge({ appt, c, scale }: any) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (appt.status === "cancelled") {
    return (
      <View style={[styles.badge, { backgroundColor: c.errorBg }]}>
        <Ionicons name="close-circle" size={12} color={c.errorText} />
        <Text style={[styles.badgeText, { color: c.errorText, fontSize: 11 * scale }]}>Cancelada</Text>
      </View>
    );
  }
  if (appt.status === "confirmed") {
    return (
      <View style={[styles.badge, { backgroundColor: c.successBg }]}>
        <Ionicons name="checkmark-circle" size={12} color={c.successText} />
        <Text style={[styles.badgeText, { color: c.successText, fontSize: 11 * scale }]}>
          Confirmada
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: c.warningBg }]}>
      <Ionicons name="hourglass" size={12} color={c.warningText} />
      <Text style={[styles.badgeText, { color: c.warningText, fontSize: 11 * scale }]}>
        Aguardando confirmação
      </Text>
    </View>
  );
}

function AppointmentCard({ appt, c, scale, highContrast, isCaregiver, isPast, busy, onConfirm, onDecline }: any) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dt = formatDateTime(appt.scheduled_at);
  const cancelled = appt.status === "cancelled";
  const otherName = isCaregiver ? appt.professional_name : appt.caregiver_name;
  const otherRole = isCaregiver ? appt.specialty : `Paciente: ${appt.patient_name}`;
  const showProActions = !isCaregiver && !isPast && !cancelled && appt.status === "scheduled";

  return (
    <View
      testID={`appt-${appt.id}`}
      style={[
        styles.card,
        {
          backgroundColor: c.surfaceSecondary,
          borderColor: c.border,
          borderWidth: highContrast ? 2 : 1,
          opacity: cancelled || isPast ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.dateBadge, { backgroundColor: c.brandPrimary }]}>
          <Text style={{ color: c.onBrandPrimary, fontWeight: "800", fontSize: 12 }}>{dt.day.toUpperCase()}</Text>
          <Text style={{ color: c.onBrandPrimary, fontWeight: "900", fontSize: font.xl * scale }}>{dt.time}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.onSurface, fontWeight: "700", fontSize: font.base * scale }}>{otherName}</Text>
          <Text style={{ color: c.muted, fontSize: font.sm * scale, marginTop: 2 }}>{otherRole}</Text>
          <Text style={{ color: c.muted, fontSize: font.sm * scale, marginTop: 4 }}>
            <Ionicons name="time-outline" size={12} color={c.muted} /> {appt.duration_min} min
          </Text>
          {appt.location ? (
            <Text style={{ color: c.muted, fontSize: font.sm * scale, marginTop: 2 }} numberOfLines={1}>
              <Ionicons name="location-outline" size={12} color={c.muted} /> {appt.location}
            </Text>
          ) : null}
          <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
            <StatusBadge appt={appt} c={c} scale={scale} />
          </View>
        </View>
      </View>

      {!isCaregiver && !cancelled && appt.caregiver_id ? (
        <View style={{ marginTop: spacing.md }}>
          <DocumentSummaryCard caregiverId={appt.caregiver_id} />
        </View>
      ) : null}

      {showProActions ? (
        <View style={styles.actionsRow}>
          <Pressable
            testID={`decline-appt-${appt.id}`}
            disabled={busy}
            onPress={onDecline}
            style={[styles.declineBtn, { borderColor: c.error }, busy && { opacity: 0.5 }]}
          >
            <Ionicons name="close" size={16} color={c.error} />
            <Text style={{ color: c.errorText, fontWeight: "700", fontSize: font.sm * scale }}>Recusar</Text>
          </Pressable>
          <Pressable
            testID={`confirm-appt-${appt.id}`}
            disabled={busy}
            onPress={onConfirm}
            style={[styles.confirmBtn, { backgroundColor: c.success }, busy && { opacity: 0.5 }]}
          >
            {busy ? (
              <ActivityIndicator color={c.onSuccess} size="small" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color={c.onSuccess} />
                <Text style={{ color: c.onSuccess, fontWeight: "700", fontSize: font.sm * scale }}>Confirmar</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontWeight: "800" },
  subtitle: { marginTop: 2 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  sectionTitle: { fontWeight: "800", letterSpacing: 0.5, marginBottom: spacing.md },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    ...cardChrome(colors),
  },
  cardTop: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dateBadge: {
    minWidth: 80,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontWeight: "700" },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  declineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  confirmBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
});
