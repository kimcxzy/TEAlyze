"use strict";

// -----------------------------------------------------------------------
// USUARIO + RESPONSAVEL + PACIENTE + PROFISSIONAL  ->  "user" do app
//
// O app trabalha com um único objeto de usuário (cuidador ou profissional).
// No banco essa informação está normalizada em várias tabelas. Este módulo
// é o único lugar que conhece esse mapeamento nos dois sentidos.
// -----------------------------------------------------------------------
const { sql, queryOne, queryAll, query } = require("../db");
const { toApi } = require("../datetime");
const { badRequest, notFound } = require("../errors");
const v = require("../values");

const TIPO_CUIDADOR = "CUIDADOR";
const TIPO_PROFISSIONAL = "PROFISSIONAL";

const BASE_SELECT = `
  SELECT u.id_usuario, u.nome, u.email, u.senha_hash, u.telefone, u.tipo_usuario,
         u.ativo, u.data_cadastro,
         r.cpf              AS responsavel_cpf,
         r.grau_parentesco,
         pac.id_paciente,
         pac.nome_social,
         pac.cpf            AS paciente_cpf,
         pro.cpf            AS profissional_cpf,
         pro.registro_profissional,
         pro.orgao_registro,
         pro.descricao,
         pro.endereco,
         pro.latitude,
         pro.longitude,
         pro.crp_verificado,
         pro.formacao,
         pro.atende_teleconsulta,
         esp.nome           AS especialidade
  FROM USUARIO u
  LEFT JOIN RESPONSAVEL r  ON r.id_responsavel  = u.id_usuario
  LEFT JOIN PROFISSIONAL pro ON pro.id_profissional = u.id_usuario
  OUTER APPLY (
      SELECT TOP 1 p.id_paciente, p.nome_social, p.cpf
      FROM PACIENTE p
      WHERE p.id_responsavel = u.id_usuario
      ORDER BY p.id_paciente
  ) pac
  OUTER APPLY (
      SELECT TOP 1 e.nome
      FROM PROFISSIONAL_ESPECIALIDADE pe
      INNER JOIN ESPECIALIDADE e ON e.id_especialidade = pe.id_especialidade
      WHERE pe.id_profissional = u.id_usuario
      ORDER BY pe.principal DESC, e.nome
  ) esp
`;

function roleFromTipo(tipo) {
  return String(tipo || "").toUpperCase() === TIPO_PROFISSIONAL ? "professional" : "caregiver";
}

/**
 * Converte a linha do banco no objeto que as telas já consomem.
 * `senha_hash` e CPFs nunca saem daqui em respostas públicas (ver `toPublic`).
 */
function toUser(row, aq = null) {
  if (!row) return null;
  const role = roleFromTipo(row.tipo_usuario);
  const base = {
    id: String(row.id_usuario),
    role,
    email: row.email,
    phone: row.telefone || "",
    created_at: toApi(row.data_cadastro),
  };

  if (role === "professional") {
    return {
      ...base,
      name: row.nome,
      cpf: row.profissional_cpf || null,
      crp: row.registro_profissional || "",
      crp_verified: !!row.crp_verificado,
      specialty: row.especialidade || "",
      formation: row.formacao || "",
      bio: row.descricao || "",
      latitude: v.toNumberOrNull(row.latitude),
      longitude: v.toNumberOrNull(row.longitude),
      address: row.endereco || "",
      teleconsulta: !!row.atende_teleconsulta,
    };
  }

  return {
    ...base,
    caregiver_name: row.nome,
    caregiver_cpf: row.responsavel_cpf || null,
    patient_id: row.id_paciente ? String(row.id_paciente) : null,
    patient_name: row.nome_social || "",
    patient_cpf: row.paciente_cpf || null,
    aq_score: aq ? aq.score : null,
    aq_answers: aq ? aq.answers : null,
    aq_submitted_at: aq ? aq.submitted_at : null,
  };
}

/** Remove dados sensíveis antes de devolver um usuário que não é o logado. */
function toPublic(user) {
  if (!user) return null;
  const { cpf, caregiver_cpf, patient_cpf, ...rest } = user;
  return rest;
}

async function findRowById(id, transaction = null) {
  return queryOne(`${BASE_SELECT} WHERE u.id_usuario = @id`, { id: { type: sql.Int, value: id } }, transaction);
}

async function findRowByEmail(email, transaction = null) {
  return queryOne(
    `${BASE_SELECT} WHERE LOWER(u.email) = @email`,
    { email: { type: sql.NVarChar(150), value: String(email).toLowerCase() } },
    transaction
  );
}

async function emailExists(email, transaction = null) {
  const row = await queryOne(
    "SELECT TOP 1 id_usuario FROM USUARIO WHERE LOWER(email) = @email",
    { email: { type: sql.NVarChar(150), value: String(email).toLowerCase() } },
    transaction
  );
  return !!row;
}

