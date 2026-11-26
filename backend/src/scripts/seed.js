"use strict";

// Uso: npm run seed
// Aplica os scripts SQL (se necessário) e cria os logins de teste (profissionais + cuidador).
const { initDatabase, closeDatabase } = require("../db");
const { seedIfNeeded } = require("../services/seed");

async function main() {
  await initDatabase();
  await seedIfNeeded();
  await closeDatabase();
  console.log("Seed concluído.");
}

main().catch((e) => {
  console.error("Falha no seed:", e.message);
  process.exit(1);
});
