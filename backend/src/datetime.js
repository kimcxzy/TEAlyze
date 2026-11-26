"use strict";

// -----------------------------------------------------------------------
// Datas e horas.
//
// O app envia/espera horários "de parede" (ex.: 14:00 é 14:00 na tela,
// independente de fuso). Para não haver deslocamento de horas entre o
// dispositivo, o Node e o SQL Server, adotamos uma regra única:
//
//   * o driver está em modo UTC (config.db.options.useUTC = true);
//   * ao gravar, montamos um Date cujos componentes UTC são o horário
//     digitado pelo usuário;
//   * ao ler, devolvemos a string ISO SEM o sufixo "Z"
//     ("2026-03-04T14:00:00"), que o `new Date(...)` do dispositivo
//     interpreta como horário local.
//
// Resultado: o que entra é exatamente o que sai, sem conversão de fuso.
// -----------------------------------------------------------------------

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/;

/** Converte a string recebida do app em Date pronto para gravar (DATETIME2). */
function parseToDb(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();

  const m = NAIVE_RE.exec(text);
  if (m) {
    const [, y, mo, d, h, mi, s, ms] = m;
    return new Date(
      Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s || 0),
        Number(ms || 0)
      )
    );
  }

  // Strings com fuso explícito ("...Z" / "...-03:00"): aproveitamos os
  // componentes já normalizados para UTC.
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** Horário "de parede" atual do servidor, pronto para comparar/gravar. */
function nowForDb() {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    )
  );
}

/** Formata um valor vindo do banco para o app ("YYYY-MM-DDTHH:mm:ss"). */
function toApi(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19);
}

/** Soma minutos a um Date (usado para calcular o fim da sessão). */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

/** Diferença em minutos (duração da sessão). */
function diffMinutes(start, end) {
  if (!start || !end) return null;
  const a = start instanceof Date ? start : new Date(start);
  const b = end instanceof Date ? end : new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

/** Apenas a data (YYYY-MM-DD) — colunas DATE. */
function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

module.exports = { parseToDb, nowForDb, toApi, addMinutes, diffMinutes, toDateOnly };
