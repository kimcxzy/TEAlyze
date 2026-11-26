"use strict";

// -----------------------------------------------------------------------
// Sessões (tabela TOKEN_ACESSO).
//
// Na versão offline o "token" era um marcador local. Agora ele é emitido
// pelo servidor, gravado no banco e resolvido a cada requisição — então o
// login só é válido enquanto existir no SQL Server (logout apaga a linha).
// -----------------------------------------------------------------------
const { sql, queryOne, query } = require("../db");
const config = require("../config");
const { newToken } = require("../crypto");
const { nowForDb } = require("../datetime");

async function create(idUsuario) {
  const token = newToken();
  const expira = new Date(nowForDb().getTime() + config.tokenTtlDays * 86400000);
  await query(
    `INSERT INTO TOKEN_ACESSO (token, id_usuario, data_expiracao)
     VALUES (@token, @id, @expira)`,
    {
      token: { type: sql.VarChar(128), value: token },
      id: { type: sql.Int, value: idUsuario },
      expira: { type: sql.DateTime2, value: expira },
    }
  );
  return token;
}

/** Resolve o token para um id de usuário (null se inválido/expirado). */
async function resolve(token) {
  if (!token || typeof token !== "string") return null;
  const row = await queryOne(
    `SELECT TOP 1 t.id_usuario
     FROM TOKEN_ACESSO t
     INNER JOIN USUARIO u ON u.id_usuario = t.id_usuario
     WHERE t.token = @token
       AND u.ativo = 1
       AND (t.data_expiracao IS NULL OR t.data_expiracao > @now)`,
    {
      token: { type: sql.VarChar(128), value: token },
      now: { type: sql.DateTime2, value: nowForDb() },
    }
  );
  return row ? row.id_usuario : null;
}

async function revoke(token) {
  if (!token) return;
  await query("DELETE FROM TOKEN_ACESSO WHERE token = @token", {
    token: { type: sql.VarChar(128), value: token },
  });
}

/** Limpeza de tokens expirados (chamada na inicialização). */
async function purgeExpired() {
  try {
    const result = await query(
      "DELETE FROM TOKEN_ACESSO WHERE data_expiracao IS NOT NULL AND data_expiracao <= @now",
      { now: { type: sql.DateTime2, value: nowForDb() } }
    );
    const removed = result.rowsAffected && result.rowsAffected[0];
    if (removed) console.log(`[tokens] ${removed} sessão(ões) expirada(s) removida(s)`);
  } catch (e) {
    console.warn("[tokens] falha ao limpar sessões expiradas:", e.message);
  }
}

module.exports = { create, resolve, revoke, purgeExpired };
