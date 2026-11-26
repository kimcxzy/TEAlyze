"use strict";

// -----------------------------------------------------------------------
// Chat  ->  CONVERSA + PARTICIPANTE_CONVERSA + MENSAGEM
//
// O app conversa sempre 1:1 ("me manda para o usuário X"), então aqui
// resolvemos/criamos a conversa que tem exatamente esses dois participantes.
// -----------------------------------------------------------------------
const { sql, queryOne, queryAll, query, withTransaction } = require("../db");
const dt = require("../datetime");

/** Conversa 1:1 existente entre dois usuários (ou null). */
async function findConversation(idA, idB, transaction = null) {
  const row = await queryOne(
    `SELECT TOP 1 c.id_conversa
     FROM CONVERSA c
     INNER JOIN PARTICIPANTE_CONVERSA pa ON pa.id_conversa = c.id_conversa AND pa.id_usuario = @a
     INNER JOIN PARTICIPANTE_CONVERSA pb ON pb.id_conversa = c.id_conversa AND pb.id_usuario = @b
     WHERE (SELECT COUNT(*) FROM PARTICIPANTE_CONVERSA px WHERE px.id_conversa = c.id_conversa) = 2
     ORDER BY c.id_conversa`,
    { a: { type: sql.Int, value: idA }, b: { type: sql.Int, value: idB } },
    transaction
  );
  return row ? row.id_conversa : null;
}

/** Igual ao findConversation, mas cria a conversa se ainda não existir. */
async function findOrCreateConversation(idA, idB) {
  const existing = await findConversation(idA, idB);
  if (existing) return existing;

  return withTransaction(async (transaction) => {
    const again = await findConversation(idA, idB, transaction);
    if (again) return again;

    const conversa = await queryOne(
      `INSERT INTO CONVERSA (ativa) OUTPUT INSERTED.id_conversa VALUES (1)`,
      {},
      transaction
    );
    const idConversa = conversa.id_conversa;

    await query(
      `INSERT INTO PARTICIPANTE_CONVERSA (id_conversa, id_usuario)
       VALUES (@id_conversa, @a), (@id_conversa, @b)`,
      {
        id_conversa: { type: sql.Int, value: idConversa },
        a: { type: sql.Int, value: idA },
        b: { type: sql.Int, value: idB },
      },
      transaction
    );
    return idConversa;
  });
}

async function insertMessage(idConversa, idAutor, texto) {
  const row = await queryOne(
    `INSERT INTO MENSAGEM (id_conversa, id_usuario, conteudo)
     OUTPUT INSERTED.id_mensagem, INSERTED.data_envio
     VALUES (@id_conversa, @id_usuario, @conteudo)`,
    {
      id_conversa: { type: sql.Int, value: idConversa },
      id_usuario: { type: sql.Int, value: idAutor },
      conteudo: { type: sql.NVarChar(sql.MAX), value: texto },
    }
  );
  return { id: row.id_mensagem, createdAt: row.data_envio };
}

/** Mensagens de uma conversa, mais antigas primeiro (como a tela espera). */
async function listMessages(idConversa) {
  return queryAll(
    `SELECT id_mensagem, id_conversa, id_usuario, conteudo, data_envio, lida
     FROM MENSAGEM
     WHERE id_conversa = @id
     ORDER BY data_envio ASC, id_mensagem ASC`,
    { id: { type: sql.Int, value: idConversa } }
  );
}

/** Marca como lidas as mensagens que o usuário logado recebeu. */
async function markAsRead(idConversa, idLeitor) {
  await query(
    `UPDATE MENSAGEM
     SET lida = 1, data_leitura = SYSDATETIME()
     WHERE id_conversa = @id AND id_usuario <> @leitor AND lida = 0`,
    {
      id: { type: sql.Int, value: idConversa },
      leitor: { type: sql.Int, value: idLeitor },
    }
  );
}

/** Lista de conversas do usuário com a última mensagem de cada uma. */
async function listConversations(idUsuario) {
  return queryAll(
    `SELECT c.id_conversa,
            outro.id_usuario AS other_id,
            ultima.conteudo,
            ultima.data_envio
     FROM PARTICIPANTE_CONVERSA eu
     INNER JOIN CONVERSA c ON c.id_conversa = eu.id_conversa
     INNER JOIN PARTICIPANTE_CONVERSA outro
             ON outro.id_conversa = c.id_conversa AND outro.id_usuario <> eu.id_usuario
     CROSS APPLY (
        SELECT TOP 1 m.conteudo, m.data_envio
        FROM MENSAGEM m
        WHERE m.id_conversa = c.id_conversa
        ORDER BY m.data_envio DESC, m.id_mensagem DESC
     ) ultima
     WHERE eu.id_usuario = @id
     ORDER BY ultima.data_envio DESC`,
    { id: { type: sql.Int, value: idUsuario } }
  );
}

/** Linha de MENSAGEM -> objeto do app (mantém os nomes de campo antigos). */
function messageToApi(row, idOutro) {
  return {
    id: String(row.id_mensagem),
    conv_id: String(row.id_conversa),
    from_user_id: String(row.id_usuario),
    to_user_id: String(idOutro),
    text: row.conteudo,
    created_at: dt.toApi(row.data_envio),
  };
}

module.exports = {
  findConversation,
  findOrCreateConversation,
  insertMessage,
  listMessages,
  listConversations,
  markAsRead,
  messageToApi,
};
