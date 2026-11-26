"use strict";

const express = require("express");
const { asyncHandler, badRequest, forbidden, notFound } = require("../errors");
const postsRepository = require("../repositories/posts");
const files = require("../files");
const audit = require("../audit");
const v = require("../values");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /posts
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.currentUser.id);
    const rows =
      req.currentUser.role === "professional"
        ? await postsRepository.listByAuthor(id)
        : await postsRepository.listVisibleToCaregiver(id);
    res.json(rows.map((row) => postsRepository.toApi(row)));
  })
);

// POST /posts
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.currentUser.role !== "professional") {
      throw forbidden("Apenas profissionais podem postar");
    }
    const body = req.body || {};
    if (!body.image_base64) throw badRequest("Imagem obrigatória");

    const mimeType = body.mime_type || "image/jpeg";
    let saved;
    try {
      saved = files.saveBase64("posts", body.image_base64, mimeType);
    } catch (e) {
      throw badRequest(`Imagem inválida: ${e.message}`);
    }
    saved.mimeType = mimeType;

    const idDestino = body.to_caregiver_id ? v.tryParseId(body.to_caregiver_id) : null;

    let idPublicacao;
    try {
      idPublicacao = await postsRepository.insert({
        idProfissional: Number(req.currentUser.id),
        idResponsavelDestino: idDestino,
        legenda: v.trimOrEmpty(body.caption),
        file: saved,
      });
    } catch (e) {
      files.remove(saved.relativePath); // não deixa arquivo órfão
      throw e;
    }

    await audit.log(
      Number(req.currentUser.id),
      "PUBLICAR",
      "PUBLICACAO",
      idPublicacao,
      "Nova publicação de material"
    );

    const row = await postsRepository.findById(idPublicacao);
    res.status(201).json(postsRepository.toApi(row));
  })
);

// PUT /posts/:id — edita a legenda (só quem publicou)
router.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = v.parseId(req.params.id, "Publicação");
    const body = req.body || {};
    if (typeof body.caption !== "string") throw badRequest("Informe a legenda");

    const row = await postsRepository.findById(id);
    if (!row) throw notFound("Publicação não encontrada");
    if (String(row.id_profissional) !== String(req.currentUser.id)) {
      throw forbidden("Apenas quem publicou pode editar esta publicação");
    }

    await postsRepository.updateCaption(id, v.clamp(body.caption, 5000) || "");
    await audit.log(
      Number(req.currentUser.id),
      "EDITAR",
      "PUBLICACAO",
      id,
      "Legenda da publicação editada"
    );

    const updated = await postsRepository.findById(id);
    res.json(postsRepository.toApi(updated));
  })
);

// DELETE /posts/:id
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = v.parseId(req.params.id, "Publicação");
    const row = await postsRepository.findById(id);
    if (!row) throw notFound("Publicação não encontrada");
    if (String(row.id_profissional) !== String(req.currentUser.id)) {
      throw forbidden("Apenas quem publicou pode excluir esta publicação");
    }

    await postsRepository.deleteById(id);
    files.remove(row.caminho_arquivo);
    await audit.log(
      Number(req.currentUser.id),
      "EXCLUIR",
      "PUBLICACAO",
      id,
      "Publicação removida"
    );
    res.json({ ok: true });
  })
);

module.exports = router;
