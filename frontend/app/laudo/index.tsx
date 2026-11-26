import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  BackHandler,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { LaudoAnalysisView } from "@/src/components/LaudoAnalysis";

export default function LaudoScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [image, setImage] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);

  // O botão voltar leva SEMPRE à tela inicial (router.back() dependia do histórico
  // de navegação e, ao abrir a página direto ou após recarregar, não fazia nada).
  const goHome = useCallback(() => {
    router.replace("/(tabs)/home");
  }, [router]);

  // Botão voltar físico do Android também vai para o início.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome])
  );

  // A leitura por IA é opcional no servidor: avisa antes de enviar.
  useEffect(() => {
    (async () => {
      try {
        const status = await apiFetch("/laudo/ocr-status", token);
        setAiEnabled(!!status.enabled);
      } catch {
        setAiEnabled(null);
      }
    })();
  }, [token]);

  const pickImage = async () => {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Permissão para acessar galeria negada");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setImage({
        uri: res.assets[0].uri,
        base64: res.assets[0].base64,
        mime: res.assets[0].mimeType || "image/jpeg",
      });
      setResult(null);
    }
  };

  const takePhoto = async () => {
    setError("");
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Permissão de câmera negada");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setImage({
        uri: res.assets[0].uri,
        base64: res.assets[0].base64,
        mime: res.assets[0].mimeType || "image/jpeg",
      });
      setResult(null);
    }
  };

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    setError("");
    try {
      const data = await apiFetch("/laudo/analyze", token, {
        method: "POST",
        body: JSON.stringify({ image_base64: image.base64, mime_type: image.mime }),
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Falha na análise");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          testID="laudo-back"
          accessibilityRole="button"
          accessibilityLabel="Voltar para a tela inicial"
          onPress={goHome}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.brandPrimary} />
        </Pressable>
        <Text style={[styles.title, { fontSize: font.lg * scale }]}>Laudo Médico</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="document-text" size={40 * scale} color={colors.brandPrimary} />
          <Text style={[styles.heroTitle, { fontSize: font.xl * scale }]}>
            Envie o laudo para validar
          </Text>
          <Text style={[styles.heroDesc, { fontSize: font.base * scale }]}>
            Nosso sistema faz OCR e verifica a autenticidade do documento. Tudo fica salvo no seu perfil.
          </Text>
        </View>

        {aiEnabled === false ? (
          <View testID="laudo-ai-off" style={styles.notice}>
            <Ionicons name="information-circle" size={20} color={colors.warningText} />
            <Text style={[styles.noticeText, { fontSize: font.sm * scale }]}>
              A leitura automática por IA está desligada neste servidor. O laudo será salvo e a checagem de
              fraude continua funcionando; os campos podem ser conferidos manualmente.
            </Text>
          </View>
        ) : null}

        {image ? (
          <View style={styles.imageBox}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.placeholderBox}>
            <Ionicons name="cloud-upload" size={48 * scale} color={colors.brandSecondary} />
            <Text style={[styles.placeholderText, { fontSize: font.base * scale }]}>
              Nenhuma imagem selecionada
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Pressable testID="laudo-pick" onPress={pickImage} style={styles.secondaryBtn}>
            <Ionicons name="images" size={18} color={colors.onBrandTertiary} />
            <Text style={[styles.secondaryBtnText, { fontSize: font.base * scale }]}>Galeria</Text>
          </Pressable>
          <Pressable testID="laudo-camera" onPress={takePhoto} style={styles.secondaryBtn}>
            <Ionicons name="camera" size={18} color={colors.onBrandTertiary} />
            <Text style={[styles.secondaryBtnText, { fontSize: font.base * scale }]}>Câmera</Text>
          </Pressable>
        </View>

        {image ? (
          <Pressable
            testID="laudo-analyze"
            onPress={analyze}
            disabled={analyzing}
            style={[styles.primaryBtn, analyzing && { opacity: 0.7 }]}
          >
            {analyzing ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <>
                <Ionicons name="scan" size={18} color={colors.onBrandPrimary} />
                <Text style={[styles.primaryBtnText, { fontSize: font.lg * scale }]}>
                  Analisar com OCR
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.resultCard}>
            <LaudoAnalysisView result={result} scale={scale} />
            <View style={styles.savedRow}>
              <Ionicons name="save" size={16} color={colors.successText} />
              <Text style={[styles.savedText, { fontSize: font.sm * scale }]}>
                Laudo e análise salvos no seu perfil.
              </Text>
            </View>
            <Pressable
              testID="laudo-open-profile"
              style={styles.linkBtn}
              onPress={() => router.replace({ pathname: "/(tabs)/profile", params: { section: "laudos" } })}
            >
              <Text style={[styles.linkBtnText, { fontSize: font.base * scale }]}>Ver meus laudos no Perfil</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    backBtn: { padding: spacing.xs },
    title: { fontWeight: "700", color: colors.onSurface },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    hero: { alignItems: "center", padding: spacing.lg, gap: spacing.xs, marginBottom: spacing.lg },
    heroTitle: { color: colors.onSurface, fontWeight: "700", textAlign: "center" },
    heroDesc: { color: colors.muted, textAlign: "center" },
    notice: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: colors.warningBg,
    },
    noticeText: { color: colors.onSurface, flex: 1, lineHeight: 18 },
    placeholderBox: {
      height: 240,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceTertiary,
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.md,
    },
    placeholderText: { color: colors.muted },
    imageBox: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.lg,
      overflow: "hidden",
      ...cardChrome(colors),
    },
    imagePreview: { width: "100%", height: 320, backgroundColor: colors.surfaceTertiary },
    actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
    secondaryBtn: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      backgroundColor: colors.brandTertiary,
      borderRadius: radius.md,
    },
    secondaryBtnText: { color: colors.onBrandTertiary, fontWeight: "700" },
    primaryBtn: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      backgroundColor: colors.brandPrimary,
      borderRadius: radius.md,
      marginTop: spacing.md,
    },
    primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
    error: { color: colors.errorText, marginTop: spacing.md, textAlign: "center" },
    resultCard: {
      marginTop: spacing.lg,
      backgroundColor: colors.surfaceSecondary,
      padding: spacing.lg,
      borderRadius: radius.lg,
      ...cardChrome(colors),
    },
    savedRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.lg },
    savedText: { color: colors.successText, fontWeight: "600" },
    linkBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.md,
      paddingVertical: spacing.sm,
    },
    linkBtnText: { color: colors.brandPrimary, fontWeight: "700" },
  });
