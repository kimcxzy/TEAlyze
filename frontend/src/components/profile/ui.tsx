import { useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

/** Cartão padrão das seções do perfil. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const colors = useThemedColors();
  const { scale } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={[styles.sectionTitle, { fontSize: font.sm * scale }]}>{children}</Text>;
}

type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hint?: string;
  readOnlyNote?: string;
};

/** Campo de formulário com rótulo; `editable={false}` mostra como somente leitura. */
export function FormField({ label, hint, readOnlyNote, editable = true, multiline, ...input }: FieldProps) {
  const colors = useThemedColors();
  const { scale } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { fontSize: font.sm * scale }]}>{label}</Text>
      <TextInput
        {...input}
        editable={editable}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        style={[
          styles.input,
          { fontSize: font.base * scale },
          multiline && styles.inputMultiline,
          !editable && styles.inputReadOnly,
        ]}
      />
      {hint ? <Text style={[styles.hint, { fontSize: font.sm * scale }]}>{hint}</Text> : null}
      {!editable && readOnlyNote ? (
        <Text style={[styles.hint, { fontSize: font.sm * scale }]}>{readOnlyNote}</Text>
      ) : null}
    </View>
  );
}

/** Escolha entre poucas opções (botões lado a lado). */
export function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  const colors = useThemedColors();
  const { scale } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            testID={testIDPrefix ? `${testIDPrefix}-${String(o.value)}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segBtn, active && styles.segBtnActive]}
          >
            <Text style={[styles.segText, { fontSize: font.sm * scale }, active && styles.segTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  const colors = useThemedColors();
  const { scale } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={off}
      style={[styles.primaryBtn, off && { opacity: 0.55 }]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onBrandPrimary} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={colors.onBrandPrimary} /> : null}
          <Text style={[styles.primaryText, { fontSize: font.base * scale }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  loading,
  icon,
  testID,
  danger,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  danger?: boolean;
}) {
  const colors = useThemedColors();
  const { scale } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = danger ? colors.errorText : colors.onBrandTertiary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading}
      style={[styles.secondaryBtn, danger && styles.secondaryDanger, loading && { opacity: 0.6 }]}
    >
      {loading ? (
        <ActivityIndicator color={tone} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tone} /> : null}
          <Text style={[styles.secondaryText, { color: tone, fontSize: font.base * scale }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Mensagem de sucesso/erro de uma ação. */
export function StatusMessage({ kind, text }: { kind: "success" | "error"; text: string }) {
  const colors = useThemedColors();
  const { scale } = useSettings();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const ok = kind === "success";
  return (
    <View style={[styles.status, { backgroundColor: ok ? colors.successBg : colors.errorBg }]} testID={`status-${kind}`}>
      <Ionicons
        name={ok ? "checkmark-circle" : "alert-circle"}
        size={18}
        color={ok ? colors.successText : colors.errorText}
      />
      <Text style={{ color: ok ? colors.successText : colors.errorText, flex: 1, fontSize: font.sm * scale, fontWeight: "600" }}>
        {text}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceSecondary,
      padding: spacing.lg,
      borderRadius: radius.lg,
      marginBottom: spacing.md,
      ...cardChrome(colors),
    },
    sectionTitle: {
      color: colors.muted,
      fontWeight: "700",
      letterSpacing: 0.5,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      textTransform: "uppercase",
    },
    fieldWrap: { marginBottom: spacing.md },
    fieldLabel: { color: colors.onSurfaceSecondary, fontWeight: "600", marginBottom: 6 },
    input: {
      backgroundColor: colors.surfaceTertiary,
      color: colors.onSurface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    inputMultiline: { minHeight: 96, textAlignVertical: "top" },
    inputReadOnly: { backgroundColor: colors.surface, color: colors.muted, borderStyle: "dashed" },
    hint: { color: colors.muted, marginTop: 4 },
    segment: {
      flexDirection: "row",
      flexWrap: "wrap",
      backgroundColor: colors.surfaceTertiary,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
    },
    segBtn: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 64,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    segBtnActive: { backgroundColor: colors.brandPrimary },
    segText: { color: colors.onSurfaceTertiary, fontWeight: "600", textAlign: "center" },
    segTextActive: { color: colors.onBrandPrimary },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md + 2,
      borderRadius: radius.md,
      backgroundColor: colors.brandPrimary,
    },
    primaryText: { color: colors.onBrandPrimary, fontWeight: "700" },
    secondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.brandTertiary,
    },
    secondaryDanger: { backgroundColor: colors.errorBg },
    secondaryText: { fontWeight: "700" },
    status: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      marginTop: spacing.sm,
    },
  });
