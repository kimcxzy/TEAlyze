import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function nextWeekdaySlot() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d;
}

export default function NewAppointmentScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  const { token } = useAuth();
  const { scale } = useSettings();
  const c = useThemedColors();
  const router = useRouter();

  const [pro, setPro] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const defaultDt = nextWeekdaySlot();
  const [date, setDate] = useState(
    `${defaultDt.getFullYear()}-${pad2(defaultDt.getMonth() + 1)}-${pad2(defaultDt.getDate())}`
  );
  const [time, setTime] = useState(`${pad2(defaultDt.getHours())}:${pad2(defaultDt.getMinutes())}`);
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    (async () => {
      if (!professionalId) return;
      try {
        const data = await apiFetch(`/professionals/${professionalId}`, token);
        setPro(data);
      } catch (e) {
        console.log(e);
      }
    })();
  }, [professionalId, token]);

  const submit = async () => {
    setError("");
    const dateText = date.trim();
    const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      setError("Data inválida. Use o formato AAAA-MM-DD (ex.: 2026-08-15).");
      return;
    }
    if (!timeMatch || Number(timeMatch[1]) > 23 || Number(timeMatch[2]) > 59) {
      setError("Horário inválido. Use o formato HH:MM (ex.: 14:30).");
      return;
    }
    // "9:30" vira "09:30" — o servidor exige dois dígitos na hora.
    const iso = `${dateText}T${pad2(Number(timeMatch[1]))}:${timeMatch[2]}:00`;
    setLoading(true);
    try {
      await apiFetch("/appointments", token, {
        method: "POST",
        body: JSON.stringify({
          professional_id: professionalId,
          scheduled_at: iso,
          duration_min: parseInt(duration) || 60,
          notes,
          location: pro?.address || "",
        }),
      });
      router.replace("/(tabs)/agenda");
    } catch (e: any) {
      setError(e.message || "Falha ao agendar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.surface }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { backgroundColor: c.surfaceSecondary, borderBottomColor: c.divider }]}>
        <Pressable testID="appt-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={26} color={c.onSurface} />
        </Pressable>
        <Text style={[styles.title, { fontSize: font.lg * scale, color: c.onSurface }]}>
          Agendar consulta
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {pro ? (
            <View style={[styles.proCard, { backgroundColor: c.brandTertiary }]}>
              <View style={[styles.proAvatar, { backgroundColor: c.brandPrimary }]}>
                <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: 20 }}>
                  {(pro.name || "?").charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.proName, { color: c.onBrandTertiary, fontSize: font.lg * scale }]}>
                  {pro.name}
                </Text>
                <Text style={[styles.proSpec, { color: c.onBrandTertiary, fontSize: font.sm * scale }]}>
                  {pro.specialty}
                </Text>
              </View>
            </View>
          ) : null}

          <Field label="Data (AAAA-MM-DD)" c={c} scale={scale} testID="appt-date-field">
            <TextInput
              testID="appt-date-input"
              value={date}
              onChangeText={setDate}
              placeholder="2026-08-15"
              placeholderTextColor={c.placeholder}
              style={[styles.input, { fontSize: font.lg * scale, color: c.onSurface, borderColor: c.border, backgroundColor: c.surfaceSecondary }]}
            />
          </Field>

          <Field label="Horário (HH:MM)" c={c} scale={scale} testID="appt-time-field">
            <TextInput
              testID="appt-time-input"
              value={time}
              onChangeText={setTime}
              placeholder="14:30"
              placeholderTextColor={c.placeholder}
              style={[styles.input, { fontSize: font.lg * scale, color: c.onSurface, borderColor: c.border, backgroundColor: c.surfaceSecondary }]}
            />
          </Field>

          <Field label="Duração (minutos)" c={c} scale={scale} testID="appt-duration-field">
            <View style={styles.chips}>
              {["30", "45", "60", "90"].map((d) => (
                <Pressable
                  key={d}
                  testID={`duration-${d}`}
                  onPress={() => setDuration(d)}
                  style={[
                    styles.chip,
                    { borderColor: c.border, backgroundColor: c.surfaceSecondary },
                    duration === d && { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
                  ]}
                >
                  <Text style={{ color: duration === d ? c.onBrandPrimary : c.onSurface, fontWeight: "700" }}>
                    {d} min
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Observações (opcional)" c={c} scale={scale} testID="appt-notes-field">
            <TextInput
              testID="appt-notes-input"
              value={notes}
              onChangeText={setNotes}
              placeholder="Ex: primeira consulta, preferência por período da tarde..."
              placeholderTextColor={c.placeholder}
              multiline
              style={[styles.input, styles.textarea, { fontSize: font.base * scale, color: c.onSurface, borderColor: c.border, backgroundColor: c.surfaceSecondary }]}
            />
          </Field>

          {error ? <Text style={{ color: c.errorText, marginTop: spacing.md }}>{error}</Text> : null}

          <Pressable
            testID="appt-submit"
            onPress={submit}
            disabled={loading}
            style={[styles.primaryBtn, { backgroundColor: c.brandPrimary }, loading && { opacity: 0.7 }]}
          >
            {loading ? (
              <ActivityIndicator color={c.onBrandPrimary} />
            ) : (
              <Text style={{ color: c.onBrandPrimary, fontWeight: "800", fontSize: font.lg * scale }}>
                Confirmar agendamento
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, c, scale, testID, children }: any) {
  return (
    <View style={{ marginBottom: spacing.md }} testID={testID}>
      <Text style={{ color: c.onSurfaceTertiary, fontSize: font.sm * scale, fontWeight: "600", marginBottom: spacing.xs }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { padding: spacing.xs },
  title: { fontWeight: "700" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  proCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    ...cardChrome(colors),
  },
  proAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  proName: { fontWeight: "700" },
  proSpec: { marginTop: 2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
});
