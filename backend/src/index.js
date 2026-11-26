"use strict";

const config = require("./config");
const { initDatabase, closeDatabase } = require("./db");
const { createApp } = require("./app");
const files = require("./files");
const tokens = require("./services/tokens");
const { seedIfNeeded } = require("./services/seed");

async function main() {
  console.log("=== TEAlyze API ===");
  console.log(`[boot] banco: ${config.db.server}:${config.db.port}/${config.db.database}`);

  files.initUploads();

  // 1) espera o container do SQL Server, cria o database e aplica os scripts
  await initDatabase();

  // 2) limpa sessões vencidas e semeia os logins de teste (profissionais + cuidador)
  await tokens.purgeExpired();
  if (config.runSeed) {
    try {
      await seedIfNeeded();
    } catch (e) {
      // Um problema nos dados de exemplo não pode impedir a API de subir.
      console.warn(`[seed] falha ao criar dados de demonstração: ${e.message}`);
    }
  }

  // 3) sobe a API
  const app = createApp();
  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`[boot] API ouvindo em http://0.0.0.0:${config.port}`);
    console.log("[boot] teste com: curl http://localhost:" + config.port + "/health");
  });

  const shutdown = async (signal) => {
    console.log(`\n[boot] ${signal} recebido — encerrando...`);
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error("\n[boot] falha na inicialização:", e.message);
  console.error(
    "\nVerifique:\n" +
      "  1. o container do SQL Server está rodando?   docker ps\n" +
      "  2. a porta 1433 está publicada?              docker compose ps\n" +
      "  3. DB_HOST/DB_PASSWORD em backend/.env estão corretos?\n"
  );
  process.exit(1);
});
