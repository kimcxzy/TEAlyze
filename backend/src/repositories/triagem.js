"use strict";

// -----------------------------------------------------------------------
// Questionário AQ-50 -> TRIAGEM + RESPOSTA_TRIAGEM
//
// Cada envio do AQ vira uma TRIAGEM (tipo_questionario = 'AQ50') com a
// pontuação e o nível de urgência, e 50 linhas em RESPOSTA_TRIAGEM.
// -----------------------------------------------------------------------
const { sql, queryOne, queryAll, query } = require("../db");
const { toApi } = require("../datetime");

const TIPO_AQ = "AQ50";

function urgencyFromScore(score) {
  if (score >= 32) return "ALTA";
  if (score >= 26) return "MEDIA";
  return "BAIXA";
}

/** Última triagem AQ do paciente, com as respostas. */
async function getLatestAq(idPaciente) {
  if (!idPaciente) return null;
  const triagem = await queryOne(
    `SELECT TOP 1 id_triagem, pontuacao, nivel_urgencia, resultado, data_triagem
     FROM TRIAGEM
     WHERE id_paciente = @id AND tipo_questionario = @tipo
     ORDER BY data_triagem DESC, id_triagem DESC`,
    {
      id: { type: sql.Int, value: idPaciente },
      tipo: { type: sql.VarChar(30), value: TIPO_AQ },
    }
  );
  if (!triagem) return null;

  const rows = await queryAll(
    `SELECT numero_questao, resposta
     FROM RESPOSTA_TRIAGEM
     WHERE id_triagem = @id
     ORDER BY numero_questao`,
    { id: { type: sql.Int, value: triagem.id_triagem } }
  );

  const answers = rows.length
    ? rows.map((r) => {
        const n = Number.parseInt(r.resposta, 10);
        return Number.isFinite(n) ? n : null;
      })
    : null;

  return {
    id: String(triagem.id_triagem),
    score: triagem.pontuacao === null ? null : Number(triagem.pontuacao),
    urgency: triagem.nivel_urgencia,
    interpretation: triagem.resultado,
    answers,
    submitted_at: toApi(triagem.data_triagem),
  };
}

/** Grava uma nova triagem AQ e suas 50 respostas (em transação). */
async function saveAq(transaction, { idPaciente, answers, score, interpretation }) {
  const triagem = await queryOne(
    `INSERT INTO TRIAGEM (id_paciente, tipo_questionario, pontuacao, nivel_urgencia, resultado)
     OUTPUT INSERTED.id_triagem
     VALUES (@id_paciente, @tipo, @pontuacao, @urgencia, @resultado)`,
    {
      id_paciente: { type: sql.Int, value: idPaciente },
      tipo: { type: sql.VarChar(30), value: TIPO_AQ },
      pontuacao: { type: sql.Decimal(5, 2), value: score },
      urgencia: { type: sql.VarChar(20), value: urgencyFromScore(score) },
      resultado: { type: sql.NVarChar(500), value: String(interpretation).slice(0, 500) },
    },
    transaction
  );

  const idTriagem = triagem.id_triagem;

  // Um único INSERT parametrizado com as 50 respostas.
  const valueClauses = [];
  const params = { id_triagem: { type: sql.Int, value: idTriagem } };
  answers.forEach((answer, index) => {
    const key = `r${index}`;
    valueClauses.push(`(@id_triagem, ${index + 1}, @${key})`);
    params[key] = { type: sql.NVarChar(500), value: String(answer) };
  });

  await query(
    `INSERT INTO RESPOSTA_TRIAGEM (id_triagem, numero_questao, resposta)
     VALUES ${valueClauses.join(", ")}`,
    params,
    transaction
  );

  return idTriagem;
}

module.exports = { TIPO_AQ, getLatestAq, saveAq, urgencyFromScore };
