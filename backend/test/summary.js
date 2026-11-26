"use strict";

// -----------------------------------------------------------------------
// Teste do resumo de documentos exibido ao profissional
// (src/services/laudoSummary.js). Cada verificação corresponde a um dos
// princípios de proteção da família: nada de nota, só alerta forte, laudo
// não lido pela IA não acusa ninguém, e nenhum dado do documento vaza.
//
// Uso: node test/summary.js
// -----------------------------------------------------------------------
const assert = require("assert");
const { summarize, wasReadByAi, alertReasons, MAX_ALERTS } = require("../src/services/laudoSummary");

let seq = 0;
/** Laudo no formato da API. */
function laudo(over = {}) {
  seq += 1;
  return {
    id: String(seq),
    is_valid_laudo: true,
    confidence: 90,
    extracted_text: "TEXTO SIGILOSO DO LAUDO",
    patient_name: "Lucas Souza",
    patient_cpf: "555.666.777-88",
    diagnosis: "Transtorno do Espectro Autista",
    cid: "F84.0",
    professional_name: "Dra. Ana Silva",
    ai_read: true,
    explanation: "",
    created_at: `2026-10-${String(10 + seq).padStart(2, "0")}T10:00:00`,
    cross_check: { fraud_risk: "low", patient_name_match: true, patient_cpf_match: true, fraud_signals: [] },
    ...over,
  };
}
const high = (over = {}) =>
  laudo({
    is_valid_laudo: false,
    cross_check: {
      fraud_risk: "high",
      patient_name_match: false,
      patient_cpf_match: null,
      professional_consistency: "different",
      address_consistency: "first_laudo",
      fraud_signals: ["Nome do paciente muito diferente do cadastro", "texto sigiloso"],
    },
    ...over,
  });
