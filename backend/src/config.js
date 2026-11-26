"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function bool(value, fallback) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "y", "sim"].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const OCR_PRESETS = {
  // Modelos "-latest" são aliases mantidos pelo Google: continuam valendo
  // quando uma versão específica é aposentada. Se um falhar, o próximo é tentado.
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash-lite"],
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini"],
  },
};

function resolveOcr() {
  const apiKey = (process.env.OCR_API_KEY || "").trim();
  let provider = (process.env.OCR_PROVIDER || "").trim().toLowerCase();
  // Chaves da OpenAI começam com "sk-": quem já usava só OCR_API_KEY continua funcionando.
  if (!provider) provider = apiKey.startsWith("sk-") ? "openai" : "gemini";

  const preset = OCR_PRESETS[provider];
  let customUrl = (process.env.OCR_API_URL || "").trim();
  let modelsRaw = process.env.OCR_MODEL || "";
  // Resíduo de versões anteriores (.env/compose fixavam a URL e o modelo da OpenAI):
  // com uma chave que não é da OpenAI, isso só causaria erro 401 — ignora.
  if (provider === "gemini" && customUrl.includes("api.openai.com") && !apiKey.startsWith("sk-")) {
    console.warn("[config] OCR_API_URL aponta para a OpenAI, mas a chave não é da OpenAI — usando o padrão gemini");
    customUrl = "";
    modelsRaw = "";
  }
  if (!preset && !customUrl) {
    console.warn(`[config] OCR_PROVIDER="${provider}" desconhecido e OCR_API_URL vazio — usando gemini`);
  }
  const base = preset || OCR_PRESETS.gemini;

  const modelsEnv = modelsRaw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  return {
    provider: customUrl ? "custom" : preset ? provider : "gemini",
    apiKey,
    apiUrl: customUrl || base.url,
    // Lista de modelos em ordem de preferência (OCR_MODEL aceita vírgulas).
    models: modelsEnv.length ? modelsEnv : base.models,
    timeoutMs: int(process.env.OCR_TIMEOUT_MS, 45000),
  };
}

const config = {
  port: int(process.env.PORT, 3000),

  // --- SQL Server (container Docker) -----------------------------------
  db: {
    server: process.env.DB_HOST || "localhost",
    port: int(process.env.DB_PORT, 1433),
    user: process.env.DB_USER || "sa",
    password: process.env.DB_PASSWORD || "*123456HAS*",
    database: process.env.DB_NAME || "TEALYZE",
    options: {
      encrypt: bool(process.env.DB_ENCRYPT, false),
      trustServerCertificate: bool(process.env.DB_TRUST_CERT, true),
      useUTC: true, // datas trafegam como "wall clock" (ver src/datetime.js)
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: int(process.env.DB_CONNECT_TIMEOUT, 30000),
    requestTimeout: int(process.env.DB_REQUEST_TIMEOUT, 60000),
  },

  // Quanto tempo esperar o container do SQL Server subir (ele demora ~20s).
  dbWait: {
    retries: int(process.env.DB_WAIT_RETRIES, 60),
    delayMs: int(process.env.DB_WAIT_DELAY_MS, 3000),
  },

  runMigrations: bool(process.env.DB_RUN_MIGRATIONS, true),
  runSeed: bool(process.env.DB_RUN_SEED, true),

  sqlDir: process.env.DB_SQL_DIR
    ? path.resolve(process.env.DB_SQL_DIR)
    : path.resolve(__dirname, "..", "..", "database"),

  uploadsDir: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(__dirname, "..", "uploads"),

  // --- OCR de laudo por IA (opcional) -----------------------------------
  // Provedor padrão: Google Gemini, que tem plano GRATUITO (sem cartão) e uma
  // API compatível com o formato da OpenAI. Chave grátis: aistudio.google.com/apikey
  // Qualquer outro provedor compatível funciona via OCR_API_URL + OCR_MODEL.
  ocr: resolveOcr(),

  tokenTtlDays: int(process.env.TOKEN_TTL_DAYS, 30),
};

module.exports = config;