async function cpfExists(table, column, cpf, transaction = null) {
  const allowed = { RESPONSAVEL: "cpf", PROFISSIONAL: "cpf" };
  if (!allowed[table]) throw new Error("Tabela inválida para checagem de CPF");
  const row = await queryOne(
    `SELECT TOP 1 1 AS found FROM ${table} WHERE ${allowed[table]} = @cpf`,
    { cpf: { type: sql.Char(11), value: cpf } },
    transaction
  );
  return !!row;
}

/** Lista de profissionais ativos (mapa / busca / chat). */
async function listProfessionals() {
  const rows = await queryAll(
    `${BASE_SELECT}
     WHERE u.tipo_usuario = @tipo AND u.ativo = 1 AND pro.ativo = 1
     ORDER BY u.nome`,
    { tipo: { type: sql.VarChar(30), value: TIPO_PROFISSIONAL } }
  );
  return rows.map((r) => toPublic(toUser(r)));
}

async function findProfessionalPublic(id) {
  const row = await findRowById(id);
  if (!row || roleFromTipo(row.tipo_usuario) !== "professional") {
    throw notFound("Profissional não encontrado");
  }
  return toPublic(toUser(row));
}

async function countProfessionals() {
  const row = await queryOne(
    "SELECT COUNT(*) AS total FROM USUARIO WHERE tipo_usuario = @tipo",
    { tipo: { type: sql.VarChar(30), value: TIPO_PROFISSIONAL } }
  );
  return row ? Number(row.total) : 0;
}

/** id_paciente do cuidador logado (usado por agenda e laudos). */
async function getPacienteIdForResponsavel(idResponsavel, transaction = null) {
  const row = await queryOne(
    `SELECT TOP 1 id_paciente FROM PACIENTE WHERE id_responsavel = @id ORDER BY id_paciente`,
    { id: { type: sql.Int, value: idResponsavel } },
    transaction
  );
  return row ? row.id_paciente : null;
}

async function insertUsuario(transaction, { nome, email, senhaHash, telefone, tipo }) {
  const row = await queryOne(
    `INSERT INTO USUARIO (nome, email, senha_hash, telefone, tipo_usuario, ativo)
     OUTPUT INSERTED.id_usuario
     VALUES (@nome, @email, @senha, @telefone, @tipo, 1)`,
    {
      nome: { type: sql.NVarChar(150), value: nome },
      email: { type: sql.NVarChar(150), value: email },
      senha: { type: sql.NVarChar(255), value: senhaHash },
      telefone: { type: sql.VarChar(20), value: telefone },
      tipo: { type: sql.VarChar(30), value: tipo },
    },
    transaction
  );
  return row.id_usuario;
}

/** Cadastro de cuidador: USUARIO + RESPONSAVEL + PACIENTE. */
async function createCaregiver(transaction, data) {
  const email = v.requireEmail(data.email);
  const nome = v.clamp(data.caregiver_name, 150);
  if (!nome) throw badRequest("Informe o nome do responsável");
  const patientName = v.clamp(data.patient_name, 150);
  if (!patientName) throw badRequest("Informe o nome do paciente");
  const cpfResponsavel = v.requireCpf(data.caregiver_cpf, "CPF do responsável");
  const patientCpf = v.optionalCpf(data.patient_cpf, "CPF do paciente");

  if (await emailExists(email, transaction)) throw badRequest("Email já cadastrado");
  if (await cpfExists("RESPONSAVEL", "cpf", cpfResponsavel, transaction)) {
    throw badRequest("CPF do responsável já cadastrado");
  }

  const idUsuario = await insertUsuario(transaction, {
    nome,
    email,
    senhaHash: data.senhaHash,
    telefone: v.clamp(data.phone, 20),
    tipo: TIPO_CUIDADOR,
  });

  await query(
    `INSERT INTO RESPONSAVEL (id_responsavel, cpf, grau_parentesco, profissao)
     VALUES (@id, @cpf, @grau, @profissao)`,
    {
      id: { type: sql.Int, value: idUsuario },
      cpf: { type: sql.Char(11), value: cpfResponsavel },
      grau: { type: sql.NVarChar(50), value: v.clamp(data.grau_parentesco, 50) || "Responsável legal" },
      profissao: { type: sql.NVarChar(100), value: v.clamp(data.profissao, 100) },
    },
    transaction
  );

  const paciente = await queryOne(
    `INSERT INTO PACIENTE (id_responsavel, nome_social, cpf, observacoes)
     OUTPUT INSERTED.id_paciente
     VALUES (@id_responsavel, @nome_social, @cpf, @observacoes)`,
    {
      id_responsavel: { type: sql.Int, value: idUsuario },
      nome_social: { type: sql.NVarChar(150), value: patientName },
      cpf: { type: sql.VarChar(14), value: patientCpf },
      observacoes: { type: sql.NVarChar(sql.MAX), value: null },
    },
    transaction
  );

  return { idUsuario, idPaciente: paciente.id_paciente };
}

