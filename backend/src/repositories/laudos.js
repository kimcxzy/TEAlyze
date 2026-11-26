"use strict";

// -----------------------------------------------------------------------
// Laudos  ->  LAUDO (do schema original) + LAUDO_ANALISE_IA (extensão)
//
// LAUDO guarda o documento em si (arquivo, hash, texto do OCR, consentimento)
// e LAUDO_ANALISE_IA guarda o resultado estruturado da análise/checagem
// de fraude, que o app exibe na tela de laudo.
// -----------------------------------------------------------------------
const { sql, queryOne, queryAll, query } = require("../db");
const dt = require("../datetime");

const BASE_SELECT = `
  SELECT l.id_laudo, l.id_paciente, l.id_usuario_upload, l.nome_arquivo,
         l.caminho_arquivo, l.tipo_documento, l.data_upload, l.texto_ocr,
         l.hash_arquivo, l.consentimento_upload, l.mime_type, l.explicacao_cuidador,
         a.laudo_valido, a.confianca, a.nome_paciente, a.cpf_paciente,
         a.nascimento_paciente, a.diagnostico, a.cid, a.nome_profissional,
         a.registro_profissional, a.instituicao, a.endereco_instituicao,
         a.data_emissao, a.possui_assinatura, a.indicadores_fraude,
         a.alertas, a.checagem_cruzada, a.data_analise, a.lido_por_ia
  FROM LAUDO l
  LEFT JOIN LAUDO_ANALISE_IA a ON a.id_laudo = l.id_laudo
`;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Grava o laudo e sua análise (mesma transação). */
async function insert(transaction, { idPaciente, idUsuarioUpload, file, analysis }) {
  const laudo = await queryOne(
    `INSERT INTO LAUDO (
        id_paciente, id_usuario_upload, nome_arquivo, caminho_arquivo,
        tipo_documento, texto_ocr, hash_arquivo, consentimento_upload, mime_type
     )
     OUTPUT INSERTED.id_laudo
     VALUES (@id_paciente, @id_upload, @nome, @caminho, @tipo, @texto, @hash, 1, @mime)`,
    {
      id_paciente: { type: sql.Int, value: idPaciente },
      id_upload: { type: sql.Int, value: idUsuarioUpload },
      nome: { type: sql.NVarChar(255), value: file.fileName },
      caminho: { type: sql.NVarChar(500), value: file.relativePath },
      tipo: { type: sql.VarChar(50), value: "LAUDO_TEA" },
      texto: { type: sql.NVarChar(sql.MAX), value: analysis.extracted_text || null },
      hash: { type: sql.VarChar(128), value: file.hash },
      mime: { type: sql.VarChar(100), value: file.mimeType || "image/jpeg" },
    },
    transaction
  );

  const idLaudo = laudo.id_laudo;

  await query(
    `INSERT INTO LAUDO_ANALISE_IA (
        id_laudo, laudo_valido, confianca, nome_paciente, cpf_paciente,
        nascimento_paciente, diagnostico, cid, nome_profissional,
        registro_profissional, instituicao, endereco_instituicao, data_emissao,
        possui_assinatura, indicadores_fraude, alertas, checagem_cruzada, lido_por_ia
     ) VALUES (
        @id_laudo, @valido, @confianca, @nome_paciente, @cpf_paciente,
        @nascimento, @diagnostico, @cid, @nome_prof,
        @registro, @instituicao, @endereco, @emissao,
        @assinatura, @fraude, @alertas, @checagem, @lido
     )`,
    {
      id_laudo: { type: sql.Int, value: idLaudo },
      lido: { type: sql.Bit, value: analysis.ai_used ? 1 : 0 },
      valido: { type: sql.Bit, value: analysis.is_valid_laudo ? 1 : 0 },
      confianca: { type: sql.Int, value: Math.round(Number(analysis.confidence) || 0) },
      nome_paciente: { type: sql.NVarChar(200), value: analysis.patient_name || null },
      cpf_paciente: { type: sql.VarChar(20), value: analysis.patient_cpf || null },
      nascimento: { type: sql.NVarChar(50), value: analysis.patient_birthdate || null },
      diagnostico: { type: sql.NVarChar(500), value: analysis.diagnosis || null },
      cid: { type: sql.NVarChar(50), value: analysis.cid || null },
      nome_prof: { type: sql.NVarChar(200), value: analysis.professional_name || null },
      registro: { type: sql.NVarChar(50), value: analysis.crp_or_crm || null },
      instituicao: { type: sql.NVarChar(300), value: analysis.institution || null },
      endereco: { type: sql.NVarChar(300), value: analysis.institution_address || null },
      emissao: { type: sql.NVarChar(50), value: analysis.issue_date || null },
      assinatura: { type: sql.Bit, value: analysis.has_signature_or_stamp ? 1 : 0 },
      fraude: {
        type: sql.NVarChar(sql.MAX),
        value: JSON.stringify(analysis.fraud_indicators || []),
      },
      alertas: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(analysis.warnings || []) },
      checagem: {
        type: sql.NVarChar(sql.MAX),
        value: JSON.stringify(analysis.cross_check || null),
      },
    },
    transaction
  );

  return idLaudo;
}

