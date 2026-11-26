import { useEffect, useMemo, useState } from "react";
import { View, Text, Switch, StyleSheet } from "react-native";

import { apiFetch, useAuth } from "@/src/auth";
import { useSettings } from "@/src/settings";
import { spacing, font, type Palette } from "@/src/theme";
import { useThemedColors } from "@/src/hooks/use-themed-colors";
import { hideCpf, isoToBr, maskCep, maskCpf, maskDate } from "@/src/utils/format";
import { Card, FormField, PrimaryButton, SectionTitle, Segmented, StatusMessage } from "./ui";
import type { ProfileData } from "./types";

type Form = Record<string, string>;

const RELATIONSHIPS = ["Mãe", "Pai", "Avó/Avô", "Tio/Tia", "Responsável legal"];

/** Perfil -> valores dos campos de texto (tudo string, como o TextInput trabalha). */
function toForm(p: ProfileData): Form {
  const base: Form = {
    name: p.account.name || "",
    phone: p.account.phone || "",
    birthdate: isoToBr(p.account.birthdate),
  };
  if (p.caregiver) {
    Object.assign(base, {
      relationship: p.caregiver.relationship || "",
      occupation: p.caregiver.occupation || "",
      patient_name: p.patient?.name || "",
      patient_cpf: maskCpf(p.patient?.cpf || ""),
      support_level: p.patient?.support_level ? String(p.patient.support_level) : "",
      cid11: p.patient?.cid11 || "",
      diagnosis_date: isoToBr(p.patient?.diagnosis_date),
      history: p.patient?.history || "",
      notes: p.patient?.notes || "",
    });
  }
  if (p.professional) {
    const pro = p.professional;
    Object.assign(base, {
      specialty: pro.specialty || "",
      formation: pro.formation || "",
      bio: pro.bio || "",
      experience_years: pro.experience_years === null ? "" : String(pro.experience_years),
      address: pro.address || "",
      number: pro.number || "",
      district: pro.district || "",
      city: pro.city || "",
      state: pro.state || "",
      zip: maskCep(pro.zip || ""),
      latitude: pro.latitude === null ? "" : String(pro.latitude),
      longitude: pro.longitude === null ? "" : String(pro.longitude),
      teleconsulta: pro.teleconsulta ? "1" : "",
    });
  }
  return base;
}

/**
 * Dados pessoais — tudo editável vem e vai para o SQL Server (GET/PUT /profile).
 * E-mail, CPF e registro profissional ficam somente leitura (identificam a conta).
 */