const notRead = (over = {}) =>
  laudo({ ai_read: false, is_valid_laudo: false, confidence: 0, extracted_text: "", patient_name: null, cross_check: { fraud_risk: "medium", patient_name_match: false, fraud_signals: ["Laudo sem nome de paciente extraído"] }, ...over });

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push(`  ok   ${name}`);
  } catch (e) {
    results.push(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

check("sem laudos: tudo zerado e texto claro", () => {
  const s = summarize([]);
  assert.deepStrictEqual([s.total, s.with_alerts, s.without_alerts, s.not_read, s.last_sent_at], [0, 0, 0, 0, null]);
  assert.strictEqual(s.label, "0 laudos enviados");
  assert.deepStrictEqual(s.alerts, []);
  assert.strictEqual(summarize(undefined).total, 0);
});

check("NÃO existe nota nem pontuação no resumo", () => {
  const s = summarize([laudo(), high(), notRead()]);
  const json = JSON.stringify(s).toLowerCase();
  for (const word of ["score", "nota", "pontua", "rating", "honest"]) assert.ok(!json.includes(word), word);
  assert.ok(Object.values(s).every((v) => typeof v !== "number" || Number.isInteger(v)), "só contagens inteiras");
});

check("exemplo do texto: 3 enviados, 2 sem alerta, 1 com alerta", () => {
  const s = summarize([high(), laudo(), laudo()]);
  assert.strictEqual(s.label, "3 laudos enviados · 2 sem alertas · 1 com alerta");
  assert.deepStrictEqual([s.total, s.without_alerts, s.with_alerts], [3, 2, 1]);
});

check("singular e plural corretos", () => {
  assert.strictEqual(summarize([laudo()]).label, "1 laudo enviado · 1 sem alerta");
  assert.strictEqual(summarize([laudo(), laudo()]).label, "2 laudos enviados · 2 sem alertas");
});

check("só alerta FORTE conta: risco médio NÃO vira alerta", () => {
  const medio = laudo({ cross_check: { fraud_risk: "medium", patient_name_match: false, fraud_signals: ["a"] } });
  const s = summarize([medio, laudo()]);
  assert.strictEqual(s.with_alerts, 0);
  assert.strictEqual(s.without_alerts, 2);
  assert.deepStrictEqual(s.alerts, []);
});

check("laudo NÃO lido pela IA não acusa ninguém (fica 'aguardando leitura')", () => {
  const s = summarize([notRead(), notRead(), laudo()]);
  assert.strictEqual(s.with_alerts, 0);
  assert.strictEqual(s.not_read, 2);
  assert.strictEqual(s.without_alerts, 1);
  assert.strictEqual(s.label, "3 laudos enviados · 1 sem alerta · 2 aguardando leitura");
});

check("mesmo com risco alto, laudo que a IA não leu NÃO conta como alerta", () => {
  const s = summarize([notRead({ cross_check: { fraud_risk: "high", fraud_signals: ["x", "y", "z"] } })]);
  assert.strictEqual(s.with_alerts, 0);
  assert.strictEqual(s.not_read, 1);
});

check("laudo antigo (ai_read nulo): usa indício de leitura (texto/confiança/nome)", () => {
  assert.strictEqual(wasReadByAi(laudo({ ai_read: null })), true);
  assert.strictEqual(wasReadByAi(laudo({ ai_read: null, extracted_text: "", confidence: 0, patient_name: null })), false);
  assert.strictEqual(wasReadByAi(laudo({ ai_read: true, extracted_text: "" , confidence: 0, patient_name: null })), true);
  assert.strictEqual(wasReadByAi(laudo({ ai_read: false })), false);
});

check("motivos do alerta são objetivos e genéricos", () => {
  const r = alertReasons(high());
  assert.ok(r.includes("Nome no laudo diferente do cadastro do paciente"));
  assert.ok(r.includes("Profissional diferente dos laudos anteriores"));
  assert.ok(r.includes("Documento não reconhecido como laudo"));
  const cpf = alertReasons(high({ cross_check: { fraud_risk: "high", patient_name_match: true, patient_cpf_match: false, professional_consistency: "same", address_consistency: "different" } }));
  assert.ok(cpf.includes("CPF no laudo diferente do cadastro do paciente"));
  assert.ok(cpf.includes("Instituição ou endereço diferente dos laudos anteriores"));
  assert.deepStrictEqual(alertReasons(laudo({ cross_check: { fraud_risk: "high" } })), ["Vários sinais de inconsistência no documento"]);
});

check("NENHUM dado do documento vaza para o profissional", () => {
  const s = summarize([high({ explanation: "Foi o médico antigo" }), laudo()]);
  const json = JSON.stringify(s);
  for (const secret of ["SIGILOSO", "Lucas", "555.666", "Autista", "F84", "Ana Silva", "texto sigiloso", "image"]) {
    assert.ok(!json.includes(secret), `vazou: ${secret}`);
  }
  assert.deepStrictEqual(Object.keys(s.alerts[0]).sort(), ["explanation", "reasons", "sent_at"]);
});

check("a explicação da família chega junto do alerta", () => {
  const s = summarize([high({ explanation: "O laudo está no nome da mãe" })]);
  assert.strictEqual(s.alerts[0].explanation, "O laudo está no nome da mãe");
  assert.strictEqual(summarize([high()]).alerts[0].explanation, "");
});

check(`no máximo ${MAX_ALERTS} alertas detalhados, mas a contagem é total`, () => {
  const s = summarize([high(), high(), high(), high(), high()]);
  assert.strictEqual(s.with_alerts, 5);
  assert.strictEqual(s.alerts.length, MAX_ALERTS);
  assert.strictEqual(s.label, "5 laudos enviados · 0 sem alertas · 5 com alertas");
});

check("data do último envio vem do mais recente (primeiro da lista)", () => {
  const a = laudo({ created_at: "2026-10-20T09:00:00" });
  const b = laudo({ created_at: "2026-09-01T09:00:00" });
  assert.strictEqual(summarize([a, b]).last_sent_at, "2026-10-20T09:00:00");
});

check("não modifica os laudos recebidos", () => {
  const input = [high(), laudo()];
  const copy = JSON.stringify(input);
  summarize(input);
  assert.strictEqual(JSON.stringify(input), copy);
});

console.log("Teste do resumo de documentos (profissional):\n");
results.forEach((l) => console.log(l));
const bad = results.filter((l) => l.includes("FAIL")).length;
console.log(`\n${results.length - bad}/${results.length} verificações passaram.\n`);
