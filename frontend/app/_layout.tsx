import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useTheme } from "@/src/hooks/use-themed-colors";
import { AuthProvider } from "@/src/auth";
import { SettingsProvider, useSettings } from "@/src/settings";

LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

function BrightnessOverlay() {
  const { brightness } = useSettings();
  const opacity = 1 - brightness; // brightness 1 => opacity 0 (no dim)
  if (opacity <= 0.01) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: `rgba(0,0,0,${opacity})`, // theme-ok: véu de redução de brilho (preto puro nos dois temas)
        zIndex: 9999,
      }}
    />
  );
}

/** Aplica o tema ao que fica FORA das telas: barra de status, página web e fundo das transições. */
function ThemedShell() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.documentElement.style.backgroundColor = colors.surface;
    document.body.style.backgroundColor = colors.surface;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [colors.surface, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.surface} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
      <BrightnessOverlay />
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If the CDN is unreachable we fall through on error rather than wedging
  // the app — icons will tofu, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AuthProvider>
            <ThemedShell />
          </AuthProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
