"use strict";

/**
 * Erro de negócio. O corpo da resposta é `{ detail: "mensagem" }` — mesmo
 * contrato que o app já esperava, então a mensagem aparece direto na tela.
 */
class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const badRequest = (m) => new ApiError(m, 400);
const unauthorized = (m = "Sessão inválida ou expirada") => new ApiError(m, 401);
const forbidden = (m = "Sem permissão") => new ApiError(m, 403);
const notFound = (m = "Não encontrado") => new ApiError(m, 404);

/** Envolve um handler async para que erros caiam no middleware de erro. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ApiError, badRequest, unauthorized, forbidden, notFound, asyncHandler };
