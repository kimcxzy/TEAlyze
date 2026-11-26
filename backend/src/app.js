"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");
const config = require("./config");
const { ApiError } = require("./errors");

const authRoutes = require("./routes/auth");
const aqRoutes = require("./routes/aq");
const postsRoutes = require("./routes/posts");
const professionalsRoutes = require("./routes/professionals");
const chatRoutes = require("./routes/chat");
const appointmentsRoutes = require("./routes/appointments");
const laudoRoutes = require("./routes/laudo");
const profileRoutes = require("./routes/profile");

function createApp() {
  const app = express();

  app.use(cors());
  // Imagens de laudo/publicação chegam em base64, por isso o limite alto.
  app.use(express.json({ limit: "25mb" }));

  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
    });
    next();
  });

  // Diagnóstico rápido: confirma que a API está de pé e falando com o banco.
  app.get("/health", async (req, res) => {
    try {
      const { queryOne } = require("./db");
      const row = await queryOne("SELECT DB_NAME() AS db, SYSDATETIME() AS agora");
      res.json({
        status: "ok",
        database: row.db,
        server_time: row.agora,
        host: `${config.db.server}:${config.db.port}`,
      });
    } catch (e) {
      res.status(503).json({ status: "sem banco", detail: e.message });
    }
  });

  // Arquivos enviados (útil para conferir uploads pelo navegador).
  app.use("/uploads", express.static(config.uploadsDir));

  // --- Rotas consumidas pelo app (mesmos caminhos da versão anterior) ---
  app.use("/auth", authRoutes);
  app.use("/aq", aqRoutes);
  app.use("/posts", postsRoutes);
  app.use("/professionals", professionalsRoutes);
  app.use("/chat", chatRoutes);
  app.use("/appointments", appointmentsRoutes);
  app.use("/laudo", laudoRoutes);
  app.use("/profile", profileRoutes);

  app.get("/", (req, res) => {
    res.json({
      name: "TEAlyze API",
      database: `${config.db.server}:${config.db.port}/${config.db.database}`,
      docs: path.basename(__filename),
      routes: [
        "POST /auth/login",
        "POST /auth/register/caregiver",
        "POST /auth/register/professional",
        "GET  /auth/me",
        "GET  /aq/questions",
        "POST /aq/submit",
        "GET  /professionals",
        "GET  /professionals/:id",
        "GET  /posts",
        "POST /posts",
        "PUT  /posts/:id",
        "DELETE /posts/:id",
        "GET  /chat",
        "POST /chat/send",
        "GET  /chat/:id",
        "POST /appointments",
        "GET  /appointments/mine",
        "GET  /appointments/upcoming",
        "POST /appointments/:id/confirm",
        "DELETE /appointments/:id",
        "POST /laudo/analyze",
        "GET  /laudo/mine",
        "GET  /laudo/ocr-status",
        "GET  /laudo/summary",
        "GET  /laudo/summary/:caregiverId",
        "PUT  /laudo/:id/explanation",
        "GET  /laudo/:id",
        "POST /laudo/:id/reanalyze",
        "GET  /profile",
        "PUT  /profile",
        "POST /profile/password",
        "GET  /health",
      ],
    });
  });

  // 404 no formato que o app entende.
  app.use((req, res) => {
    res.status(404).json({ detail: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
  });

  // Tratamento central de erros — sempre { detail: "mensagem" }.
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ detail: err.message });
      return;
    }
    if (err && err.type === "entity.too.large") {
      res.status(413).json({ detail: "Arquivo muito grande. Tente uma imagem menor." });
      return;
    }
    // Violações de constraint do SQL Server viram mensagens legíveis.
    if (err && (err.number === 2627 || err.number === 2601)) {
      res.status(400).json({ detail: "Registro duplicado (e-mail ou CPF já cadastrado)." });
      return;
    }
    console.error("[erro]", err);
    res.status(500).json({ detail: err && err.message ? err.message : "Erro interno" });
  });

  return app;
}

module.exports = { createApp };