async function findById(id) {
  return queryOne(`${BASE_SELECT} WHERE l.id_laudo = @id`, { id: { type: sql.Int, value: id } });
}

/** Laudos enviados por um usuário (cuidador), mais recentes primeiro. */
async function listForUser(idUsuario, limit = 50) {
  return queryAll(
    `SELECT TOP (@limit) * FROM (${BASE_SELECT} WHERE l.id_usuario_upload = @id) q
     ORDER BY q.data_upload DESC, q.id_laudo DESC`,
    { id: { type: sql.Int, value: idUsuario }, limit: { type: sql.Int, value: limit } }
  );
}

/**
 * Laudos já considerados válidos — base da checagem de fraude.
 * `excludeId`: ao reanalisar um laudo, ele próprio não entra na comparação.
 */
async function listValidForUser(idUsuario, limit = 20, excludeId = null) {
  return queryAll(
    `SELECT TOP (@limit) * FROM (${BASE_SELECT}
       WHERE l.id_usuario_upload = @id AND a.laudo_valido = 1 AND l.id_laudo <> @exclude) q
     ORDER BY q.data_upload DESC, q.id_laudo DESC`,
    {
      id: { type: sql.Int, value: idUsuario },
      limit: { type: sql.Int, value: limit },
      // 0 nunca é um id_laudo (IDENTITY começa em 1): "não excluir ninguém".
      exclude: { type: sql.Int, value: excludeId ? Number(excludeId) : 0 },
    }
  );
}

/**
 * Regrava a análise de um laudo já salvo (reanálise): atualiza o texto do OCR
 * em LAUDO e os campos em LAUDO_ANALISE_IA (cria a linha se ainda não existir).
 */
