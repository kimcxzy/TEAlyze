import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { spacing, radius, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

/**
 * Resultado da análise de um laudo (OCR + checagem de fraude).
 * Usado na tela de envio (/laudo) e na aba Perfil, que lê o mesmo dado
 * do banco — por isso o formato é o mesmo da API (`laudosRepository.toApi`).
 */
export type LaudoResult = {
  id?: string;
  is_valid_laudo: boolean;
  confidence?: number | null;
  extracted_text?: string;
  patient_name?: string | null;
  patient_cpf?: string | null;
  patient_birthdate?: string | null;
  diagnosis?: string | null;
  cid?: string | null;
  professional_name?: string | null;
  crp_or_crm?: string | null;
  institution?: string | null;
  institution_address?: string | null;
  issue_date?: string | null;
  warnings?: string[];
  cross_check?: any;
  created_at?: string;
  /** Explicação opcional do cuidador sobre este laudo (o profissional a vê junto do alerta). */
  explanation?: string;
};

export function ValidityBadge({ valid, confidence, scale = 1 }: { valid: boolean; confidence?: number | null; scale?: number }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = valid ? colors.successText : colors.errorText;
  return (
    <View style={[styles.badge, { backgroundColor: valid ? colors.successBg : colors.errorBg }]}>
      <Ionicons name={valid ? "checkmark-circle" : "alert-circle"} size={20} color={tone} />
      <Text style={{ color: tone, fontWeight: "700", flex: 1, fontSize: font.base * scale }}>
        {valid ? "Laudo aparenta ser válido" : "Documento não validado"}
        {confidence !== undefined && confidence !== null ? ` · ${confidence}% confiança` : ""}
      </Text>
    </View>
  );
}

export function LaudoAnalysisView({ result, scale = 1 }: { result: LaudoResult; scale?: number }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View testID="laudo-result">
      <ValidityBadge valid={result.is_valid_laudo} confidence={result.confidence} scale={scale} />

      {result.cross_check ? <FraudCheckSection cc={result.cross_check} scale={scale} /> : null}

      {result.patient_name ? <Field label="Paciente" value={result.patient_name} scale={scale} /> : null}
      {result.patient_cpf ? <Field label="CPF do paciente" value={result.patient_cpf} scale={scale} /> : null}
      {result.patient_birthdate ? (
        <Field label="Data de nascimento" value={result.patient_birthdate} scale={scale} />
      ) : null}
      {result.diagnosis ? <Field label="Diagnóstico" value={result.diagnosis} scale={scale} /> : null}
      {result.cid ? <Field label="CID" value={result.cid} scale={scale} /> : null}
      {result.professional_name ? <Field label="Profissional" value={result.professional_name} scale={scale} /> : null}
      {result.crp_or_crm ? <Field label="Registro" value={result.crp_or_crm} scale={scale} /> : null}
      {result.institution ? <Field label="Instituição" value={result.institution} scale={scale} /> : null}
      {result.institution_address ? (
        <Field label="Endereço" value={result.institution_address} scale={scale} />
      ) : null}
      {result.issue_date ? <Field label="Data de emissão" value={result.issue_date} scale={scale} /> : null}

      {result.extracted_text ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={[styles.fieldLabel, { fontSize: font.sm * scale }]}>Texto extraído</Text>
          <View style={styles.textBox}>
            <Text style={{ color: colors.onSurface, lineHeight: 20, fontSize: font.base * scale }}>
              {result.extracted_text}
            </Text>
          </View>
        </View>
      ) : null}

      {result.warnings?.length ? (
        <View style={styles.warnBox}>
          <Text style={{ color: colors.warningText, fontWeight: "700", marginBottom: 4, fontSize: font.base * scale }}>
            Avisos:
          </Text>
          {result.warnings.map((w, i) => (
            <Text key={i} style={{ color: colors.onSurface, fontSize: font.base * scale }}>
              • {w}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FraudCheckSection({ cc, scale }: { cc: any; scale: number }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const high = cc.fraud_risk === "high";
  const medium = cc.fraud_risk === "medium";
  const riskColor = high ? colors.errorText : medium ? colors.warningText : colors.successText;
  const riskBg = high ? colors.errorBg : medium ? colors.warningBg : colors.successBg;
  const riskLabel = high ? "Alto" : medium ? "Médio" : "Baixo";
  const similarity = (x: number | undefined) => Math.round((x ?? 0) * 100);

  return (
    <View style={[styles.fraudBox, { backgroundColor: riskBg }]} testID="fraud-check">
      <View style={styles.fraudHeader}>
        <Ionicons
          name={high ? "shield" : medium ? "shield-half" : "shield-checkmark"}
          size={20}
          color={riskColor}
        />
        <Text style={{ color: riskColor, fontWeight: "800", fontSize: font.base * scale }}>
          Risco de fraude: {riskLabel}
        </Text>
      </View>

      <CheckPill
        ok={!!cc.patient_name_match}
        label={
          cc.patient_name_match
            ? `Nome do paciente confere (${similarity(cc.patient_name_similarity)}%)`
            : `Nome não confere com o cadastro (${similarity(cc.patient_name_similarity)}%)`
        }
      />

      {cc.patient_cpf_match !== null && cc.patient_cpf_match !== undefined ? (
        <CheckPill ok={!!cc.patient_cpf_match} label={cc.patient_cpf_match ? "CPF confere" : "CPF do paciente diverge"} />
      ) : null}

      {cc.professional_consistency && cc.professional_consistency !== "first_laudo" ? (
        <CheckPill
          ok={cc.professional_consistency === "same"}
          label={
            cc.professional_consistency === "same"
              ? "Mesmo profissional de laudos anteriores"
              : "Profissional diferente do histórico"
          }
        />
      ) : null}

      {cc.address_consistency && cc.address_consistency !== "first_laudo" ? (
        <CheckPill
          ok={cc.address_consistency === "same"}
          label={
            cc.address_consistency === "same"
              ? "Mesma instituição/endereço"
              : "Instituição/endereço diferente do histórico"
          }
        />
      ) : null}

      {cc.fraud_signals?.length ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ color: riskColor, fontWeight: "700", marginBottom: 4, fontSize: font.base * scale }}>
            Sinais detectados:
          </Text>
          {cc.fraud_signals.map((s: string, i: number) => (
            <Text key={i} style={{ color: colors.onSurface, marginTop: 2, fontSize: font.base * scale }}>
              • {s}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CheckPill({ ok, label }: { ok: boolean; label: string }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.pillRow}>
      <Ionicons
        name={ok ? "checkmark-circle" : "close-circle"}
        size={18}
        color={ok ? colors.successText : colors.errorText}
      />
      <Text style={{ color: colors.onSurface, flex: 1, marginLeft: 6 }}>{label}</Text>
    </View>
  );
}

function Field({ label, value, scale }: { label: string; value: string; scale: number }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={[styles.fieldLabel, { fontSize: font.sm * scale }]}>{label}</Text>
      <Text style={[styles.fieldValue, { fontSize: font.base * scale }]}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.md,
    },
    fraudBox: { padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, gap: 6 },
    fraudHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 4 },
    pillRow: { flexDirection: "row", alignItems: "center", paddingVertical: 2 },
    fieldLabel: { color: colors.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
    fieldValue: { color: colors.onSurface, fontWeight: "600", marginTop: 2 },
    textBox: {
      marginTop: spacing.xs,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceTertiary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    warnBox: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.warningBg,
    },
  });
