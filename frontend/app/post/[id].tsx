import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { spacing, radius, font, type Palette } from "@/src/theme";
import { showConfirm, showAlert } from "@/src/utils/webAlert";
import { AutoImage } from "@/src/components/AutoImage";
import { FormField, PrimaryButton, SecondaryButton, StatusMessage } from "@/src/components/profile/ui";

export default function PostDetailScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Endpoint returns all posts caregiver has access to; find the target.
        const data = await apiFetch("/posts", token);
        const found = data.find((p: any) => p.id === id);
        setPost(found || null);
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, token]);

  // Voltar funciona mesmo quando a página foi aberta direto (sem histórico).
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }, [router]);

  const isAuthor = !!post && !!user && post.author_id === user.id;

  const startEdit = () => {
    setDraft(post?.caption || "");
    setMessage(null);
    setEditing(true);
  };
  const cancelEdit = () => {
    setEditing(false);
    setMessage(null);
  };

  const saveCaption = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiFetch(`/posts/${id}`, token, {
        method: "PUT",
        body: JSON.stringify({ caption: draft }),
      });
      setPost(updated);
      setEditing(false);
      setMessage({ kind: "success", text: "Legenda atualizada." });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Não foi possível salvar a legenda." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showConfirm(
      "Excluir publicação",
      "Tem certeza que deseja excluir esta publicação? Essa ação não pode ser desfeita.",
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await apiFetch(`/posts/${id}`, token, { method: "DELETE" });
            goBack();
          } catch (e: any) {
            setDeleting(false);
            showAlert("Não foi possível excluir", e?.message || "Tente novamente.");
          }
        },
      }
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.root}>
        <Text style={{ padding: spacing.lg, color: colors.onSurface }}>Publicação não encontrada.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          testID="post-back"
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={goBack}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={30} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerName, { fontSize: font.lg * scale }]} numberOfLines={1} testID="post-header-name">
          {post.author_name || "Publicação"}
        </Text>
        {isAuthor ? (
          <Pressable
            testID="post-edit-button"
            accessibilityRole="button"
            accessibilityLabel={editing ? "Cancelar edição" : "Editar legenda"}
            onPress={editing ? cancelEdit : startEdit}
            style={styles.iconBtn}
          >
            <Ionicons name={editing ? "close" : "create-outline"} size={26} color={colors.brandPrimary} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <AutoImage
          testID="post-fullscreen-image"
          accessibilityLabel="Imagem da publicação"
          uri={`data:${post.mime_type || "image/jpeg"};base64,${post.image_base64}`}
          backgroundColor={colors.surfaceTertiary}
        />

        <View style={styles.body}>
          <View style={styles.authorRow}>
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { fontSize: 22 }]}>{(post.author_name || "?").charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.authorName, { fontSize: font.lg * scale }]} testID="post-author-name">
                {post.author_name}
              </Text>
              <Text style={[styles.date, { fontSize: font.sm * scale }]}>
                {new Date(post.created_at).toLocaleString("pt-BR")}
              </Text>
            </View>
          </View>

          {editing ? (
            <View>
              <FormField
                label="Legenda"
                value={draft}
                onChangeText={(t) => {
                  setMessage(null);
                  setDraft(t);
                }}
                multiline
                placeholder="Escreva a legenda da publicação"
                testID="post-caption-input"
                autoFocus
              />
              <View style={styles.editActions}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton testID="post-edit-cancel" label="Cancelar" onPress={cancelEdit} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    testID="post-edit-save"
                    label="Salvar"
                    icon="checkmark"
                    onPress={saveCaption}
                    loading={saving}
                  />
                </View>
              </View>
            </View>
          ) : (
            <Text testID="post-caption-large" style={[styles.caption, { fontSize: (font.xl + 2) * scale }]}>
              {post.caption || (isAuthor ? "Sem legenda. Toque no lápis para adicionar." : "")}
            </Text>
          )}

          {message ? <StatusMessage kind={message.kind} text={message.text} /> : null}

          {isAuthor && !editing ? (
            <Pressable
              testID="post-delete-button-large"
              accessibilityRole="button"
              onPress={handleDelete}
              disabled={deleting}
              style={[styles.deleteBtnLarge, deleting && { opacity: 0.5 }]}
            >
              {deleting ? (
                <ActivityIndicator color={colors.errorText} size="small" />
              ) : (
                <Ionicons name="trash-outline" size={18} color={colors.errorText} />
              )}
              <Text style={{ color: colors.errorText, fontWeight: "700", fontSize: font.base * scale }}>
                Excluir publicação
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.surface },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceSecondary,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconBtn: { padding: spacing.xs, width: 44, alignItems: "center", justifyContent: "center" },
    headerName: { color: colors.onSurface, fontWeight: "700", flex: 1, textAlign: "center" },
    body: {
      padding: spacing.xl,
      backgroundColor: colors.surfaceSecondary,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandPrimary,
    },
    avatarText: { color: colors.onBrandPrimary, fontWeight: "800" },
    authorName: { color: colors.onSurface, fontWeight: "800" },
    date: { color: colors.muted, marginTop: 2 },
    caption: { color: colors.onSurface, lineHeight: 32, fontWeight: "600" },
    editActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
    deleteBtnLarge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.errorText,
    },
  });
