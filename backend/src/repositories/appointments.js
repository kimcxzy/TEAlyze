"use strict";

// -----------------------------------------------------------------------
// Agenda do app  ->  tabela SESSAO
//
// status no app  <->  status no banco
//   scheduled     <->  AGENDADA
//   confirmed     <->  CONFIRMADA
//   cancelled     <->  CANCELADA
// -----------------------------------------------------------------------
const { sql, queryOne, queryAll, query } = require("../db");
const dt = require("../datetime");

const STATUS_TO_DB = { scheduled: "AGENDADA", confirmed: "CONFIRMADA", cancelled: "CANCELADA" };
const STATUS_TO_APP = { AGENDADA: "scheduled", CONFIRMADA: "confirmed", CANCELADA: "cancelled" };

function statusToApp(value) {
  return STATUS_TO_APP[String(value || "").toUpperCase()] || "scheduled";
}

const BASE_SELECT = `
  SELECT s.id_sessao, s.id_profissional, s.data_hora_inicio, s.data_hora_fim,
         s.tipo_sessao, s.status, s.observacoes, s.local_atendimento, s.data_cadastro,
         p.id_paciente, p.nome_social AS patient_name, p.id_responsavel,
         uc.nome AS caregiver_name,
         up.nome AS professional_name,
         esp.nome AS especialidade
  FROM SESSAO s
  INNER JOIN PACIENTE p ON p.id_paciente = s.id_paciente
  LEFT JOIN USUARIO uc ON uc.id_usuario = p.id_responsavel
  INNER JOIN USUARIO up ON up.id_usuario = s.id_profissional
  OUTER APPLY (
      SELECT TOP 1 e.nome
      FROM PROFISSIONAL_ESPECIALIDADE pe
      INNER JOIN ESPECIALIDADE e ON e.id_especialidade = pe.id_especialidade
      WHERE pe.id_profissional = s.id_profissional
      ORDER BY pe.principal DESC, e.nome
  ) esp
`;

/** Linha de SESSAO -> objeto que a tela de agenda já consome. */
function toApi(row) {
  if (!row) return null;
  return {
    id: String(row.id_sessao),
    caregiver_id: row.id_responsavel === null ? null : String(row.id_responsavel),
    caregiver_name: row.caregiver_name || "",
    patient_name: row.patient_name || "",
    professional_id: String(row.id_profissional),
    professional_name: row.professional_name || "",
    specialty: row.especialidade || "",
    scheduled_at: dt.toApi(row.data_hora_inicio),
    duration_min: dt.diffMinutes(row.data_hora_inicio, row.data_hora_fim) || 60,
    location: row.local_atendimento || "",
    notes: row.observacoes || "",
    status: statusToApp(row.status),
    created_at: dt.toApi(row.data_cadastro),
  };
}

async function insert({ idPaciente, idProfissional, inicio, fim, local, notes }) {
  const row = await queryOne(
    `INSERT INTO SESSAO (
        id_paciente, id_profissional, data_hora_inicio, data_hora_fim,
        tipo_sessao, status, observacoes, local_atendimento
     )
     OUTPUT INSERTED.id_sessao
     VALUES (@id_paciente, @id_prof, @inicio, @fim, @tipo, @status, @obs, @local)`,
    {
      id_paciente: { type: sql.Int, value: idPaciente },
      id_prof: { type: sql.Int, value: idProfissional },
      inicio: { type: sql.DateTime2, value: inicio },
      fim: { type: sql.DateTime2, value: fim },
      tipo: { type: sql.VarChar(30), value: "CONSULTA" },
      status: { type: sql.VarChar(30), value: STATUS_TO_DB.scheduled },
      obs: { type: sql.NVarChar(sql.MAX), value: notes || null },
      local: { type: sql.NVarChar(300), value: local || null },
    }
  );
  return row.id_sessao;
}

