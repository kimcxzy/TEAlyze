"use strict";

const express = require("express");
const { withTransaction } = require("../db");
const { asyncHandler, badRequest, notFound } = require("../errors");
const { hashPassword, verifyPassword } = require("../crypto");
const v = require("../values");
const dt = require("../datetime");
const usersRepository = require("../repositories/users");
const profileRepository = require("../repositories/profile");
const triagemRepository = require("../repositories/triagem");
const laudosRepository = require("../repositories/laudos");
const appointmentsRepository = require("../repositories/appointments");
const audit = require("../audit");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key);
/** Valor enviado, ou o já gravado quando o campo não veio no corpo. */
const pick = (body, key, current, normalize) => (has(body, key) ? normalize(body[key]) : current);

async function buildProfile(idUsuario) {
  const account = await profileRepository.getAccount(idUsuario);
  if (!account) throw notFound("Usuário não encontrado");
  const role = usersRepository.roleFromTipo(account.tipo_usuario);

  let patient = null;
  let aq = null;
  let laudos = [];
  let appointments = [];

  if (role === "caregiver") {
    patient = await profileRepository.getPatient(idUsuario);
    if (patient) aq = await triagemRepository.getLatestAq(patient.id_paciente);
    laudos = await laudosRepository.listForUser(idUsuario, 200);
    appointments = await appointmentsRepository.listForCaregiver(idUsuario);
  } else {
    appointments = await appointmentsRepository.listForProfessional(idUsuario);
  }

  const now = dt.toApi(dt.nowForDb());
  const items = appointments.map((row) => appointmentsRepository.toApi(row));
  const active = items.filter((a) => a.status !== "cancelled");

  const stats = {
    appointments: active.length,
    upcoming_appointments: active.filter((a) => a.scheduled_at >= now).length,
    laudos: laudos.length,
    laudos_valid: laudos.filter((l) => !!l.laudo_valido).length,
  };

  return profileRepository.toApiProfile({ account, patient, aq, stats });
}

// GET /profile — tudo o que o app mostra na aba Perfil, direto do banco
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await buildProfile(Number(req.currentUser.id)));
  })
);

