"use strict";

const express = require("express");
const { withTransaction } = require("../db");
const { asyncHandler, badRequest } = require("../errors");
const { AQ_QUESTIONS, scoreAq, interpretAqScore } = require("../services/aq");
const triagemRepository = require("../repositories/triagem");
const usersRepository = require("../repositories/users");
const audit = require("../audit");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /aq/questions
router.get(
  "/questions",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ questions: AQ_QUESTIONS });
  })
);

// POST /aq/submit
router.post(
  "/submit",
  requireAuth,
  requireRole("caregiver", "Apenas cuidadores respondem o AQ"),
  asyncHandler(async (req, res) => {
    const answers = (req.body && req.body.answers) || [];
    if (!Array.isArray(answers) || answers.length !== 50) {
      throw badRequest("É necessário responder 50 questões");
    }
    const normalized = answers.map((a) => {
      const n = Number(a);
      if (!Number.isInteger(n) || n < 0 || n > 3) {
        throw badRequest("Respostas devem ser números de 0 a 3");
      }
      return n;
    });

    let idPaciente = req.currentRow.id_paciente;
    if (!idPaciente) {
      idPaciente = await usersRepository.getPacienteIdForResponsavel(req.currentRow.id_usuario);
    }
    if (!idPaciente) throw badRequest("Nenhum paciente vinculado a este cuidador");

    const score = scoreAq(normalized);
    const interpretation = interpretAqScore(score);

    const idTriagem = await withTransaction((transaction) =>
      triagemRepository.saveAq(transaction, {
        idPaciente,
        answers: normalized,
        score,
        interpretation,
      })
    );

    await audit.log(
      req.currentRow.id_usuario,
      "TRIAGEM_AQ",
      "TRIAGEM",
      idTriagem,
      `AQ-50 respondido (pontuação ${score})`
    );

    res.json({ score, interpretation });
  })
);

module.exports = router;
