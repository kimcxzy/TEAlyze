"use strict";

// -----------------------------------------------------------------------
// Armazenamento de imagens.
//
// As imagens (publicações e laudos) são gravadas como arquivos reais em
// `backend/uploads/...` e o banco guarda apenas o caminho + hash, exatamente
// como as colunas LAUDO.caminho_arquivo / LAUDO.hash_arquivo preveem.
// Para o app, a imagem continua chegando em base64 (contrato inalterado).
// -----------------------------------------------------------------------
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const { sha256Buffer } = require("./crypto");

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Remove o prefixo "data:image/...;base64," se existir. */
function stripDataUrl(base64) {
  if (typeof base64 !== "string") return "";
  const idx = base64.indexOf("base64,");
  return idx >= 0 ? base64.slice(idx + 7) : base64;
}

/**
 * Grava um base64 em disco.
 * @returns {{fileName:string, filePath:string, relativePath:string, hash:string, bytes:number}}
 */
function saveBase64(folder, base64, mimeType = "image/jpeg") {
  const clean = stripDataUrl(base64).replace(/\s/g, "");
  if (!clean) throw new Error("Conteúdo de imagem vazio");

  const buffer = Buffer.from(clean, "base64");
  if (!buffer.length) throw new Error("Não foi possível decodificar a imagem");

  const dir = path.join(config.uploadsDir, folder);
  ensureDir(dir);

  const ext = EXTENSIONS[String(mimeType).toLowerCase()] || ".bin";
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    relativePath: path.posix.join(folder, fileName),
    hash: sha256Buffer(buffer),
    bytes: buffer.length,
  };
}

/** Resolve um caminho salvo no banco (relativo ou absoluto) para o disco. */
function resolveStoredPath(stored) {
  if (!stored) return null;
  return path.isAbsolute(stored) ? stored : path.join(config.uploadsDir, stored);
}

/** Lê o arquivo e devolve base64 ("" se o arquivo não existir mais). */
function readAsBase64(stored) {
  try {
    const filePath = resolveStoredPath(stored);
    if (!filePath || !fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath).toString("base64");
  } catch (e) {
    console.warn("[files] falha ao ler arquivo", stored, e.message);
    return "";
  }
}

/** Apaga o arquivo (silencioso se já não existir). */
function remove(stored) {
  try {
    const filePath = resolveStoredPath(stored);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.warn("[files] falha ao remover arquivo", stored, e.message);
    return false;
  }
}

function initUploads() {
  ensureDir(path.join(config.uploadsDir, "posts"));
  ensureDir(path.join(config.uploadsDir, "laudos"));
}

module.exports = { saveBase64, readAsBase64, remove, initUploads, stripDataUrl, resolveStoredPath };
