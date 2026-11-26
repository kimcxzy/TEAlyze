"use strict";

const tokens = require("../services/tokens");
const usersRepository = require("../repositories/users");
const triagemRepository = require("../repositories/triagem");
const { unauthorized, forbidden } = require("../errors");

function extractToken(req) {
  const header = req.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  if (typeof req.query.token === "string" && req.query.token) return req.query.token;
  return null;
}

/**
 * Carrega o usuário logado (com o resultado do AQ, quando cuidador) em
 * `req.currentUser` e a linha crua do banco em `req.currentRow`.
 */
async function loadCurrentUser(token) {
  const idUsuario = await tokens.resolve(token);
  if (!idUsuario) throw unauthorized();

  const row = await usersRepository.findRowById(idUsuario);
  if (!row) throw unauthorized("Usuário não encontrado");

  let aq = null;
  if (usersRepository.roleFromTipo(row.tipo_usuario) === "caregiver" && row.id_paciente) {
    aq = await triagemRepository.getLatestAq(row.id_paciente);
  }

  return { user: usersRepository.toUser(row, aq), row };
}

/** Exige autenticação. */
function requireAuth(req, res, next) {
  const token = extractToken(req);
  loadCurrentUser(token)
    .then(({ user, row }) => {
      req.token = token;
      req.currentUser = user;
      req.currentRow = row;
      next();
    })
    .catch(next);
}

/** Exige um papel específico ("caregiver" | "professional"). */
function requireRole(role, message) {
  return (req, res, next) => {
    if (!req.currentUser) return next(forbidden("Sessão inválida"));
    if (req.currentUser.role !== role) return next(forbidden(message || "Sem permissão"));
    next();
  };
}

module.exports = { requireAuth, requireRole, loadCurrentUser, extractToken };
