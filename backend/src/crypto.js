"use strict";

// -----------------------------------------------------------------------
// Hash de senha.
//
// Mantém EXATAMENTE o mesmo formato que a versão anterior do app usava
// (`sha256s2:<salt>:<iteracoes>:<hash>`), então bases de teste antigas
// continuam validando. A diferença é que agora o cálculo acontece no
// servidor — a senha em texto puro nunca é gravada no SQL Server.
// -----------------------------------------------------------------------
const nodeCrypto = require("crypto");

const STRETCH_ITERATIONS = 2000;

function sha256Hex(input) {
  return nodeCrypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function stretch(password, salt, iterations) {
  let value = sha256Hex(`${salt}:${password}`);
  for (let i = 0; i < iterations; i++) {
    value = sha256Hex(value + salt);
  }
  return value;
}

/** Gera o hash para armazenar em USUARIO.senha_hash. */
function hashPassword(password) {
  const salt = nodeCrypto.randomBytes(16).toString("hex");
  const hash = stretch(password, salt, STRETCH_ITERATIONS);
  return `sha256s2:${salt}:${STRETCH_ITERATIONS}:${hash}`;
}

/** Confere uma senha contra o hash armazenado. */
function verifyPassword(password, stored) {
  try {
    if (typeof stored !== "string") return false;
    const parts = stored.split(":");
    if (parts.length !== 4 || parts[0] !== "sha256s2") return false;
    const [, salt, iterStr, expected] = parts;
    const iterations = parseInt(iterStr, 10) || STRETCH_ITERATIONS;
    const actual = stretch(password, salt, iterations);
    if (actual.length !== expected.length) return false;
    return nodeCrypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Token opaco de sessão (gravado em TOKEN_ACESSO). */
function newToken() {
  return nodeCrypto.randomBytes(32).toString("hex");
}

/** SHA-256 de um arquivo (LAUDO.hash_arquivo). */
function sha256Buffer(buffer) {
  return nodeCrypto.createHash("sha256").update(buffer).digest("hex");
}

module.exports = { hashPassword, verifyPassword, newToken, sha256Buffer, sha256Hex };