async function updateAnalysis(idLaudo, analysis, transaction = null) {
  const params = {
    id_laudo: { type: sql.Int, value: idLaudo },
    texto: { type: sql.NVarChar(sql.MAX), value: analysis.extracted_text || null },
    valido: { type: sql.Bit, value: analysis.is_valid_laudo ? 1 : 0 },
    confianca: { type: sql.Int, value: Math.round(Number(analysis.confidence) || 0) },
    nome_paciente: { type: sql.NVarChar(200), value: analysis.patient_name || null },
    cpf_paciente: { type: sql.VarChar(20), value: analysis.patient_cpf || null },
    nascimento: { type: sql.NVarChar(50), value: analysis.patient_birthdate || null },
    diagnostico: { type: sql.NVarChar(500), value: analysis.diagnosis || null },
    cid: { type: sql.NVarChar(50), value: analysis.cid || null },
    nome_prof: { type: sql.NVarChar(200), value: analysis.professional_name || null },
    registro: { type: sql.NVarChar(50), value: analysis.crp_or_crm || null },
    instituicao: { type: sql.NVarChar(300), value: analysis.institution || null },
    endereco: { type: sql.NVarChar(300), value: analysis.institution_address || null },
    emissao: { type: sql.NVarChar(50), value: analysis.issue_date || null },
    assinatura: { type: sql.Bit, value: analysis.has_signature_or_stamp ? 1 : 0 },
    fraude: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(analysis.fraud_indicators || []) },
    alertas: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(analysis.warnings || []) },
    checagem: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(analysis.cross_check || null) },
    lido: { type: sql.Bit, value: analysis.ai_used ? 1 : 0 },
  };

  await query(
    "UPDATE LAUDO SET texto_ocr = @texto WHERE id_laudo = @id_laudo",
    { id_laudo: params.id_laudo, texto: params.texto },
    transaction
  );

  const updated = await query(
    `UPDATE LAUDO_ANALISE_IA
        SET laudo_valido = @valido, confianca = @confianca, nome_paciente = @nome_paciente,
            cpf_paciente = @cpf_paciente, nascimento_paciente = @nascimento,
            diagnostico = @diagnostico, cid = @cid, nome_profissional = @nome_prof,
            registro_profissional = @registro, instituicao = @instituicao,
            endereco_instituicao = @endereco, data_emissao = @emissao,
            possui_assinatura = @assinatura, indicadores_fraude = @fraude,
            alertas = @alertas, checagem_cruzada = @checagem, lido_por_ia = @lido,
            data_analise = SYSDATETIME()
      WHERE id_laudo = @id_laudo`,
    omit(params, ["texto"]),
    transaction
  );

  const affected = updated && updated.rowsAffected ? updated.rowsAffected[0] : 0;
  if (!affected) {
    await query(
      `INSERT INTO LAUDO_ANALISE_IA (
          id_laudo, laudo_valido, confianca, nome_paciente, cpf_paciente,
          nascimento_paciente, diagnostico, cid, nome_profissional,
          registro_profissional, instituicao, endereco_instituicao, data_emissao,
          possui_assinatura, indicadores_fraude, alertas, checagem_cruzada, lido_por_ia
       ) VALUES (
          @id_laudo, @valido, @confianca, @nome_paciente, @cpf_paciente,
          @nascimento, @diagnostico, @cid, @nome_prof,
          @registro, @instituicao, @endereco, @emissao,
          @assinatura, @fraude, @alertas, @checagem, @lido
       )`,
      omit(params, ["texto"]),
      transaction
    );
  }
}

/** Explicação opcional do cuidador sobre um laudo (aparece no resumo do profissional). */
async function setExplanation(idLaudo, texto) {
  await query("UPDATE LAUDO SET explicacao_cuidador = @texto WHERE id_laudo = @id", {
    id: { type: sql.Int, value: idLaudo },
    texto: { type: sql.NVarChar(500), value: texto || null },
  });
}

function omit(obj, keys) {
  const copy = { ...obj };
  keys.forEach((k) => delete copy[k]);
  return copy;
}

/** Linha -> objeto do app (mesmos campos da versão anterior). */
function toApi(row) {
  return {
    id: String(row.id_laudo),
    user_id: String(row.id_usuario_upload),
    is_valid_laudo: !!row.laudo_valido,
    confidence: row.confianca === null ? 0 : Number(row.confianca),
    extracted_text: row.texto_ocr || "",
    patient_name: row.nome_paciente,
    patient_cpf: row.cpf_paciente,
    patient_birthdate: row.nascimento_paciente,
    diagnosis: row.diagnostico,
    cid: row.cid,
    professional_name: row.nome_profissional,
    crp_or_crm: row.registro_profissional,
    institution: row.instituicao,
    institution_address: row.endereco_instituicao,
    issue_date: row.data_emissao,
    has_signature_or_stamp: !!row.possui_assinatura,
    fraud_indicators: parseJson(row.indicadores_fraude, []),
    warnings: parseJson(row.alertas, []),
    cross_check: parseJson(row.checagem_cruzada, null),
    // A IA realmente leu o documento? (null = laudo antigo, anterior a esta informação)
    ai_read: row.lido_por_ia === null || row.lido_por_ia === undefined ? null : !!row.lido_por_ia,
    explanation: row.explicacao_cuidador || "",
    created_at: dt.toApi(row.data_upload),
  };
}

module.exports = { insert, findById, listForUser, listValidForUser, updateAnalysis, setExplanation, toApi };
