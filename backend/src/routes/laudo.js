"use strict";

const express = require("express");
const { withTransaction } = require("../db");
const { asyncHandler, badRequest, forbidden, notFound } = require("../errors");
const laudosRepository = require("../repositories/laudos");
const appointmentsRepository = require("../repositories/appointments");
const { summarize } = require("../services/laudoSummary");
const usersRepository = require("../repositories/users");
const { analyzeLaudo, getOcrStatus } = require("../services/laudoOcr");
const v = require("../values");
const files = require("../files");
const audit = require("../audit");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /laudo/analyze
router.post(
  "/analyze",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.currentUser.role !== "caregiver") {
      throw forbidden("Apenas cuidadores podem enviar laudos");
    }
    const body = req.body || {};
    if (!body.image_base64) throw badRequest("Imagem obrigatória");

    const mimeType = body.mime_type || "image/jpeg";

    let idPaciente = req.currentRow.id_paciente;
    if (!idPaciente) {
      idPaciente = await usersRepository.getPacienteIdForResponsavel(req.currentRow.id_usuario);
    }
    if (!idPaciente) throw badRequest("Nenhum paciente vinculado a este cuidador");

    let saved;
    try {
      saved = files.saveBase64("laudos", body.image_base64, mimeType);
    } catch (e) {
      throw badRequest(`Imagem inválida: ${e.message}`);
    }
    saved.mimeType = mimeType;

    const analysis = await analyzeLaudo({
      imageBase64: files.stripDataUrl(body.image_base64),
      mimeType,
      currentUser: {
        id: req.currentUser.id,
        patient_name: req.currentUser.patient_name,
        patient_cpf: req.currentUser.patient_cpf,
      },
    });

    let idLaudo;
    try {
      idLaudo = await withTransaction((transaction) =>
        laudosRepository.insert(transaction, {
          idPaciente,
          idUsuarioUpload: Number(req.currentUser.id),
          file: saved,
          analysis,
        })
      );
    } catch (e) {
      files.remove(saved.relativePath);
      throw e;
    }

    await audit.log(
      Number(req.currentUser.id),
      "UPLOAD_LAUDO",
      "LAUDO",
      idLaudo,
      `Laudo enviado (válido=${analysis.is_valid_laudo ? "sim" : "não"})`
    );

    const row = await laudosRepository.findById(idLaudo);
    res.status(201).json(laudosRepository.toApi(row));
  })
);

// GET /laudo/mine
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await laudosRepository.listForUser(Number(req.currentUser.id), 50);
    res.json(rows.map((row) => laudosRepository.toApi(row)));
  })
);

// GET /laudo/ocr-status — a leitura por IA está ligada? (nunca expõe a chave)
router.get(
  "/ocr-status",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(getOcrStatus());
  })
);

/** Carrega um laudo e garante que pertence ao usuário logado. */
async function loadOwnLaudo(req) {
  const id = v.parseId(req.params.id, "Laudo");
  const row = await laudosRepository.findById(id);
  if (!row) throw notFound("Laudo não encontrado");
  if (String(row.id_usuario_upload) !== String(req.currentUser.id)) {
    throw forbidden("Este laudo pertence a outro usuário");
  }
  return row;
}

/** Resumo de documentos de um cuidador (calculado na hora, sem nota guardada). */
async function summaryFor(idCuidador) {
  const rows = await laudosRepository.listForUser(idCuidador, 200);
  return summarize(rows.map((row) => laudosRepository.toApi(row)));
}

// GET /laudo/summary — o CUIDADOR vê exatamente o que os profissionais veem sobre ele
router.get(
  "/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.currentUser.role !== "caregiver") throw forbidden("Disponível apenas para cuidadores");
    res.json(await summaryFor(Number(req.currentUser.id)));
  })
);

// GET /laudo/summary/:caregiverId — o PROFISSIONAL vê o resumo, mas só da família que ele atende
router.get(
  "/summary/:caregiverId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.currentUser.role !== "professional") throw forbidden("Disponível apenas para profissionais");
    const idCuidador = v.parseId(req.params.caregiverId, "Cuidador");
    const idProfissional = Number(req.currentUser.id);

    const vinculado = await appointmentsRepository.hasActiveRelation(idProfissional, idCuidador);
    if (!vinculado) {
      throw forbidden("O resumo dos documentos só fica disponível para famílias com consulta marcada com você");
    }

    // Quem consultou fica registrado: o acesso a esse resumo é auditável.
    await audit.log(
      idProfissional,
      "VER_RESUMO_LAUDOS",
      "USUARIO",
      idCuidador,
      "Profissional consultou o resumo de documentos da família"
    );
    res.json(await summaryFor(idCuidador));
  })
);

// PUT /laudo/:id/explanation — o cuidador explica um alerta (opcional, até 500 caracteres)
router.put(
  "/:id/explanation",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await loadOwnLaudo(req);
    const body = req.body || {};
    if (typeof body.explanation !== "string") throw badRequest("Informe a explicação");
    const text = body.explanation.trim();
    if (text.length > 500) throw badRequest("A explicação pode ter no máximo 500 caracteres");

    await laudosRepository.setExplanation(row.id_laudo, text);
    await audit.log(
      Number(req.currentUser.id),
      "EXPLICAR_LAUDO",
      "LAUDO",
      row.id_laudo,
      "Explicação do cuidador atualizada"
    );
    const updated = await laudosRepository.findById(row.id_laudo);
    res.json(laudosRepository.toApi(updated));
  })
);

// GET /laudo/:id — detalhe de um laudo salvo (análise + imagem)
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await loadOwnLaudo(req);
    res.json({
      ...laudosRepository.toApi(row),
      mime_type: row.mime_type || "image/jpeg",
      image_base64: files.readAsBase64(row.caminho_arquivo),
    });
  })
);

// POST /laudo/:id/reanalyze — roda a IA de novo sobre a imagem já salva
router.post(
  "/:id/reanalyze",
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = await loadOwnLaudo(req);
    const imageBase64 = files.readAsBase64(row.caminho_arquivo);
    if (!imageBase64) throw badRequest("O arquivo deste laudo não foi encontrado no servidor");

    const analysis = await analyzeLaudo({
      imageBase64,
      mimeType: row.mime_type || "image/jpeg",
      currentUser: {
        id: req.currentUser.id,
        patient_name: req.currentUser.patient_name,
        patient_cpf: req.currentUser.patient_cpf,
      },
      excludeLaudoId: row.id_laudo,
    });

    await laudosRepository.updateAnalysis(row.id_laudo, analysis);
    await audit.log(
      Number(req.currentUser.id),
      "REANALISE_LAUDO",
      "LAUDO",
      row.id_laudo,
      `Laudo reanalisado (válido=${analysis.is_valid_laudo ? "sim" : "não"}, IA=${analysis.ai_used ? "sim" : "não"})`
    );

    const updated = await laudosRepository.findById(row.id_laudo);
    res.json(laudosRepository.toApi(updated));
  })
);

module.exports = router;