async function findById(id) {
  return queryOne(`${BASE_SELECT} WHERE s.id_sessao = @id`, { id: { type: sql.Int, value: id } });
}

async function listForCaregiver(idResponsavel) {
  return queryAll(
    `${BASE_SELECT} WHERE p.id_responsavel = @id ORDER BY s.data_hora_inicio ASC`,
    { id: { type: sql.Int, value: idResponsavel } }
  );
}

async function listForProfessional(idProfissional) {
  return queryAll(
    `${BASE_SELECT} WHERE s.id_profissional = @id ORDER BY s.data_hora_inicio ASC`,
    { id: { type: sql.Int, value: idProfissional } }
  );
}

async function nextUpcomingForCaregiver(idResponsavel, now) {
  return queryOne(
    `SELECT TOP 1 * FROM (${BASE_SELECT}
        WHERE p.id_responsavel = @id
          AND s.status <> @cancelada
          AND s.data_hora_inicio >= @now
     ) q ORDER BY q.data_hora_inicio ASC`,
    {
      id: { type: sql.Int, value: idResponsavel },
      cancelada: { type: sql.VarChar(30), value: STATUS_TO_DB.cancelled },
      now: { type: sql.DateTime2, value: now },
    }
  );
}

async function nextUpcomingForProfessional(idProfissional, now) {
  return queryOne(
    `SELECT TOP 1 * FROM (${BASE_SELECT}
        WHERE s.id_profissional = @id
          AND s.status <> @cancelada
          AND s.data_hora_inicio >= @now
     ) q ORDER BY q.data_hora_inicio ASC`,
    {
      id: { type: sql.Int, value: idProfissional },
      cancelada: { type: sql.VarChar(30), value: STATUS_TO_DB.cancelled },
      now: { type: sql.DateTime2, value: now },
    }
  );
}

async function updateStatus(id, appStatus) {
  await query("UPDATE SESSAO SET status = @status WHERE id_sessao = @id", {
    id: { type: sql.Int, value: id },
    status: { type: sql.VarChar(30), value: STATUS_TO_DB[appStatus] || STATUS_TO_DB.scheduled },
  });
}

/** Evita dois agendamentos no mesmo horário para o mesmo profissional. */
async function hasConflict(idProfissional, inicio, fim) {
  const row = await queryOne(
    `SELECT TOP 1 id_sessao
     FROM SESSAO
     WHERE id_profissional = @id
       AND status <> @cancelada
       AND data_hora_inicio < @fim
       AND ISNULL(data_hora_fim, DATEADD(MINUTE, 60, data_hora_inicio)) > @inicio`,
    {
      id: { type: sql.Int, value: idProfissional },
      cancelada: { type: sql.VarChar(30), value: STATUS_TO_DB.cancelled },
      inicio: { type: sql.DateTime2, value: inicio },
      fim: { type: sql.DateTime2, value: fim },
    }
  );
  return !!row;
}

/**
 * O profissional atende (ou vai atender) esta família? Existe ao menos uma
 * consulta não cancelada entre ele e algum paciente do cuidador.
 */
async function hasActiveRelation(idProfissional, idResponsavel) {
  const row = await queryOne(
    `SELECT TOP 1 s.id_sessao
     FROM SESSAO s
     INNER JOIN PACIENTE p ON p.id_paciente = s.id_paciente
     WHERE s.id_profissional = @prof AND p.id_responsavel = @resp AND s.status <> 'CANCELADA'`,
    {
      prof: { type: sql.Int, value: idProfissional },
      resp: { type: sql.Int, value: idResponsavel },
    }
  );
  return !!row;
}

module.exports = {
  hasActiveRelation,
  STATUS_TO_DB,
  statusToApp,
  toApi,
  insert,
  findById,
  listForCaregiver,
  listForProfessional,
  nextUpcomingForCaregiver,
  nextUpcomingForProfessional,
  updateStatus,
  hasConflict,
};
