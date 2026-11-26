"use strict";

const express = require("express");
const { withTransaction } = require("../db");
const { asyncHandler, badRequest } = require("../errors");
const { hashPassword, verifyPassword } = require("../crypto");
const v = require("../values");
const usersRepository = require("../repositories/users");
const triagemRepository = require("../repositories/triagem");
const tokens = require("../services/tokens");
const audit = require("../audit");
const { requireAuth, loadCurrentUser } = require("../middleware/auth");

const router = express.Router();

/** Monta a resposta { token, user } após cadastro/login. */
async function issueSession(idUsuario) {
  const token = await tokens.create(idUsuario);
  const { user } = await loadCurrentUser(token);
  return { token, user };
}

// POST /auth/register/caregiver
router.post(
  "/register/caregiver",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const password = v.requirePassword(body.password);

    const { idUsuario } = await withTransaction((transaction) =>
      usersRepository.createCaregiver(transaction, {
        ...body,
        senhaHash: hashPassword(password),
      })
    );

    await audit.log(idUsuario, "CADASTRO", "USUARIO", idUsuario, "Cadastro de cuidador");
    res.status(201).json(await issueSession(idUsuario));
  })
);

// POST /auth/register/professional
router.post(
  "/register/professional",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const password = v.requirePassword(body.password);

    const { idUsuario } = await withTransaction((transaction) =>
      usersRepository.createProfessional(transaction, {
        ...body,
        senhaHash: hashPassword(password),
      })
    );

    await audit.log(idUsuario, "CADASTRO", "USUARIO", idUsuario, "Cadastro de profissional");
    res.status(201).json(await issueSession(idUsuario));
  })
);

// POST /auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const email = v.trimOrEmpty(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) throw badRequest("Informe e-mail e senha");

    const row = await usersRepository.findRowByEmail(email);
    if (!row || !verifyPassword(password, row.senha_hash)) {
      throw badRequest("Credenciais inválidas");
    }
    if (!row.ativo) throw badRequest("Usuário inativo");

    await audit.log(row.id_usuario, "LOGIN", "USUARIO", row.id_usuario, "Login realizado");
    res.json(await issueSession(row.id_usuario));
  })
);

// GET /auth/me
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.currentUser);
  })
);

// POST /auth/logout
router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await tokens.revoke(req.token);
    res.json({ ok: true });
  })
);

// GET /aq/... está em routes/aq.js; aqui só o atalho de resultado do AQ
// para o usuário logado (usado por telas que já tinham o dado no `user`).
router.get(
  "/me/aq",
  requireAuth,
  asyncHandler(async (req, res) => {
    const idPaciente = req.currentRow.id_paciente;
    const aq = idPaciente ? await triagemRepository.getLatestAq(idPaciente) : null;
    res.json(aq || { score: null, answers: null, interpretation: null });
  })
);

module.exports = router;
