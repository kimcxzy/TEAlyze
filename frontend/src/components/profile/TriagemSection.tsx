import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useSettings } from "@/src/settings";
import { spacing, radius, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { formatDateTime } from "@/src/utils/format";
import { Card, PrimaryButton, SectionTitle } from "./ui";
import type { ProfileData } from "./types";

/** Resultado da triagem AQ-50 (gravado em TRIAGEM/RESPOSTA_TRIAGEM). */
export function TriagemSection({ profile }: { profile: ProfileData }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { scale } = useSettings();
  const aq = profile.aq;

  return (
    <View>
      <SectionTitle>Triagem AQ-50</SectionTitle>
      <Card>
        {aq ? (
          <>
            <View style={styles.scoreRow}>
              <View style={styles.scoreBadge} testID="aq-score">
                <Text style={[styles.scoreNumber, { fontSize: font.xxl * scale }]}>{aq.score}</Text>
                <Text style={[styles.scoreMax, { fontSize: font.sm * scale }]}>de 50</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { fontSize: font.lg * scale }]}>Último resultado</Text>
                <Text style={[styles.meta, { fontSize: font.sm * scale }]}>
                  Respondido em {formatDateTime(aq.submitted_at)}
                  {profile.patient?.name ? ` · ${profile.patient.name}` : ""}
                </Text>
              </View>
            </View>
            <Text style={[styles.interpretation, { fontSize: font.base * scale }]}>{aq.interpretation}</Text>
          </>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={36 * scale} color={colors.muted} />
            <Text style={[styles.title, { fontSize: font.lg * scale }]}>Questionário ainda não respondido</Text>
            <Text style={[styles.meta, { fontSize: font.base * scale, textAlign: "center" }]}>
              O AQ-50 ajuda a identificar traços do espectro autista. É uma triagem, não um diagnóstico.
            </Text>
          </View>
        )}
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            testID="aq-retake"
            label={aq ? "Refazer questionário" : "Responder agora"}
            icon="create"
            onPress={() => router.push("/auth/aq")}
          />
        </View>
      </Card>
      <Text style={[styles.disclaimer, { fontSize: font.sm * scale }]}>
        O AQ-50 é um instrumento de triagem. Somente um profissional de saúde pode concluir um diagnóstico.
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    scoreBadge: {
      width: 84,
      height: 84,
      borderRadius: radius.lg,
      backgroundColor: colors.brandTertiary,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreNumber: { color: colors.onBrandTertiary, fontWeight: "800" },
    scoreMax: { color: colors.onBrandTertiary },
    title: { color: colors.onSurface, fontWeight: "700" },
    meta: { color: colors.muted, marginTop: 2 },
    interpretation: { color: colors.onSurface, marginTop: spacing.lg, lineHeight: 22 },
    empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
    disclaimer: { color: colors.muted, textAlign: "center", marginTop: spacing.sm },
  });
