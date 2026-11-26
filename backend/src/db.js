"use strict";

const fs = require("fs");
const path = require("path");
const sql = require("mssql");
const config = require("./config");

let pool = null;

/** Conecta em `master` (usado para criar o database na primeira execução). */
async function connectMaster() {
  const masterConfig = { ...config.db, database: "master" };
  return new sql.ConnectionPool(masterConfig).connect();
}

/**
 * O container do SQL Server leva alguns segundos para aceitar conexões.
 * Aqui tentamos repetidamente até conseguir, em vez de derrubar a API.
 */
async function waitForServer() {
  const { retries, delayMs } = config.dbWait;
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    let master = null;
    try {
      master = await connectMaster();
      await master.request().query("SELECT 1 AS ok");
      await master.close();
      if (attempt > 1) console.log(`[db] SQL Server respondeu na tentativa ${attempt}.`);
      return;
    } catch (e) {
      lastError = e;
      if (master) {
        try {
          await master.close();
        } catch {
          /* ignora */
        }
      }
      console.log(
        `[db] aguardando SQL Server em ${config.db.server}:${config.db.port} ` +
          `(tentativa ${attempt}/${retries}) — ${e.message}`
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error(
    `Não foi possível conectar ao SQL Server em ${config.db.server}:${config.db.port}. ` +
      `Verifique se o container está rodando (docker ps). Último erro: ${lastError && lastError.message}`
  );
}

/** Cria o database caso ainda não exista (equivale ao CREATE DATABASE do script). */
async function ensureDatabase() {
  const master = await connectMaster();
  try {
    const name = config.db.database;
    const result = await master
      .request()
      .input("name", sql.NVarChar(128), name)
      .query("SELECT DB_ID(@name) AS id");
    if (result.recordset[0].id === null) {
      console.log(`[db] criando database ${name}...`);
      // Nome de database não aceita parâmetro — validamos o formato antes.
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`Nome de database inválido: ${name}`);
      }
      await master.request().query(`CREATE DATABASE [${name}]`);
      console.log(`[db] database ${name} criado.`);
    }
  } finally {
    await master.close();
  }
}

/** Divide um script T-SQL nos separadores `GO`. */
function splitBatches(script) {
  return script
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/** Remove os comandos que não fazem sentido dentro de uma conexão já apontada
 *  para o database (CREATE DATABASE / USE). */
function isSkippableBatch(batch) {
  return /^\s*(CREATE\s+DATABASE|USE)\b/i.test(batch);
}

async function runScriptFile(connection, filePath) {
  const script = fs.readFileSync(filePath, "utf8");
  const batches = splitBatches(script).filter((b) => !isSkippableBatch(b));
  for (const batch of batches) {
    try {
      await connection.request().batch(batch);
    } catch (e) {
      throw new Error(
        `Erro executando ${path.basename(filePath)}:\n` +
          `${batch.slice(0, 300)}\n--> ${e.message}`
      );
    }
  }
  console.log(`[db] script aplicado: ${path.basename(filePath)} (${batches.length} lotes)`);
}

async function tableExists(connection, table) {
  const r = await connection
    .request()
    .input("t", sql.NVarChar(128), table)
    .query("SELECT OBJECT_ID(@t, 'U') AS id");
  return r.recordset[0].id !== null;
}

/**
 * Aplica o schema:
 *   - 01_schema.sql   -> somente se o banco ainda estiver vazio (sem USUARIO)
 *   - 02_app_extensions.sql -> sempre (é idempotente)
 */
async function runMigrations(connection) {
  const schemaFile = path.join(config.sqlDir, "01_schema.sql");
  const extensionsFile = path.join(config.sqlDir, "02_app_extensions.sql");

  const hasUsuario = await tableExists(connection, "USUARIO");
  if (!hasUsuario) {
    if (!fs.existsSync(schemaFile)) {
      throw new Error(`Schema não encontrado: ${schemaFile}`);
    }
    console.log("[db] banco vazio — aplicando 01_schema.sql");
    await runScriptFile(connection, schemaFile);
  } else {
    console.log("[db] tabelas do schema já existem — 01_schema.sql não será reaplicado");
  }

  if (fs.existsSync(extensionsFile)) {
    await runScriptFile(connection, extensionsFile);
  } else {
    console.warn(`[db] aviso: ${extensionsFile} não encontrado`);
  }
}

/** Inicializa tudo: espera o servidor, cria database, aplica scripts, abre o pool. */
async function initDatabase() {
  await waitForServer();
  await ensureDatabase();

  pool = await new sql.ConnectionPool(config.db).connect();
  pool.on("error", (e) => console.error("[db] erro no pool:", e.message));

  if (config.runMigrations) {
    await runMigrations(pool);
  }
  console.log(`[db] conectado em ${config.db.server}:${config.db.port}/${config.db.database}`);
  return pool;
}

function getPool() {
  if (!pool) throw new Error("Banco de dados ainda não inicializado");
  return pool;
}

/**
 * Executa uma query parametrizada.
 * `params` aceita valores simples ou { type, value } para tipagem explícita.
 */
async function query(text, params = {}, transaction = null) {
  const request = transaction ? transaction.request() : getPool().request();
  for (const [name, raw] of Object.entries(params)) {
    if (raw !== null && typeof raw === "object" && "type" in raw && !(raw instanceof Date)) {
      request.input(name, raw.type, raw.value);
    } else {
      request.input(name, raw);
    }
  }
  const result = await request.query(text);
  return result;
}

/** Primeira linha do resultado (ou null). */
async function queryOne(text, params = {}, transaction = null) {
  const result = await query(text, params, transaction);
  return result.recordset && result.recordset.length ? result.recordset[0] : null;
}

/** Todas as linhas do resultado. */
async function queryAll(text, params = {}, transaction = null) {
  const result = await query(text, params, transaction);
  return result.recordset || [];
}

/** Roda `fn(transaction)` dentro de uma transação, com rollback em caso de erro. */
async function withTransaction(fn) {
  const transaction = new sql.Transaction(getPool());
  await transaction.begin();
  try {
    const out = await fn(transaction);
    await transaction.commit();
    return out;
  } catch (e) {
    try {
      await transaction.rollback();
    } catch {
      /* transação já abortada */
    }
    throw e;
  }
}

async function closeDatabase() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = {
  sql,
  initDatabase,
  getPool,
  query,
  queryOne,
  queryAll,
  withTransaction,
  closeDatabase,
  splitBatches,
  isSkippableBatch,
};