export function PersonalSection({
  profile,
  onSaved,
}: {
  profile: ProfileData;
  onSaved: (p: ProfileData) => void;
}) {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token, refresh } = useAuth();
  const { scale } = useSettings();

  const initial = useMemo(() => toForm(profile), [profile]);
  const [form, setForm] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Quando o servidor devolve o perfil salvo, o formulário passa a refletir exatamente o que está no banco.
  useEffect(() => setForm(initial), [initial]);

  const dirty = useMemo(() => Object.keys(initial).some((k) => (form[k] ?? "") !== (initial[k] ?? "")), [form, initial]);
  const set = (key: string) => (value: string) => {
    setMessage(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (profile.role === "professional") payload.teleconsulta = form.teleconsulta === "1";
      if (profile.role === "caregiver") {
        payload.support_level = form.support_level === "" ? null : Number(form.support_level);
      }
      const saved: ProfileData = await apiFetch("/profile", token, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onSaved(saved);
      await refresh(); // atualiza o nome mostrado no resto do app
      setMessage({ kind: "success", text: "Dados salvos com sucesso." });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  };

  const isCaregiver = profile.role === "caregiver";

  return (
    <View>
      <SectionTitle>Informações pessoais</SectionTitle>
      <Card>
        <FormField label="Nome completo" value={form.name} onChangeText={set("name")} testID="profile-name" />
        <FormField
          label="E-mail"
          value={profile.account.email}
          editable={false}
          readOnlyNote="O e-mail é o seu login e não pode ser alterado aqui."
        />
        <FormField
          label="Telefone"
          value={form.phone}
          onChangeText={set("phone")}
          keyboardType="phone-pad"
          placeholder="(11) 90000-0000"
          testID="profile-phone"
        />
        <FormField
          label="Data de nascimento"
          value={form.birthdate}
          onChangeText={(v) => set("birthdate")(maskDate(v))}
          keyboardType="number-pad"
          placeholder="DD/MM/AAAA"
          testID="profile-birthdate"
        />
        {isCaregiver ? (
          <>
            <FormField
              label="CPF do responsável"
              value={hideCpf(profile.caregiver?.cpf)}
              editable={false}
              readOnlyNote="Documento de identificação da conta."
            />
            <Text style={[styles.groupLabel, { fontSize: font.sm * scale }]}>Parentesco</Text>
            <View style={styles.chips}>
              <Segmented
                options={(RELATIONSHIPS.includes(form.relationship) || !form.relationship
                  ? RELATIONSHIPS
                  : [form.relationship, ...RELATIONSHIPS]
                ).map((r) => ({ value: r, label: r }))}
                value={form.relationship}
                onChange={set("relationship")}
                testIDPrefix="relationship"
              />
            </View>
            <FormField label="Profissão" value={form.occupation} onChangeText={set("occupation")} />
          </>
        ) : (
          <FormField
            label="CPF"
            value={hideCpf(profile.professional?.cpf)}
            editable={false}
            readOnlyNote="Documento de identificação da conta."
          />
        )}
      </Card>

      {isCaregiver ? (
        <>
          <SectionTitle>Paciente</SectionTitle>
          {profile.patient ? (
            <Card>
              <FormField label="Nome do paciente" value={form.patient_name} onChangeText={set("patient_name")} testID="profile-patient-name" />
              <FormField
                label="CPF do paciente (opcional)"
                value={form.patient_cpf}
                onChangeText={(v) => set("patient_cpf")(maskCpf(v))}
                keyboardType="number-pad"
                placeholder="000.000.000-00"
              />
              <Text style={[styles.groupLabel, { fontSize: font.sm * scale }]}>Nível de suporte</Text>
              <View style={styles.chips}>
                <Segmented
                  options={[
                    { value: "", label: "Não informado" },
                    { value: "1", label: "Nível 1" },
                    { value: "2", label: "Nível 2" },
                    { value: "3", label: "Nível 3" },
                  ]}
                  value={form.support_level}
                  onChange={set("support_level")}
                  testIDPrefix="support"
                />
              </View>
              <FormField label="CID-11" value={form.cid11} onChangeText={set("cid11")} placeholder="Ex.: 6A02" autoCapitalize="characters" />
              <FormField
                label="Data do diagnóstico"
                value={form.diagnosis_date}
                onChangeText={(v) => set("diagnosis_date")(maskDate(v))}
                keyboardType="number-pad"
                placeholder="DD/MM/AAAA"
              />
              <FormField label="Histórico" value={form.history} onChangeText={set("history")} multiline placeholder="Histórico clínico e de desenvolvimento" />
              <FormField label="Observações" value={form.notes} onChangeText={set("notes")} multiline placeholder="Preferências, sensibilidades, rotina..." />
            </Card>
          ) : (
            <Card>
              <Text style={{ color: colors.muted, fontSize: font.base * scale }}>
                Nenhum paciente vinculado a esta conta.
              </Text>
            </Card>
          )}
        </>
      ) : (
        <>
          <SectionTitle>Dados profissionais</SectionTitle>
          <Card>
            <FormField
              label={`Registro (${profile.professional?.registry_body || "CRP"})`}
              value={`${profile.professional?.registry || ""}${profile.professional?.verified ? " · Verificado" : ""}`}
              editable={false}
              readOnlyNote="O registro é validado pela plataforma."
            />
            <FormField label="Especialidade" value={form.specialty} onChangeText={set("specialty")} placeholder="Ex.: Psicologia" />
            <FormField label="Formação" value={form.formation} onChangeText={set("formation")} multiline />
            <FormField label="Sobre você" value={form.bio} onChangeText={set("bio")} multiline placeholder="Apresentação mostrada aos cuidadores" />
            <FormField
              label="Anos de experiência com TEA"
              value={form.experience_years}
              onChangeText={(v) => set("experience_years")(v.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
            />
            <View style={styles.rowBetween}>
              <Text style={[styles.groupLabelInline, { fontSize: font.base * scale }]}>Atende por teleconsulta</Text>
              <Switch
                testID="profile-teleconsulta"
                value={form.teleconsulta === "1"}
                onValueChange={(v) => set("teleconsulta")(v ? "1" : "")}
                trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
                thumbColor={colors.surfaceSecondary}
              />
            </View>
          </Card>

          <SectionTitle>Local de atendimento</SectionTitle>
          <Card>
            <FormField label="Endereço" value={form.address} onChangeText={set("address")} />
            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}>
                <FormField label="Número" value={form.number} onChangeText={set("number")} />
              </View>
              <View style={{ flex: 2 }}>
                <FormField label="Bairro" value={form.district} onChangeText={set("district")} />
              </View>
            </View>
            <View style={styles.twoCols}>
              <View style={{ flex: 2 }}>
                <FormField label="Cidade" value={form.city} onChangeText={set("city")} />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="UF" value={form.state} onChangeText={(v) => set("state")(v.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase())} autoCapitalize="characters" />
              </View>
            </View>
            <FormField label="CEP" value={form.zip} onChangeText={(v) => set("zip")(maskCep(v))} keyboardType="number-pad" placeholder="00000-000" />
            <View style={styles.twoCols}>
              <View style={{ flex: 1 }}>
                <FormField label="Latitude" value={form.latitude} onChangeText={set("latitude")} keyboardType="numbers-and-punctuation" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Longitude" value={form.longitude} onChangeText={set("longitude")} keyboardType="numbers-and-punctuation" />
              </View>
            </View>
            <Text style={[styles.note, { fontSize: font.sm * scale }]}>
              A latitude e a longitude definem onde você aparece no mapa.
            </Text>
          </Card>
        </>
      )}

      {message ? <StatusMessage kind={message.kind} text={message.text} /> : null}
      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton
          testID="profile-save"
          label={dirty ? "Salvar alterações" : "Tudo salvo"}
          icon={dirty ? "save" : "checkmark"}
          onPress={save}
          loading={saving}
          disabled={!dirty}
        />
      </View>

      <PasswordCard />
    </View>
  );
}

/** Troca de senha (exige a senha atual). */
function PasswordCard() {
  const colors = useThemedColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { token } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const submit = async () => {
    setMessage(null);
    if (next.length < 6) return setMessage({ kind: "error", text: "A nova senha precisa ter pelo menos 6 caracteres." });
    if (next !== confirm) return setMessage({ kind: "error", text: "A confirmação não é igual à nova senha." });
    setBusy(true);
    try {
      await apiFetch("/profile/password", token, {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ kind: "success", text: "Senha alterada com sucesso." });
    } catch (e: any) {
      setMessage({ kind: "error", text: e?.message || "Não foi possível alterar a senha." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <SectionTitle>Segurança</SectionTitle>
      <Card>
        <FormField label="Senha atual" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" testID="password-current" />
        <FormField label="Nova senha" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" testID="password-new" />
        <FormField label="Confirmar nova senha" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" testID="password-confirm" />
        {message ? <StatusMessage kind={message.kind} text={message.text} /> : null}
        <View style={styles.pwButton}>
          <PrimaryButton
            testID="password-save"
            label="Alterar senha"
            icon="lock-closed"
            onPress={submit}
            loading={busy}
            disabled={!current || !next || !confirm}
          />
        </View>
      </Card>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    groupLabel: { color: colors.onSurfaceSecondary, fontWeight: "600", marginBottom: 6 },
    groupLabelInline: { color: colors.onSurface, fontWeight: "600", flex: 1 },
    chips: { marginBottom: spacing.md },
    twoCols: { flexDirection: "row", gap: spacing.md },
    rowBetween: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    note: { color: colors.muted },
    pwButton: { marginTop: spacing.md },
  });
