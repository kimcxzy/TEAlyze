"use strict";

const { badRequest } = require("./errors");

/** Só os dígitos do CPF. */
function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

/**
 * As colunas RESPONSAVEL.cpf e PROFISSIONAL.cpf são CHAR(11) NOT NULL UNIQUE
 * no schema, então o CPF é obrigatório e precisa ter 11 dígitos.
 */
function requireCpf(value, label = "CPF") {
  const only = digits(value);
  if (only.length !== 11) {
    throw badRequest(`${label} inválido: informe os 11 dígitos (com ou sem pontuação).`);
  }
  return only;
}

/**
 * CPF opcional (paciente) — devolve null quando não informado. Se vier
 * preenchido, precisa ter 11 dígitos (antes qualquer sequência era aceita e
 * valores longos estouravam a coluna VARCHAR(14) com erro do SQL Server).
 */
function optionalCpf(value, label = "CPF") {
  const only = digits(value);
  if (!only) return null;
  if (only.length !== 11) {
    throw badRequest(`${label} inválido: informe os 11 dígitos ou deixe em branco.`);
  }
  return only;
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function trimOrEmpty(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Limita o tamanho para caber na coluna (evita erro 8152 do SQL Server). */
function clamp(value, max) {
  const text = trimOrNull(value);
  if (text === null) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function requireEmail(value) {
  const email = trimOrEmpty(value).toLowerCase();
  if (!email || !email.includes("@") || email.length > 150) {
    throw badRequest("E-mail inválido");
  }
  return email;
}

function requirePassword(value) {
  const password = typeof value === "string" ? value : "";
  if (password.length < 6) {
    throw badRequest("A senha deve ter ao menos 6 caracteres");
  }
  return password;
}

/** Converte o id textual usado pelo app ("12") no INT do banco. */
function parseId(value, label = "identificador") {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`${label} inválido`);
  }
  return id;
}

/** Igual ao parseId, mas devolve null em vez de lançar erro. */
function tryParseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Latitude/longitude cabem em DECIMAL(9,6). */
function coordOrNull(value) {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  if (n < -180 || n > 180) return null;
  return Math.round(n * 1e6) / 1e6;
}

const pad2 = (n) => String(n).padStart(2, "0");

/** Date (UTC) -> "YYYY-MM-DD" (colunas DATE chegam como meia-noite UTC). */
function formatDateOnly(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Aceita "YYYY-MM-DD" ou "DD/MM/YYYY" e devolve um Date (meia-noite UTC),
 * pronto para uma coluna DATE. Vazio -> null. Data impossível ou fora da
 * faixa 1900..hoje lança erro (a data do app nunca é no futuro).
 */
function parseDateOnly(value, label = "Data") {
  const text = trimOrEmpty(value);
  if (!text) return null;

  let y;
  let m;
  let d;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) {
    [, y, m, d] = match;
  } else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text))) {
    [, d, m, y] = match;
  } else {
    throw badRequest(`${label} inválida. Use o formato DD/MM/AAAA.`);
  }

  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real) throw badRequest(`${label} inválida: essa data não existe.`);

  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (year < 1900 || date.getTime() > today) {
    throw badRequest(`${label} inválida: use uma data entre 1900 e hoje.`);
  }
  return date;
}

/** Inteiro dentro de [min, max]; vazio -> null; fora da faixa lança erro. */
function intInRange(value, min, max, label) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw badRequest(`${label} inválido: informe um número inteiro de ${min} a ${max}.`);
  }
  return n;
}

module.exports = {
  formatDateOnly,
  parseDateOnly,
  intInRange,
  digits,
  requireCpf,
  optionalCpf,
  trimOrNull,
  trimOrEmpty,
  clamp,
  requireEmail,
  requirePassword,
  parseId,
  tryParseId,
  toNumberOrNull,
  coordOrNull,
};