// PUT /profile — atualização parcial: só os campos enviados mudam
router.put(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const idUsuario = Number(req.currentUser.id);
    const role = req.currentUser.role;

    const account = await profileRepository.getAccount(idUsuario);
    if (!account) throw notFound("Usuário não encontrado");

    // --- campos comuns (USUARIO) ---
    const nome = has(body, "name") ? v.clamp(body.name, 150) : account.nome;
    if (!nome) throw badRequest("Informe o nome");
    const telefone = pick(body, "phone", account.telefone, (x) => v.clamp(x, 20));
    const nascimento = has(body, "birthdate")
      ? v.parseDateOnly(body.birthdate, "Data de nascimento")
      : account.data_nascimento || null;

    let responsavel = null;
    let paciente = null;
    let profissional = null;
    let especialidade = null;
    let idPaciente = null;

    if (role === "caregiver") {
      responsavel = {
        grau: has(body, "relationship")
          ? v.clamp(body.relationship, 50) || "Responsável legal"
          : account.grau_parentesco || "Responsável legal",
        profissao: pick(body, "occupation", account.profissao, (x) => v.clamp(x, 100)),
      };

      const current = await profileRepository.getPatient(idUsuario);
      if (current) {
        idPaciente = current.id_paciente;
        const patientName = has(body, "patient_name") ? v.clamp(body.patient_name, 150) : current.nome_social;
        if (!patientName) throw badRequest("Informe o nome do paciente");
        paciente = {
          nome: patientName,
          cpf: has(body, "patient_cpf")
            ? v.optionalCpf(body.patient_cpf, "CPF do paciente")
            : current.cpf || null,
          nivel: has(body, "support_level")
            ? v.intInRange(body.support_level, 1, 3, "Nível de suporte")
            : current.nivel_suporte,
          cid: pick(body, "cid11", current.cid11, (x) => v.clamp(x, 20)),
          dataDiagnostico: has(body, "diagnosis_date")
            ? v.parseDateOnly(body.diagnosis_date, "Data do diagnóstico")
            : current.data_diagnostico || null,
          historico: pick(body, "history", current.historico, (x) => v.clamp(x, 10000)),
          observacoes: pick(body, "notes", current.observacoes, (x) => v.clamp(x, 10000)),
        };
      }
    } else {
      const state = has(body, "state") ? v.trimOrNull(body.state) : account.estado ? String(account.estado).trim() : null;
      if (state && !/^[A-Za-z]{2}$/.test(state)) {
        throw badRequest("Estado inválido: use a sigla com 2 letras (ex.: SP).");
      }
      const zipDigits = has(body, "zip") ? v.digits(body.zip) : account.cep ? String(account.cep).trim() : "";
      if (zipDigits && zipDigits.length !== 8) {
        throw badRequest("CEP inválido: informe os 8 dígitos.");
      }
      const lat = has(body, "latitude") ? v.coordOrNull(body.latitude) : v.toNumberOrNull(account.latitude);
      const lng = has(body, "longitude") ? v.coordOrNull(body.longitude) : v.toNumberOrNull(account.longitude);
      if (lat !== null && Math.abs(lat) > 90) throw badRequest("Latitude inválida (de -90 a 90).");

      profissional = {
        descricao: pick(body, "bio", account.descricao, (x) => v.clamp(x, 5000)),
        formacao: pick(body, "formation", account.formacao, (x) => v.clamp(x, 1000)),
        experiencia: has(body, "experience_years")
          ? v.intInRange(body.experience_years, 0, 80, "Anos de experiência")
          : account.experiencia_tea_anos,
        endereco: pick(body, "address", account.endereco, (x) => v.clamp(x, 200)),
        numero: pick(body, "number", account.numero, (x) => v.clamp(x, 10)),
        bairro: pick(body, "district", account.bairro, (x) => v.clamp(x, 100)),
        cidade: pick(body, "city", account.cidade, (x) => v.clamp(x, 100)),
        estado: state ? state.toUpperCase() : null,
        cep: zipDigits || null,
        latitude: lat,
        longitude: lng,
        teleconsulta: has(body, "teleconsulta") ? !!body.teleconsulta : !!account.atende_teleconsulta,
      };
      if (has(body, "specialty")) especialidade = v.clamp(body.specialty, 100);
    }

    await withTransaction(async (transaction) => {
      await profileRepository.updateUsuario(transaction, idUsuario, { nome, telefone, nascimento });
      if (responsavel) await profileRepository.updateResponsavel(transaction, idUsuario, responsavel);
      if (paciente) await profileRepository.updatePaciente(transaction, idPaciente, paciente);
      if (profissional) await profileRepository.updateProfissional(transaction, idUsuario, profissional);
      if (especialidade) await profileRepository.setPrincipalSpecialty(transaction, idUsuario, especialidade);
    });

    await audit.log(idUsuario, "ATUALIZAR_PERFIL", "USUARIO", idUsuario, "Dados do perfil atualizados");
    res.json(await buildProfile(idUsuario));
  })
);

// POST /profile/password — troca de senha (exige a senha atual)
router.post(
  "/password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const idUsuario = Number(req.currentUser.id);

    const current = typeof body.current_password === "string" ? body.current_password : "";
    if (!current) throw badRequest("Informe a senha atual");
    const novaSenha = v.requirePassword(body.new_password);

    const hash = await profileRepository.getPasswordHash(idUsuario);
    if (!hash || !verifyPassword(current, hash)) throw badRequest("Senha atual incorreta");
    if (novaSenha === current) throw badRequest("A nova senha deve ser diferente da atual");

    await profileRepository.updatePassword(idUsuario, hashPassword(novaSenha));
    await audit.log(idUsuario, "TROCA_SENHA", "USUARIO", idUsuario, "Senha alterada");
    res.json({ ok: true });
  })
);

module.exports = router;
