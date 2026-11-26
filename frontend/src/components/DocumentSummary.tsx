import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { formatDate } from "@/src/utils/format";

/** Resposta de GET /laudo/summary (cuidador) e /laudo/summary/:id (profissional). */
export type LaudoSummary = {
  total: number;
  read_by_ai: number;
  without_alerts: number;
  with_alerts: number;
  not_read: number;
  last_sent_at: string | null;
  label: string;
  alerts: { sent_at: string; reasons: string[]; explanation: string }[];
};

export function SummaryBody({ summary, audience }: { summary: LaudoSummary; audience: "professional" | "caregiver" }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { scale } = useSettings();

  return (
    <View testID="doc-summary-body">
      <Text testID="doc-summary-label" style={[styles.label, { fontSize: font.base * scale }]}>
        {summary.label}
      </Text>
      {summary.last_sent_at ? (
        <Text style={[styles.meta, { fontSize: font.sm * scale }]}>Último envio em {formatDate(summary.last_sent_at)}</Text>
      ) : null}
      {summary.not_read > 0 ? (
        <Text style={[styles.meta, { fontSize: font.sm * scale }]}>
          {summary.not_read === 1 ? "1 laudo aguardando" : `${summary.not_read} laudos aguardando`} leitura automática — não
          conta como alerta.
        </Text>
      ) : null}

      {summary.alerts.length > 0 ? (
        <View style={styles.alertBox} testID="doc-summary-alerts">
          <View style={styles.alertHeader}>
            <Ionicons name="alert-circle" size={18} color={colors.warningText} />
            <Text style={[styles.alertTitle, { fontSize: font.base * scale }]}>
              {summary.alerts.length === 1 ? "Ponto de atenção" : "Pontos de atenção"}
            </Text>
          </View>
          {summary.alerts.map((a, i) => (
            <View key={i} style={[styles.alertItem, i > 0 && styles.alertItemBorder]}>
              <Text style={[styles.meta, { fontSize: font.sm * scale }]}>Laudo enviado em {formatDate(a.sent_at)}</Text>
              {a.reasons.map((r, j) => (
                <Text key={j} style={[styles.reason, { fontSize: font.base * scale }]}>
                  • {r}
                </Text>
              ))}
              {a.explanation ? (
                <Text style={[styles.explanation, { fontSize: font.sm * scale }]}>
                  Explicação da família: “{a.explanation}”
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Text style={[styles.disclaimer, { fontSize: font.sm * scale }]}>
        {audience === "professional"
          ? "Indicador automático de apoio, sem valor de diagnóstico nem de julgamento sobre a família. Foto tremida, apelido ou o nome de outro familiar no documento podem gerar alertas. Converse com a família antes de concluir qualquer coisa."
          : "É isto que os profissionais com quem você tem consulta marcada enxergam. Eles não veem a imagem nem o texto dos seus laudos, e este resumo não é uma nota sobre você."}
      </Text>
    </View>
  );
}

/**
 * Cartão recolhível para o PROFISSIONAL (agenda e conversa). Só consulta o
 * servidor quando é aberto, e o servidor só responde se houver consulta
 * marcada com aquela família.
 */
export function DocumentSummaryCard({ caregiverId }: { caregiverId: string }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { scale } = useSettings();

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ok" | "forbidden" | "error">("idle");
  const [summary, setSummary] = useState<LaudoSummary | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const data: LaudoSummary = await apiFetch(`/laudo/summary/${caregiverId}`, token);
      setSummary(data);
      setState("ok");
    } catch (e: any) {
      setState(e?.status === 403 ? "forbidden" : "error");
    }
  }, [caregiverId, token]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && (state === "idle" || state === "error")) load();
  };

  return (
    <View style={styles.card} testID={`doc-summary-${caregiverId}`}>
      <Pressable
        testID={`doc-summary-toggle-${caregiverId}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={styles.toggle}
      >
        <Ionicons name="document-text-outline" size={18} color={colors.brandPrimary} />
        <Text style={[styles.toggleText, { fontSize: font.base * scale }]}>Documentos da família</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {state === "loading" ? <ActivityIndicator color={colors.brandPrimary} /> : null}
          {state === "ok" && summary ? <SummaryBody summary={summary} audience="professional" /> : null}
          {state === "forbidden" ? (
            <Text testID="doc-summary-forbidden" style={[styles.meta, { fontSize: font.sm * scale }]}>
              O resumo dos documentos fica disponível quando há uma consulta marcada com esta família.
            </Text>
          ) : null}
          {state === "error" ? (
            <Pressable onPress={load} accessibilityRole="button">
              <Text style={[styles.retry, { fontSize: font.sm * scale }]}>Não foi possível carregar. Toque para tentar de novo.</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.md,
      ...cardChrome(colors),
      borderColor: colors.border,
    },
    toggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
    toggleText: { color: colors.onSurface, fontWeight: "700", flex: 1 },
    body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
    label: { color: colors.onSurface, fontWeight: "700" },
    meta: { color: colors.muted, marginTop: 4 },
    retry: { color: colors.brandPrimary, fontWeight: "600" },
    alertBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.warningBg,
    },
    alertHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.xs },
    alertTitle: { color: colors.warningText, fontWeight: "800" },
    alertItem: { paddingVertical: spacing.xs },
    alertItemBorder: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
    reason: { color: colors.onSurface, marginTop: 2 },
    explanation: { color: colors.onSurface, marginTop: spacing.xs, fontStyle: "italic" },
    disclaimer: { color: colors.muted, marginTop: spacing.md, lineHeight: 18 },
  });
