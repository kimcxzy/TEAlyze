"use strict";

const { sql, query } = require("./db");

/**
 * Registra a ação em LOG_AUDITORIA (tabela já prevista no schema).
 * Nunca lança: auditoria com problema não deve derrubar a requisição.
 */
async function log(idUsuario, acao, tabela, idRegistro, descricao, transaction = null) {
  try {
    await query(
      `INSERT INTO LOG_AUDITORIA (id_usuario, acao, tabela_afetada, id_registro, descricao)
       VALUES (@id_usuario, @acao, @tabela, @id_registro, @descricao)`,
      {
        id_usuario: { type: sql.Int, value: idUsuario ?? null },
        acao: { type: sql.VarChar(50), value: String(acao).slice(0, 50) },
        tabela: { type: sql.VarChar(128), value: tabela ? String(tabela).slice(0, 128) : null },
        id_registro: { type: sql.BigInt, value: idRegistro ?? null },
        descricao: { type: sql.NVarChar(sql.MAX), value: descricao ?? null },
      },
      transaction
    );
  } catch (e) {
    console.warn("[audit] falha ao registrar log:", e.message);
  }
}

module.exports = { log };
