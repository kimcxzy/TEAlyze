import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

const OPTIONS = [
  { label: "Concordo totalmente", value: 0 },
  { label: "Concordo um pouco", value: 1 },
  { label: "Discordo um pouco", value: 2 },
  { label: "Discordo totalmente", value: 3 },
];

export default function AQScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, refresh } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; interpretation: string } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const loadQuestions = useCallback(async () => {
    setLoadError("");
    try {
      const data = await apiFetch("/aq/questions", token);
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(null));
    } catch (e: any) {
      console.log("AQ load error", e);
      setLoadError(e?.message || "Não foi possível carregar o questionário.");
    }
  }, [token]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  if (!questions.length) {
    return (
      <View style={styles.center}>
        {loadError ? (
          <View style={{ paddingHorizontal: spacing.xl, alignItems: "center", gap: spacing.md }}>
            <Text style={{ color: colors.errorText, textAlign: "center", fontSize: font.base * scale }}>
              {loadError}
            </Text>
            <Pressable testID="aq-retry-button" style={styles.primaryBtn} onPress={loadQuestions}>
              <Text style={[styles.primaryBtnText, { fontSize: font.base * scale, paddingHorizontal: spacing.xl }]}>
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : (
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        )}
      </View>
    );
  }

  if (result) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.resultBox}>
          <View style={styles.resultIcon}>
            <Image
              source={require("../../assets/images/tealyze-logo.png")}
              style={styles.resultLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.resultTitle, { fontSize: font.xxl * scale }]}>Questionário concluído</Text>
          <Text style={[styles.resultScore, { fontSize: font.xxl * scale }]}>Pontuação: {result.score} / 50</Text>
          <Text style={[styles.resultDesc, { fontSize: font.base * scale }]}>{result.interpretation}</Text>
          <Pressable
            testID="aq-finish-button"
            style={styles.primaryBtn}
            onPress={async () => {
              await refresh();
              router.replace("/(tabs)/home");
            }}
          >
            <Text style={[styles.primaryBtnText, { fontSize: font.lg * scale }]}>Ir para o app</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const q = questions[idx];
  const selected = answers[idx];
  const progress = ((idx + 1) / questions.length) * 100;

  const setAnswer = (v: number) => {
    const next = [...answers];
    next[idx] = v;
    setAnswers(next);
  };

  const goNext = async () => {
    if (idx < questions.length - 1) {
      setIdx(idx + 1);
      return;
    }
    // submit
    setSubmitting(true);
    setSubmitError("");
    try {
      const data = await apiFetch("/aq/submit", token, {
        method: "POST",
        body: JSON.stringify({ answers: answers.map((a) => a ?? 3) }),
      });
      setResult(data);
    } catch (e: any) {
      console.log("AQ submit error", e);
      setSubmitError(e?.message || "Não foi possível enviar suas respostas. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontSize: font.lg * scale }]}>Questionário AQ</Text>
        <Text style={[styles.headerCount, { fontSize: font.sm * scale }]}>
          {idx + 1} / {questions.length}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.question, { fontSize: font.xl * scale }]}>{q}</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
          {OPTIONS.map((o) => {
            const isSel = selected === o.value;
            return (
              <Pressable
                testID={`aq-option-${o.value}`}
                key={o.value}
                onPress={() => setAnswer(o.value)}
                style={[
                  styles.option,
                  isSel && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
                ]}
              >
                <View style={[styles.radio, isSel && { borderColor: colors.brandPrimary }]}>
                  {isSel ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={[styles.optionText, { fontSize: font.lg * scale }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {submitError ? (
        <Text
          testID="aq-submit-error"
          style={{ color: colors.errorText, textAlign: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, fontSize: font.sm * scale }}
        >
          {submitError}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Pressable
          testID="aq-prev-button"
          disabled={idx === 0}
          onPress={() => setIdx(Math.max(0, idx - 1))}
          style={[styles.secondaryBtn, idx === 0 && { opacity: 0.4 }]}
        >
          <Text style={[styles.secondaryBtnText, { fontSize: font.base * scale }]}>Anterior</Text>
        </Pressable>
        <Pressable
          testID="aq-next-button"
          disabled={selected === null || submitting}
          onPress={goNext}
          style={[styles.primaryBtn, { flex: 1 }, (selected === null || submitting) && { opacity: 0.5 }]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={[styles.primaryBtnText, { fontSize: font.lg * scale }]}>
              {idx === questions.length - 1 ? "Concluir" : "Próximo"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontWeight: "700", color: colors.onSurface },
  headerCount: { color: colors.muted, fontWeight: "600" },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.brandPrimary },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  question: { color: colors.onSurface, fontWeight: "600", lineHeight: 28, marginTop: spacing.xl },
  option: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    gap: spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brandPrimary },
  optionText: { color: colors.onSurface, flex: 1 },
  footer: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.surfaceSecondary,
  },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: colors.onSurface, fontWeight: "600" },
  resultBox: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  resultIcon: { marginBottom: spacing.md, alignItems: "center", justifyContent: "center" },
  resultLogo: { width: 128, height: 128 },
  resultTitle: { fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  resultScore: { fontWeight: "800", color: colors.brandPrimary },
  resultDesc: { color: colors.onSurfaceTertiary, textAlign: "center", lineHeight: 22 },
});
