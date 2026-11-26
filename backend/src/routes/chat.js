"use strict";

const express = require("express");
const { asyncHandler, badRequest, notFound } = require("../errors");
const messagesRepository = require("../repositories/messages");
const usersRepository = require("../repositories/users");
const dt = require("../datetime");
const audit = require("../audit");
const v = require("../values");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/** Usuário "do outro lado" da conversa, já sem dados sensíveis. */
async function publicUser(id) {
  const row = await usersRepository.findRowById(id);
  if (!row) return null;
  return usersRepository.toPublic(usersRepository.toUser(row));
}

// GET /chat  -> lista de conversas com a última mensagem
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = Number(req.currentUser.id);
    const rows = await messagesRepository.listConversations(me);
    const results = [];
    for (const row of rows) {
      const other = await publicUser(row.other_id);
      if (!other) continue;
      results.push({
        other_user: other,
        last_text: row.conteudo,
        last_at: dt.toApi(row.data_envio),
      });
    }
    res.json(results);
  })
);

// POST /chat/send
router.post(
  "/send",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const text = v.trimOrEmpty(body.text);
    if (!text) throw badRequest("Mensagem vazia");

    const idOutro = v.parseId(body.to_user_id, "Destinatário");
    const me = Number(req.currentUser.id);
    if (idOutro === me) throw badRequest("Não é possível conversar consigo mesmo");

    const destinatario = await usersRepository.findRowById(idOutro);
    if (!destinatario) throw notFound("Destinatário não encontrado");

    const idConversa = await messagesRepository.findOrCreateConversation(me, idOutro);
    const inserted = await messagesRepository.insertMessage(idConversa, me, text);

    await audit.log(me, "MENSAGEM", "MENSAGEM", inserted.id, `Mensagem enviada para ${idOutro}`);

    res.status(201).json({
      id: String(inserted.id),
      conv_id: String(idConversa),
      from_user_id: String(me),
      to_user_id: String(idOutro),
      text,
      created_at: dt.toApi(inserted.createdAt),
    });
  })
);

// GET /chat/:id  -> mensagens trocadas com o usuário :id
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const idOutro = v.parseId(req.params.id, "Conversa");
    const me = Number(req.currentUser.id);

    const idConversa = await messagesRepository.findConversation(me, idOutro);
    if (!idConversa) {
      res.json([]); // conversa ainda não existe — nada a mostrar
      return;
    }

    const rows = await messagesRepository.listMessages(idConversa);
    await messagesRepository.markAsRead(idConversa, me);

    res.json(
      rows.map((row) => {
        const destino = Number(row.id_usuario) === me ? idOutro : me;
        return messagesRepository.messageToApi(row, destino);
      })
    );
  })
);

module.exports = router;
