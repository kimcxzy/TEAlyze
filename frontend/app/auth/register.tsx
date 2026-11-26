import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useAuth, Role } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, radius, font, cardChrome, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";

export default function RegisterScreen() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { signUpCaregiver, signUpProfessional } = useAuth();
  const { scale } = useSettings();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  // caregiver
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverCpf, setCaregiverCpf] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  // professional
  const [proName, setProName] = useState("");
  const [proCpf, setProCpf] = useState("");
  const [crp, setCrp] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [formation, setFormation] = useState("");
  const [bio, setBio] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("-23.5605");
  const [lng, setLng] = useState("-46.6543");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      if (role === "caregiver") {
        await signUpCaregiver({
          email: email.trim(),
          password,
          caregiver_name: caregiverName,
          caregiver_cpf: caregiverCpf,
          patient_name: patientName,
          patient_cpf: patientCpf,
          phone,
        });
        router.replace("/auth/aq");
      } else {
        await signUpProfessional({
          email: email.trim(),
          password,
          name: proName,
          cpf: proCpf,
          crp,
          specialty,
          formation,
          bio,
          phone,
          latitude: parseFloat(lat) || -23.5605,
          longitude: parseFloat(lng) || -46.6543,
          address,
        });
        router.replace("/(tabs)/home");
      }
    } catch (e: any) {
      setError(e.message || "Falha no cadastro");
    } finally {
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.rolePicker}>
          <Pressable testID="back-to-login" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24 * scale} color={colors.brandPrimary} />
            <Text style={[styles.backText, { fontSize: font.base * scale }]}>Voltar</Text>
          </Pressable>

          <Text style={[styles.heading, { fontSize: font.xxl * scale }]}>Quem é você?</Text>
          <Text style={[styles.subheading, { fontSize: font.base * scale }]}>
            Escolha o tipo de conta para começar
          </Text>

          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/images/tealyze-logo.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>

          <Pressable
            testID="role-caregiver-card"
            style={styles.roleCard}
            onPress={() => setRole("caregiver")}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="people" size={32 * scale} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleTitle, { fontSize: font.lg * scale }]}>Sou Cuidador(a)</Text>
              <Text style={[styles.roleDesc, { fontSize: font.sm * scale }]}>
                Responsável por uma pessoa com TEA
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22 * scale} color={colors.muted} />
          </Pressable>

          <Pressable
            testID="role-professional-card"
            style={styles.roleCard}
            onPress={() => setRole("professional")}
          >
            <View style={[styles.roleIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="medkit" size={32 * scale} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleTitle, { fontSize: font.lg * scale }]}>Sou Profissional</Text>
              <Text style={[styles.roleDesc, { fontSize: font.sm * scale }]}>
                Psicólogo(a), terapeuta, fonoaudiólogo(a)
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22 * scale} color={colors.muted} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-to-role" onPress={() => setRole(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24 * scale} color={colors.brandPrimary} />
            <Text style={[styles.backText, { fontSize: font.base * scale }]}>Voltar</Text>
          </Pressable>

          <Text style={[styles.heading, { fontSize: font.xxl * scale }]}>
            {role === "caregiver" ? "Cadastro Cuidador" : "Cadastro Profissional"}
          </Text>

          <Field label="E-mail" scale={scale} testID="reg-email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="voce@exemplo.com"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { fontSize: font.lg * scale }]}
            />
          </Field>
          <Field label="Senha (mínimo 6)" scale={scale} testID="reg-password">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { fontSize: font.lg * scale }]}
            />
          </Field>
          <Field label="Telefone" scale={scale} testID="reg-phone">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="(11) 99999-9999"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { fontSize: font.lg * scale }]}
            />
          </Field>

          {role === "caregiver" ? (
            <>
              <Field label="Nome do cuidador legal" scale={scale} testID="reg-cg-name">
                <TextInput value={caregiverName} onChangeText={setCaregiverName} style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
              </Field>
              <Field label="CPF do cuidador" scale={scale} testID="reg-cg-cpf">
                <TextInput value={caregiverCpf} onChangeText={setCaregiverCpf} keyboardType="numeric" style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
              </Field>
              <Field label="Nome do paciente" scale={scale} testID="reg-p-name">
                <TextInput value={patientName} onChangeText={setPatientName} style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
              </Field>
              <Field label="CPF do paciente" scale={scale} testID="reg-p-cpf">
                <TextInput value={patientCpf} onChangeText={setPatientCpf} keyboardType="numeric" style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Nome completo" scale={scale} testID="reg-pro-name">
                <TextInput value={proName} onChangeText={setProName} style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
              </Field>
              <Field label="CPF" scale={scale} testID="reg-pro-cpf">
                <TextInput value={proCpf} onChangeText={setProCpf} keyboardType="numeric" style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
              </Field>
              <Field label="CRP (formato NN/NNNNNN)" scale={scale} testID="reg-crp">
                <TextInput value={crp} onChangeText={setCrp} placeholder="06/123456" placeholderTextColor={colors.placeholder} style={[styles.input, { fontSize: font.lg * scale }]} />
              </Field>
              <Field label="Especialidade" scale={scale} testID="reg-specialty">
                <TextInput value={specialty} onChangeText={setSpecialty} placeholder="Ex: Psicóloga Infantil - TEA" placeholderTextColor={colors.placeholder} style={[styles.input, { fontSize: font.lg * scale }]} />
              </Field>
              <Field label="Formação acadêmica" scale={scale} testID="reg-formation">
                <TextInput value={formation} onChangeText={setFormation} multiline numberOfLines={3} placeholder="Ex: Doutorado em Psicologia (USP), Especialização em ABA..." placeholderTextColor={colors.placeholder} style={[styles.input, { fontSize: font.base * scale, minHeight: 80, textAlignVertical: "top" }]} />
              </Field>
              <Field label="Endereço do consultório" scale={scale} testID="reg-address">
                <TextInput value={address} onChangeText={setAddress} placeholderTextColor={colors.placeholder} style={[styles.input, { fontSize: font.lg * scale }]} />
              </Field>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Field label="Latitude" scale={scale} testID="reg-lat">
                    <TextInput value={lat} onChangeText={setLat} keyboardType="numeric" style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Longitude" scale={scale} testID="reg-lng">
                    <TextInput value={lng} onChangeText={setLng} keyboardType="numeric" style={[styles.input, { fontSize: font.lg * scale }]} placeholderTextColor={colors.placeholder} />
                  </Field>
                </View>
              </View>
              <Field label="Bio (opcional)" scale={scale} testID="reg-bio">
                <TextInput value={bio} onChangeText={setBio} multiline numberOfLines={3} style={[styles.input, { fontSize: font.lg * scale, minHeight: 80, textAlignVertical: "top" }]} placeholderTextColor={colors.placeholder} />
              </Field>
            </>
          )}

          {error ? <Text testID="reg-error" style={[styles.error, { fontSize: font.sm * scale }]}>{error}</Text> : null}

          <Pressable
            testID="register-submit-button"
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={[styles.primaryBtnText, { fontSize: font.lg * scale }]}>
                {role === "caregiver" ? "Continuar para o AQ" : "Criar conta"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children, scale, testID }: any) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ marginBottom: spacing.md }} testID={testID}>
      <Text style={[styles.label, { fontSize: font.sm * scale }]}>{label}</Text>
      {children}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  rolePicker: { padding: spacing.lg, flexGrow: 1 },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  backText: { color: colors.brandPrimary, marginLeft: spacing.xs },
  heading: { fontWeight: "800", color: colors.onSurface, marginBottom: spacing.xs },
  subheading: { color: colors.muted, marginBottom: spacing.xl },
  logoWrap: { alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  logoImg: { width: 128, height: 128 },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.lg,
    marginBottom: spacing.md,
    ...cardChrome(colors),
  },
  roleIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  roleTitle: { fontWeight: "700", color: colors.onSurface },
  roleDesc: { color: colors.muted, marginTop: 2 },
  formScroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  label: { color: colors.onSurfaceTertiary, marginBottom: spacing.xs, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
  },
  primaryBtn: {
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: colors.onBrandPrimary, fontWeight: "700" },
  error: { color: colors.errorText, marginTop: spacing.sm },
});
