import { useMemo } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth";
import { type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

export default function Index() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth/login" />;

  if (user.role === "caregiver" && (user.aq_score === null || user.aq_score === undefined)) {
    return <Redirect href="/auth/aq" />;
  }

  return <Redirect href="/(tabs)/home" />;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
});
