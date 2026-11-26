"use strict";

const express = require("express");
const { asyncHandler, badRequest, forbidden, notFound } = require("../errors");
const appointmentsRepository = require("../repositories/appointments");
const usersRepository = require("../repositories/users");
const audit = require("../audit");
const dt = require("../datetime");
const v = require("../values");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /appointments  (cuidador agenda com um profissional)
router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.currentUser.role !== "caregiver") {
      throw forbidden("Apenas cuidadores podem agendar consultas");
    }
    const body = req.body || {};
    const idProfissional = v.parseId(body.professional_id, "Profissional");

    const proRow = await usersRepository.findRowById(idProfissional);
    if (!proRow || usersRepository.roleFromTipo(proRow.tipo_usuario) !== "professional") {
      throw notFound("Profissional não encontrado");
    }

    const inicio = dt.parseToDb(body.scheduled_at);
    if (!inicio) throw badRequest("Data/hora inválida (use ISO 8601)");
    if (inicio.getTime() < dt.nowForDb().getTime()) {
      throw badRequest("A data/hora deve ser futura");
    }

    const duration = Number.parseInt(body.duration_min, 10);
    const durationMin = Number.isFinite(duration) && duration > 0 ? duration : 60;
    const fim = dt.addMinutes(inicio, durationMin);

    let idPaciente = req.currentRow.id_paciente;
    if (!idPaciente) {
      idPaciente = await usersRepository.getPacienteIdForResponsavel(req.currentRow.id_usuario);
    }
    if (!idPaciente) throw badRequest("Nenhum paciente vinculado a este cuidador");

    if (await appointmentsRepository.hasConflict(idProfissional, inicio, fim)) {
      throw badRequest("O profissional já possui uma consulta nesse horário");
    }

    const idSessao = await appointmentsRepository.insert({
      idPaciente,
      idProfissional,
      inicio,
      fim,
      local: v.clamp(body.location, 300) || proRow.endereco || null,
      notes: v.trimOrNull(body.notes),
    });

    await audit.log(
      req.currentRow.id_usuario,
      "AGENDAR",
      "SESSAO",
      idSessao,
      `Consulta agendada com o profissional ${idProfissional}`
    );

    const row = await appointmentsRepository.findById(idSessao);
    res.status(201).json(appointmentsRepository.toApi(row));
  })
);

// GET /appointments/mine
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.currentUser.id);
    const rows =
      req.currentUser.role === "caregiver"
        ? await appointmentsRepository.listForCaregiver(id)
        : await appointmentsRepository.listForProfessional(id);
    res.json(rows.map((row) => appointmentsRepository.toApi(row)));
  })
);

// GET /appointments/upcoming
router.get(
  "/upcoming",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.currentUser.id);
    const now = dt.nowForDb();
    const row =
      req.currentUser.role === "caregiver"
        ? await appointmentsRepository.nextUpcomingForCaregiver(id, now)
        : await appointmentsRepository.nextUpcomingForProfessional(id, now);
    res.json(row ? appointmentsRepository.toApi(row) : null);
  })
);

/** Confere se o usuário logado participa da consulta. */
function ensureParticipant(currentUser, appointment) {
  const id = String(currentUser.id);
  return appointment.caregiver_id === id || appointment.professional_id === id;
}

// POST /appointments/:id/confirm
router.post(
  "/:id/confirm",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = v.parseId(req.params.id, "Consulta");
    const row = await appointmentsRepository.findById(id);
    if (!row) throw notFound("Consulta não encontrada");
    const appointment = appointmentsRepository.toApi(row);

    if (
      req.currentUser.role !== "professional" ||
      appointment.professional_id !== String(req.currentUser.id)
    ) {
      throw forbidden("Apenas o profissional responsável pode confirmar esta consulta");
    }
    if (appointment.status !== "scheduled") {
      throw badRequest("Esta consulta não pode mais ser confirmada");
    }

    await appointmentsRepository.updateStatus(id, "confirmed");
    await audit.log(Number(req.currentUser.id), "CONFIRMAR", "SESSAO", id, "Consulta confirmada");

    const updated = await appointmentsRepository.findById(id);
    res.json(appointmentsRepository.toApi(updated));
  })
);

// DELETE /appointments/:id  (cancelamento — mantém o histórico no banco)
router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = v.parseId(req.params.id, "Consulta");
    const row = await appointmentsRepository.findById(id);
    if (!row) throw notFound("Consulta não encontrada");
    const appointment = appointmentsRepository.toApi(row);

    if (!ensureParticipant(req.currentUser, appointment)) throw forbidden("Sem permissão");

    await appointmentsRepository.updateStatus(id, "cancelled");
    await audit.log(Number(req.currentUser.id), "CANCELAR", "SESSAO", id, "Consulta cancelada");
    res.json({ ok: true });
  })
);

module.exports = router;
