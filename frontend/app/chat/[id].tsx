import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { DocumentSummaryCard } from "@/src/components/DocumentSummary";

export default function ChatDetailScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const { scale } = useSettings();
  const router = useRouter();
  const [other, setOther] = useState<any | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch(`/chat/${id}`, token);
      setMsgs(data);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.log("chat load", e);
    }
  }, [id, token]);

  const loadOther = useCallback(async () => {
    if (!id) return;
    // 1) o outro lado é um profissional (caso do cuidador)
    try {
      const data = await apiFetch(`/professionals/${id}`, token);
      setOther(data);
      return;
    } catch {
      /* não é profissional — tenta pela lista de conversas */
    }
    // 2) o outro lado é um cuidador (caso do profissional): o nome vem de GET /chat
    try {
      const convs = await apiFetch("/chat", token);
      const found = Array.isArray(convs)
        ? convs.find((c: any) => String(c.other_user?.id) === String(id))
        : null;
      if (found) {
        setOther(found.other_user);
        return;
      }
    } catch {
      /* sem rede: cai no nome genérico */
    }
    setOther({ id, name: "Usuário" });
  }, [id, token]);

  useEffect(() => {
    loadOther();
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load, loadOther]);

  const send = async () => {
    if (!text.trim()) return;
    const payload = text.trim();
    setText("");
    try {
      await apiFetch("/chat/send", token, {
        method: "POST",
        body: JSON.stringify({ to_user_id: id, text: payload }),
      });
      await load();
    } catch (e) {
      console.log("send err", e);
      setText(payload); // devolve o texto para a pessoa tentar de novo
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable testID="chat-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.brandPrimary} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(other?.name || other?.caregiver_name || "?").charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headName, { fontSize: font.lg * scale }]} numberOfLines={1}>
            {other?.name || other?.caregiver_name || "Conversa"}
          </Text>
          {other?.specialty ? (
            <Text style={[styles.headSpec, { fontSize: font.sm * scale }]} numberOfLines={1}>
              {other.specialty}
            </Text>
          ) : null}
        </View>
      </View>

      {user?.role === "professional" && other?.role === "caregiver" ? (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <DocumentSummaryCard caregiverId={String(other.id)} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.brandSecondary} />
              <Text style={styles.emptyText}>Envie a primeira mensagem</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.from_user_id === user?.id;
            return (
              <View style={[styles.bubbleRow, mine ? { justifyContent: "flex-end" } : {}]}>
                <View
                  testID={`msg-${item.id}`}
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                  ]}
                >
                  <Text style={[styles.bubbleText, mine && { color: colors.onBrandTertiary }]}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { fontSize: font.base * scale }]}
            multiline
          />
          <Pressable testID="chat-send" onPress={send} style={styles.sendBtn}>
            <Ionicons name="send" size={20} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onBrandPrimary, fontWeight: "700" },
  headName: { fontWeight: "700", color: colors.onSurface },
  headSpec: { color: colors.muted, marginTop: 1 },
  listContent: { padding: spacing.lg, paddingBottom: spacing.md, flexGrow: 1 },
  empty: { alignItems: "center", justifyContent: "center", flex: 1, gap: spacing.md },
  emptyText: { color: colors.muted },
  bubbleRow: { marginBottom: spacing.sm, flexDirection: "row" },
  bubble: { maxWidth: "78%", padding: spacing.md, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.brandTertiary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.surfaceSecondary,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.onSurface, lineHeight: 20 },
  inputBar: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
