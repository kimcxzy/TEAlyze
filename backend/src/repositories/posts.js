"use strict";

// -----------------------------------------------------------------------
// Feed de materiais  ->  tabela PUBLICACAO (02_app_extensions.sql)
//
// A imagem fica em disco (backend/uploads/posts) e o banco guarda o
// caminho. Para o app, a imagem continua chegando em `image_base64`.
// -----------------------------------------------------------------------
const { sql, queryOne, queryAll, query } = require("../db");
const dt = require("../datetime");
const files = require("../files");

const BASE_SELECT = `
  SELECT pb.id_publicacao, pb.id_profissional, pb.id_responsavel_destino,
         pb.legenda, pb.nome_arquivo, pb.caminho_arquivo, pb.mime_type,
         pb.data_publicacao,
         u.nome AS author_name
  FROM PUBLICACAO pb
  INNER JOIN USUARIO u ON u.id_usuario = pb.id_profissional
`;

async function insert({ idProfissional, idResponsavelDestino, legenda, file }) {
  const row = await queryOne(
    `INSERT INTO PUBLICACAO (
        id_profissional, id_responsavel_destino, legenda,
        nome_arquivo, caminho_arquivo, mime_type
     )
     OUTPUT INSERTED.id_publicacao
     VALUES (@id_prof, @id_dest, @legenda, @nome, @caminho, @mime)`,
    {
      id_prof: { type: sql.Int, value: idProfissional },
      id_dest: { type: sql.Int, value: idResponsavelDestino ?? null },
      legenda: { type: sql.NVarChar(sql.MAX), value: legenda || "" },
      nome: { type: sql.NVarChar(255), value: file.fileName },
      caminho: { type: sql.NVarChar(500), value: file.relativePath },
      mime: { type: sql.VarChar(100), value: file.mimeType || "image/jpeg" },
    }
  );
  return row.id_publicacao;
}

async function findById(id) {
  return queryOne(`${BASE_SELECT} WHERE pb.id_publicacao = @id`, {
    id: { type: sql.Int, value: id },
  });
}

async function listByAuthor(idProfissional) {
  return queryAll(`${BASE_SELECT} WHERE pb.id_profissional = @id ORDER BY pb.data_publicacao DESC`, {
    id: { type: sql.Int, value: idProfissional },
  });
}

/** Publicações visíveis ao cuidador: direcionadas a ele ou públicas. */
async function listVisibleToCaregiver(idResponsavel) {
  return queryAll(
    `${BASE_SELECT}
     WHERE pb.id_responsavel_destino = @id OR pb.id_responsavel_destino IS NULL
     ORDER BY pb.data_publicacao DESC`,
    { id: { type: sql.Int, value: idResponsavel } }
  );
}

async function deleteById(id) {
  await query("DELETE FROM PUBLICACAO WHERE id_publicacao = @id", {
    id: { type: sql.Int, value: id },
  });
}

/** Troca só a legenda da publicação (a imagem não muda). */
async function updateCaption(id, legenda) {
  await query("UPDATE PUBLICACAO SET legenda = @legenda WHERE id_publicacao = @id", {
    id: { type: sql.Int, value: id },
    legenda: { type: sql.NVarChar(sql.MAX), value: legenda || "" },
  });
}

/** Linha -> objeto do app (com a imagem em base64, lida do disco). */
function toApi(row) {
  return {
    id: String(row.id_publicacao),
    author_id: String(row.id_profissional),
    author_name: row.author_name || "",
    caption: row.legenda || "",
    image_base64: files.readAsBase64(row.caminho_arquivo),
    mime_type: row.mime_type || "image/jpeg",
    to_caregiver_id: row.id_responsavel_destino === null ? null : String(row.id_responsavel_destino),
    created_at: dt.toApi(row.data_publicacao),
  };
}

module.exports = {
  insert,
  findById,
  listByAuthor,
  listVisibleToCaregiver,
  updateCaption,
  deleteById,
  toApi,
};
