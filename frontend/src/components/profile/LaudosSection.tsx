import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { formatDateTime } from "@/src/utils/format";
import { LaudoAnalysisView, type LaudoResult } from "@/src/components/LaudoAnalysis";
import { SummaryBody, type LaudoSummary } from "@/src/components/DocumentSummary";
import { Card, FormField, PrimaryButton, SecondaryButton, SectionTitle, StatusMessage } from "./ui";

type LaudoItem = LaudoResult & { id: string; created_at: string };
type Detail = { image_base64?: string; mime_type?: string };

/**
 * Laudos do perfil. Tudo vem do SQL Server (GET /laudo/mine e /laudo/:id):
 * os laudos e as análises ficam gravados na conta, não no aparelho — então
 * aparecem iguais em qualquer dispositivo e depois de reinstalar o app.
 */
export function LaudosSection({ onChanged }: { onChanged?: () => void }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { token } = useAuth();
  const { scale } = useSettings();

  const [items, setItems] = useState<LaudoItem[] | null>(null);
  const [error, setError] = useState("");
  const [ai, setAi] = useState<{ enabled: boolean; provider: string } | null>(null);
  const [summary, setSummary] = useState<LaudoSummary | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Detail>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string; kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, status, sum] = await Promise.all([
        apiFetch("/laudo/mine", token),
        apiFetch("/laudo/ocr-status", token).catch(() => null),
        apiFetch("/laudo/summary", token).catch(() => null),
      ]);
      setItems(Array.isArray(list) ? list : []);
      if (status) setAi({ enabled: !!status.enabled, provider: status.provider });
      setSummary(sum);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Não foi possível carregar os laudos.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /** O resumo muda quando um laudo é reanalisado ou explicado: busca de novo. */
  const reloadSummary = useCallback(async () => {
    try {
      setSummary(await apiFetch("/laudo/summary", token));
    } catch {
      /* mantém o resumo anterior */
    }
  }, [token]);

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (details[id]) return;
    setLoadingDetail(id);
    try {
      const d = await apiFetch(`/laudo/${id}`, token);
      setDetails((prev) => ({ ...prev, [id]: { image_base64: d.image_base64, mime_type: d.mime_type } }));
    } catch {
      setDetails((prev) => ({ ...prev, [id]: {} }));
    } finally {
      setLoadingDetail(null);
    }
  };

  const reanalyze = async (id: string) => {
    setReanalyzing(id);
    setNotice(null);
    try {
      const updated: LaudoItem = await apiFetch(`/laudo/${id}/reanalyze`, token, { method: "POST" });
      setItems((prev) => (prev ? prev.map((l) => (l.id === id ? updated : l)) : prev));
      setNotice({ id, kind: "success", text: "Análise atualizada e salva no seu perfil." });
      onChanged?.();
      reloadSummary();
    } catch (e: any) {
      setNotice({ id, kind: "error", text: e?.message || "Não foi possível analisar novamente." });
    } finally {
      setReanalyzing(null);
    }
  };

  return (
    <View>
      <SectionTitle>Meus laudos</SectionTitle>

      <Card>
        <View style={styles.aiRow}>
          <Ionicons
            name={ai?.enabled ? "sparkles" : "sparkles-outline"}
            size={20}
            color={ai?.enabled ? colors.successText : colors.muted}
          />
          <Text testID="laudos-ai-status" style={[styles.aiText, { fontSize: font.sm * scale }]}>
            {ai === null
              ? "Verificando a leitura por IA..."
              : ai.enabled
              ? `Leitura automática por IA ativa (${ai.provider}).`
              : "Leitura automática por IA desligada neste servidor. Os laudos são salvos e podem ser analisados depois."}
          </Text>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton testID="laudos-new" label="Enviar novo laudo" icon="cloud-upload" onPress={() => router.push("/laudo")} />
        </View>
      </Card>

      {summary ? (
        <Card>
          <View style={styles.aiRow}>
            <Ionicons name="eye-outline" size={20} color={colors.brandPrimary} />
            <Text style={[styles.summaryTitle, { fontSize: font.base * scale }]}>O que os profissionais veem</Text>
          </View>
          <View testID="family-summary" style={{ marginTop: spacing.sm }}>
            <SummaryBody summary={summary} audience="caregiver" />
          </View>
        </Card>
      ) : null}

      {items === null ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.xl }} />
      ) : null}
      {error ? <StatusMessage kind="error" text={error} /> : null}

      {items && items.length === 0 && !error ? (
        <Card>
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={36 * scale} color={colors.muted} />
            <Text style={[styles.emptyTitle, { fontSize: font.lg * scale }]}>Nenhum laudo enviado ainda</Text>
            <Text style={[styles.emptyText, { fontSize: font.base * scale }]}>
              Os laudos que você enviar e as análises feitas ficam guardados aqui, na sua conta.
            </Text>
          </View>
        </Card>
      ) : null}

      {items?.map((l) => {
        const open = openId === l.id;
        const detail = details[l.id];
        const tone = l.is_valid_laudo ? colors.successText : colors.errorText;
        return (
          <Card key={l.id} style={styles.item}>
            <Pressable
              testID={`laudo-item-${l.id}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              onPress={() => toggle(l.id)}
              style={styles.itemHeader}
            >
              <View style={[styles.itemIcon, { backgroundColor: l.is_valid_laudo ? colors.successBg : colors.errorBg }]}>
                <Ionicons name={l.is_valid_laudo ? "checkmark-circle" : "alert-circle"} size={22} color={tone} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { fontSize: font.base * scale }]} numberOfLines={1}>
                  {l.diagnosis || l.patient_name || "Laudo enviado"}
                </Text>
                <Text style={[styles.itemMeta, { fontSize: font.sm * scale }]}>
                  {formatDateTime(l.created_at)} · <Text style={{ color: tone, fontWeight: "700" }}>{l.is_valid_laudo ? "Válido" : "Não validado"}</Text>
                </Text>
              </View>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
            </Pressable>

            {open ? (
              <View style={styles.itemBody}>
                {loadingDetail === l.id ? (
                  <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: spacing.md }} />
                ) : detail?.image_base64 ? (
                  <Image
                    testID={`laudo-image-${l.id}`}
                    source={{ uri: `data:${detail.mime_type || "image/jpeg"};base64,${detail.image_base64}` }}
                    style={styles.image}
                    resizeMode="contain"
                    accessibilityLabel="Imagem do laudo enviado"
                  />
                ) : null}

                <LaudoAnalysisView result={l} scale={scale} />

                {l.cross_check?.fraud_risk === "high" || !l.is_valid_laudo ? (
                  <ExplanationEditor
                    laudo={l}
                    onSaved={(updated) => {
                      setItems((prev) => (prev ? prev.map((x) => (x.id === updated.id ? updated : x)) : prev));
                      reloadSummary();
                    }}
                  />
                ) : null}

                {notice && notice.id === l.id ? <StatusMessage kind={notice.kind} text={notice.text} /> : null}
                <View style={{ marginTop: spacing.md }}>
                  <SecondaryButton
                    testID={`laudo-reanalyze-${l.id}`}
                    label="Analisar novamente"
                    icon="refresh"
                    loading={reanalyzing === l.id}
                    onPress={() => reanalyze(l.id)}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

/**
 * O cuidador pode explicar um alerta (ex.: "o laudo está no nome da minha mãe").
 * A explicação é mostrada ao profissional, junto do alerta, no resumo.
 */
function ExplanationEditor({ laudo, onSaved }: { laudo: LaudoItem; onSaved: (l: LaudoItem) => void }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { scale } = useSettings();
  const saved = laudo.explanation || "";
  const [text, setText] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const updated: LaudoItem = await apiFetch(`/laudo/${laudo.id}/explanation`, token, {
        method: "PUT",
        body: JSON.stringify({ explanation: text }),
      });
      onSaved(updated);
      setMsg({ kind: "success", text: "Explicação salva. Ela aparece para o profissional junto do alerta." });
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "Não foi possível salvar a explicação." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.explainBox} testID={`explain-${laudo.id}`}>
      <Text style={[styles.explainHint, { fontSize: font.sm * scale }]}>
        Este laudo gerou um alerta. Se houver uma razão (foto ruim, nome de outro familiar, documento de outra clínica),
        você pode explicar abaixo; o profissional que atende vocês verá o seu texto.
      </Text>
      <FormField
        label={`Explicação (opcional, ${text.length}/500)`}
        value={text}
        onChangeText={(t) => {
          setMsg(null);
          setText(t.slice(0, 500));
        }}
        multiline
        placeholder="Ex.: O laudo está no nome da minha mãe, que é a responsável legal."
        testID={`explain-input-${laudo.id}`}
      />
      {msg ? <StatusMessage kind={msg.kind} text={msg.text} /> : null}
      <View style={{ marginTop: spacing.sm }}>
        <SecondaryButton
          testID={`explain-save-${laudo.id}`}
          label={saved && !text.trim() ? "Remover explicação" : "Salvar explicação"}
          icon="save-outline"
          loading={busy}
          onPress={save}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    aiRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    aiText: { color: colors.onSurface, flex: 1, lineHeight: 18 },
    summaryTitle: { color: colors.onSurface, fontWeight: "700", flex: 1 },
    explainBox: { marginTop: spacing.lg },
    explainHint: { color: colors.muted, marginBottom: spacing.sm, lineHeight: 18 },
    empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
    emptyTitle: { color: colors.onSurface, fontWeight: "700" },
    emptyText: { color: colors.muted, textAlign: "center" },
    item: { padding: 0, overflow: "hidden" },
    itemHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
    itemIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    itemTitle: { color: colors.onSurface, fontWeight: "700" },
    itemMeta: { color: colors.muted, marginTop: 2 },
    itemBody: {
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    image: {
      width: "100%",
      height: 260,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceTertiary,
      marginBottom: spacing.md,
    },
  });
