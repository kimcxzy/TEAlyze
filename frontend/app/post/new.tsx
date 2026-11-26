import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, type Palette, shadow } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

export default function NewPostScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [image, setImage] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
      base64: true,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setImage({
        uri: r.assets[0].uri,
        base64: r.assets[0].base64,
        mime: r.assets[0].mimeType || "image/jpeg",
      });
    }
  };

  const submit = async () => {
    if (!image || !caption.trim()) {
      setError("Adicione uma foto e uma legenda.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiFetch("/posts", token, {
        method: "POST",
        body: JSON.stringify({
          caption: caption.trim(),
          image_base64: image.base64,
          mime_type: image.mime,
        }),
      });
      router.back();
    } catch (e: any) {
      setError(e.message || "Falha ao publicar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable testID="post-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { fontSize: font.lg * scale }]}>Nova publicação</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable testID="post-pick" onPress={pick} style={styles.imagePicker}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.image} />
          ) : (
            <>
              <Ionicons name="image" size={48} color={colors.brandSecondary} />
              <Text style={[styles.pickText, { fontSize: font.base * scale }]}>
                Selecionar foto
              </Text>
            </>
          )}
        </Pressable>

        <Text style={[styles.label, { fontSize: font.sm * scale }]}>Legenda</Text>
        <TextInput
          testID="post-caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Ex: Atividade sensorial - repetir 3x por semana"
          placeholderTextColor={colors.placeholder}
          multiline
          numberOfLines={4}
          style={[styles.input, { fontSize: font.base * scale }]}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          testID="post-submit"
          onPress={submit}
          disabled={loading}
          style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={[styles.primaryBtnText, { fontSize: font.lg * scale }]}>Publicar</Text>
          )}
        </Pressable>
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
  imagePicker: {
    height: 240,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  pickText: { color: colors.muted, marginTop: spacing.sm },
  label: { color: colors.onSurfaceTertiary, marginBottom: spacing.xs, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    color: colors.onSurface,
    minHeight: 100,
    textAlignVertical: "top",
    ...shadow.card,
  },
  error: { color: colors.errorText, marginTop: spacing.md, textAlign: "center" },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
});
