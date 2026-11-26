"use strict";

// -----------------------------------------------------------------------
// Perfil do usuário (dados pessoais editáveis).
//
// Tudo é gravado no SQL Server, cada dado na tabela a que pertence:
//   USUARIO       nome, telefone, data de nascimento, senha
//   RESPONSAVEL   parentesco, profissão                      (cuidador)
//   PACIENTE      nome, CPF, nível de suporte, CID, histórico... (cuidador)
//   PROFISSIONAL  bio, formação, endereço, coordenadas...    (profissional)
//   PROFISSIONAL_ESPECIALIDADE  especialidade principal
//
// O app NÃO guarda nada disso em cache local: a tela de perfil sempre lê
// daqui e qualquer alteração é gravada aqui.
// -----------------------------------------------------------------------
const { sql, queryOne, query } = require("../db");
const usersRepository = require("./users");
const v = require("../values");
const { toApi } = require("../datetime");

/** Linha do usuário + dados de responsável/profissional (sem o paciente). */
async function getAccount(idUsuario, transaction = null) {
  return queryOne(
    `SELECT u.id_usuario, u.nome, u.email, u.telefone, u.data_nascimento,
            u.tipo_usuario, u.data_cadastro,
            r.cpf AS responsavel_cpf, r.grau_parentesco, r.profissao,
            pro.cpf AS profissional_cpf, pro.registro_profissional, pro.orgao_registro,
            pro.descricao, pro.formacao, pro.experiencia_tea_anos, pro.endereco,
            pro.numero, pro.bairro, pro.cidade, pro.estado, pro.cep,
            pro.latitude, pro.longitude, pro.atende_teleconsulta, pro.crp_verificado,
            esp.nome AS especialidade
     FROM USUARIO u
     LEFT JOIN RESPONSAVEL r ON r.id_responsavel = u.id_usuario
     LEFT JOIN PROFISSIONAL pro ON pro.id_profissional = u.id_usuario
     OUTER APPLY (
         SELECT TOP 1 e.nome
         FROM PROFISSIONAL_ESPECIALIDADE pe
         INNER JOIN ESPECIALIDADE e ON e.id_especialidade = pe.id_especialidade
         WHERE pe.id_profissional = u.id_usuario
         ORDER BY pe.principal DESC, e.nome
     ) esp
     WHERE u.id_usuario = @id`,
    { id: { type: sql.Int, value: idUsuario } },
    transaction
  );
}

/** Paciente (primeiro) vinculado ao cuidador. */
async function getPatient(idResponsavel, transaction = null) {
  return queryOne(
    `SELECT TOP 1 p.id_paciente, p.nome_social, p.cpf, p.nivel_suporte, p.cid11,
            p.data_diagnostico, p.historico, p.observacoes, p.data_cadastro
     FROM PACIENTE p
     WHERE p.id_responsavel = @id
     ORDER BY p.id_paciente`,
    { id: { type: sql.Int, value: idResponsavel } },
    transaction
  );
}

async function getPasswordHash(idUsuario) {
  const row = await queryOne("SELECT senha_hash FROM USUARIO WHERE id_usuario = @id", {
    id: { type: sql.Int, value: idUsuario },
  });
  return row ? row.senha_hash : null;
}

async function updatePassword(idUsuario, senhaHash) {
  await query("UPDATE USUARIO SET senha_hash = @hash WHERE id_usuario = @id", {
    id: { type: sql.Int, value: idUsuario },
    hash: { type: sql.NVarChar(255), value: senhaHash },
  });
}

async function updateUsuario(transaction, idUsuario, { nome, telefone, nascimento }) {
  await query(
    `UPDATE USUARIO
        SET nome = @nome, telefone = @telefone, data_nascimento = @nascimento
      WHERE id_usuario = @id`,
    {
      id: { type: sql.Int, value: idUsuario },
      nome: { type: sql.NVarChar(150), value: nome },
      telefone: { type: sql.VarChar(20), value: telefone },
      nascimento: { type: sql.Date, value: nascimento },
    },
    transaction
  );
}

async function updateResponsavel(transaction, idUsuario, { grau, profissao }) {
  await query(
    `UPDATE RESPONSAVEL
        SET grau_parentesco = @grau, profissao = @profissao
      WHERE id_responsavel = @id`,
    {
      id: { type: sql.Int, value: idUsuario },
      grau: { type: sql.NVarChar(50), value: grau },
      profissao: { type: sql.NVarChar(100), value: profissao },
    },
    transaction
  );
}

async function updatePaciente(transaction, idPaciente, data) {
  await query(
    `UPDATE PACIENTE
        SET nome_social = @nome, cpf = @cpf, nivel_suporte = @nivel, cid11 = @cid,
            data_diagnostico = @data_diag, historico = @historico, observacoes = @obs
      WHERE id_paciente = @id`,
    {
      id: { type: sql.Int, value: idPaciente },
      nome: { type: sql.NVarChar(150), value: data.nome },
      cpf: { type: sql.VarChar(14), value: data.cpf },
      nivel: { type: sql.TinyInt, value: data.nivel },
      cid: { type: sql.NVarChar(20), value: data.cid },
      data_diag: { type: sql.Date, value: data.dataDiagnostico },
      historico: { type: sql.NVarChar(sql.MAX), value: data.historico },
      obs: { type: sql.NVarChar(sql.MAX), value: data.observacoes },
    },
    transaction
  );
}

