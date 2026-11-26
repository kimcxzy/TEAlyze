"use strict";

const express = require("express");
const { asyncHandler } = require("../errors");
const usersRepository = require("../repositories/users");
const v = require("../values");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /professionals
router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await usersRepository.listProfessionals());
  })
);

// GET /professionals/:id
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = v.parseId(req.params.id, "Profissional");
    res.json(await usersRepository.findProfessionalPublic(id));
  })
);

module.exports = router;