/** Garante a especialidade em ESPECIALIDADE e devolve o id. */
async function ensureEspecialidade(transaction, nome) {
  const clean = v.clamp(nome, 100);
  if (!clean) return null;
  const existing = await queryOne(
    "SELECT TOP 1 id_especialidade FROM ESPECIALIDADE WHERE LOWER(nome) = @nome",
    { nome: { type: sql.NVarChar(100), value: clean.toLowerCase() } },
    transaction
  );
  if (existing) return existing.id_especialidade;

  const inserted = await queryOne(
    `INSERT INTO ESPECIALIDADE (nome, descricao)
     OUTPUT INSERTED.id_especialidade
     VALUES (@nome, @descricao)`,
    {
      nome: { type: sql.NVarChar(100), value: clean },
      descricao: { type: sql.NVarChar(500), value: `Especialidade cadastrada pelo app: ${clean}` },
    },
    transaction
  );
  return inserted.id_especialidade;
}

function validateCrp(crp) {
  return /^\d{2}\/\d{4,6}$/.test(String(crp || "").trim());
}

/** Cadastro de profissional: USUARIO + PROFISSIONAL + especialidade principal. */
async function createProfessional(transaction, data) {
  const email = v.requireEmail(data.email);
  const nome = v.clamp(data.name, 150);
  if (!nome) throw badRequest("Informe o nome do profissional");
  if (!validateCrp(data.crp)) throw badRequest("CRP inválido. Formato esperado: NN/NNNNNN");
  const cpf = v.requireCpf(data.cpf, "CPF do profissional");

  if (await emailExists(email, transaction)) throw badRequest("Email já cadastrado");
  if (await cpfExists("PROFISSIONAL", "cpf", cpf, transaction)) {
    throw badRequest("CPF do profissional já cadastrado");
  }

  const idUsuario = await insertUsuario(transaction, {
    nome,
    email,
    senhaHash: data.senhaHash,
    telefone: v.clamp(data.phone, 20),
    tipo: TIPO_PROFISSIONAL,
  });

  await query(
    `INSERT INTO PROFISSIONAL (
        id_profissional, cpf, registro_profissional, orgao_registro, descricao,
        endereco, latitude, longitude, atende_teleconsulta, ativo,
        crp_verificado, formacao
     ) VALUES (
        @id, @cpf, @crp, @orgao, @descricao,
        @endereco, @latitude, @longitude, @teleconsulta, 1,
        @crp_verificado, @formacao
     )`,
    {
      id: { type: sql.Int, value: idUsuario },
      cpf: { type: sql.Char(11), value: cpf },
      crp: { type: sql.NVarChar(50), value: v.clamp(data.crp, 50) },
      orgao: { type: sql.NVarChar(100), value: v.clamp(data.orgao_registro, 100) || "CRP" },
      descricao: { type: sql.NVarChar(sql.MAX), value: v.trimOrNull(data.bio) },
      endereco: { type: sql.NVarChar(200), value: v.clamp(data.address, 200) },
      latitude: { type: sql.Decimal(9, 6), value: v.coordOrNull(data.latitude) },
      longitude: { type: sql.Decimal(9, 6), value: v.coordOrNull(data.longitude) },
      teleconsulta: { type: sql.Bit, value: data.teleconsulta ? 1 : 0 },
      // Validação de CRP é MOCK (regex), igual à versão anterior do app.
      crp_verificado: { type: sql.Bit, value: 1 },
      formacao: { type: sql.NVarChar(1000), value: v.clamp(data.formation, 1000) },
    },
    transaction
  );

  const idEspecialidade = await ensureEspecialidade(transaction, data.specialty);
  if (idEspecialidade) {
    await query(
      `INSERT INTO PROFISSIONAL_ESPECIALIDADE (id_profissional, id_especialidade, principal)
       VALUES (@id_prof, @id_esp, 1)`,
      {
        id_prof: { type: sql.Int, value: idUsuario },
        id_esp: { type: sql.Int, value: idEspecialidade },
      },
      transaction
    );
  }

  return { idUsuario };
}

module.exports = {
  TIPO_CUIDADOR,
  TIPO_PROFISSIONAL,
  roleFromTipo,
  toUser,
  toPublic,
  findRowById,
  findRowByEmail,
  emailExists,
  listProfessionals,
  findProfessionalPublic,
  countProfessionals,
  getPacienteIdForResponsavel,
  createCaregiver,
  createProfessional,
  ensureEspecialidade,
  validateCrp,
};