async function updateProfissional(transaction, idUsuario, data) {
  await query(
    `UPDATE PROFISSIONAL
        SET descricao = @descricao, formacao = @formacao, experiencia_tea_anos = @exp,
            endereco = @endereco, numero = @numero, bairro = @bairro, cidade = @cidade,
            estado = @estado, cep = @cep, latitude = @lat, longitude = @lng,
            atende_teleconsulta = @tele
      WHERE id_profissional = @id`,
    {
      id: { type: sql.Int, value: idUsuario },
      descricao: { type: sql.NVarChar(sql.MAX), value: data.descricao },
      formacao: { type: sql.NVarChar(1000), value: data.formacao },
      exp: { type: sql.TinyInt, value: data.experiencia },
      endereco: { type: sql.NVarChar(200), value: data.endereco },
      numero: { type: sql.VarChar(10), value: data.numero },
      bairro: { type: sql.NVarChar(100), value: data.bairro },
      cidade: { type: sql.NVarChar(100), value: data.cidade },
      estado: { type: sql.Char(2), value: data.estado },
      cep: { type: sql.Char(8), value: data.cep },
      lat: { type: sql.Decimal(9, 6), value: data.latitude },
      lng: { type: sql.Decimal(9, 6), value: data.longitude },
      tele: { type: sql.Bit, value: data.teleconsulta ? 1 : 0 },
    },
    transaction
  );
}

/** Define a especialidade principal do profissional (cria a especialidade se preciso). */
async function setPrincipalSpecialty(transaction, idUsuario, nome) {
  const idEsp = await usersRepository.ensureEspecialidade(transaction, nome);
  if (!idEsp) return;

  const params = {
    id_prof: { type: sql.Int, value: idUsuario },
    id_esp: { type: sql.Int, value: idEsp },
  };
  await query(
    `UPDATE PROFISSIONAL_ESPECIALIDADE SET principal = 0
      WHERE id_profissional = @id_prof AND id_especialidade <> @id_esp`,
    params,
    transaction
  );
  const updated = await query(
    `UPDATE PROFISSIONAL_ESPECIALIDADE SET principal = 1
      WHERE id_profissional = @id_prof AND id_especialidade = @id_esp`,
    params,
    transaction
  );
  const affected = updated && updated.rowsAffected ? updated.rowsAffected[0] : 0;
  if (!affected) {
    await query(
      `INSERT INTO PROFISSIONAL_ESPECIALIDADE (id_profissional, id_especialidade, principal)
       VALUES (@id_prof, @id_esp, 1)`,
      params,
      transaction
    );
  }
}

/** Linhas do banco -> objeto devolvido por GET /profile. */
function toApiProfile({ account, patient, aq, stats }) {
  const role = usersRepository.roleFromTipo(account.tipo_usuario);
  const profile = {
    role,
    account: {
      id: String(account.id_usuario),
      email: account.email,
      name: account.nome,
      phone: account.telefone || "",
      birthdate: v.formatDateOnly(account.data_nascimento),
      created_at: toApi(account.data_cadastro),
    },
    caregiver: null,
    patient: null,
    professional: null,
    aq: aq
      ? { score: aq.score, interpretation: aq.interpretation, submitted_at: aq.submitted_at }
      : null,
    stats,
  };

  if (role === "caregiver") {
    profile.caregiver = {
      cpf: account.responsavel_cpf || null,
      relationship: account.grau_parentesco || "",
      occupation: account.profissao || "",
    };
    if (patient) {
      profile.patient = {
        id: String(patient.id_paciente),
        name: patient.nome_social || "",
        cpf: patient.cpf || null,
        support_level: patient.nivel_suporte === null ? null : Number(patient.nivel_suporte),
        cid11: patient.cid11 || "",
        diagnosis_date: v.formatDateOnly(patient.data_diagnostico),
        history: patient.historico || "",
        notes: patient.observacoes || "",
      };
    }
  } else {
    profile.professional = {
      cpf: account.profissional_cpf || null,
      registry: account.registro_profissional || "",
      registry_body: account.orgao_registro || "",
      verified: !!account.crp_verificado,
      specialty: account.especialidade || "",
      formation: account.formacao || "",
      bio: account.descricao || "",
      experience_years:
        account.experiencia_tea_anos === null || account.experiencia_tea_anos === undefined
          ? null
          : Number(account.experiencia_tea_anos),
      address: account.endereco || "",
      number: account.numero || "",
      district: account.bairro || "",
      city: account.cidade || "",
      state: account.estado ? String(account.estado).trim() : "",
      zip: account.cep ? String(account.cep).trim() : "",
      latitude: v.toNumberOrNull(account.latitude),
      longitude: v.toNumberOrNull(account.longitude),
      teleconsulta: !!account.atende_teleconsulta,
    };
  }
  return profile;
}

module.exports = {
  getAccount,
  getPatient,
  getPasswordHash,
  updatePassword,
  updateUsuario,
  updateResponsavel,
  updatePaciente,
  updateProfissional,
  setPrincipalSpecialty,
  toApiProfile,
};
