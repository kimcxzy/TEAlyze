"use strict";

// -----------------------------------------------------------------------
// Teste do OCR por IA (src/services/laudoOcr.js).
//
// Sobe um servidor HTTP local que imita a API compatível com a OpenAI usada
// pelo Gemini e confere: formato da requisição, fallback entre modelos,
// mensagens de erro específicas (limite gratuito, chave inválida, rede...)
// e a checagem de fraude em cima da resposta da IA.
//
// Não usa a internet nem uma chave de verdade.
// Uso: node test/ocr.js
// -----------------------------------------------------------------------
const assert = require("assert");
const http = require("http");
const path = require("path");

process.env.OCR_API_KEY = "";

function stub(relativePath, exports) {
  const resolved = require.resolve(path.join(__dirname, "..", "src", relativePath));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

// A checagem de fraude lê laudos anteriores do banco: aqui não há nenhum.
stub("repositories/laudos.js", {
  listValidForUser: async () => [],
  toApi: (row) => row,
});

const config = require("../src/config");
const { analyzeLaudo, getOcrStatus, parseModelJson } = require("../src/services/laudoOcr");

// --- Provedor simulado ----------------------------------------------------
const calls = [];
let behavior = {}; // modelo -> { status, body?, delayMs? }

const GOOD_JSON = {
  is_valid_laudo: true,
  confidence: 91,
  extracted_text: "LAUDO NEUROPSICOLÓGICO ...",
  patient_name: "Lucas Souza",
  patient_cpf: "555.666.777-88",
  patient_birthdate: "10/03/2018",
  diagnosis: "Transtorno do Espectro Autista",
  cid: "F84.0",
  professional_name: "Dra. Ana Silva",
  crp_or_crm: "CRP 06/123456",
  institution: "Clínica Girassol",
  institution_address: "Av. Paulista, 1000",
  issue_date: "02/03/2026",
  has_signature_or_stamp: true,
  fraud_indicators: [],
  warnings: [],
};

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    calls.push({ url: req.url, auth: req.headers.authorization, body });
    const rule = behavior[body.model] || { status: 500, body: "sem regra" };
    const send = () => {
      res.writeHead(rule.status, { "Content-Type": "application/json" });
      res.end(typeof rule.body === "string" ? rule.body : JSON.stringify(rule.body ?? {}));
    };
    if (rule.delayMs) setTimeout(send, rule.delayMs);
    else send();
  });
});

const completion = (content) => ({ choices: [{ message: { role: "assistant", content } }] });
const okJson = (obj, { fenced = false } = {}) => ({
  status: 200,
  body: completion(fenced ? "```json\n" + JSON.stringify(obj) + "\n```" : JSON.stringify(obj)),
});

const USER = { id: "5", patient_name: "Lucas Souza", patient_cpf: "55566677788" };
const IMG = Buffer.from("fake-image").toString("base64");

function configure({ models, key = "AIza-test-key" }) {
  config.ocr.apiKey = key;
  config.ocr.models = models;
  config.ocr.timeoutMs = 3000;
  calls.length = 0;
}

// --- Verificações ---------------------------------------------------------
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
  } catch (e) {
    results.push(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

async function main() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  config.ocr.apiUrl = `http://127.0.0.1:${server.address().port}/v1beta/openai/chat/completions`;

  const realWarn = console.warn;
  console.warn = () => {}; // silencia os avisos esperados do serviço

  try {
    await check("sem chave: não chama a internet e explica o motivo", async () => {
      configure({ models: ["m1"], key: "" });
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(calls.length, 0);
      assert.strictEqual(r.ai_used, false);
      assert.strictEqual(r.ai_reason, "disabled");
      assert.strictEqual(r.is_valid_laudo, false);
      assert.ok(r.warnings[0].includes("desativada") && r.warnings[0].includes("OCR_API_KEY"));
      assert.ok(r.cross_check, "checagem de fraude roda mesmo sem IA");
    });

    await check("getOcrStatus nunca expõe a chave", async () => {
      configure({ models: ["m1", "m2"] });
      const status = getOcrStatus();
      assert.strictEqual(status.enabled, true);
      assert.deepStrictEqual(status.models, ["m1", "m2"]);
      assert.ok(!JSON.stringify(status).includes("AIza-test-key"));
    });

    await check("formato da requisição: Bearer, modelo, imagem em data URL e prompt", async () => {
      configure({ models: ["good"] });
      behavior = { good: okJson(GOOD_JSON) };
      await analyzeLaudo({ imageBase64: IMG, mimeType: "image/png", currentUser: USER });
      assert.strictEqual(calls.length, 1);
      const c = calls[0];
      assert.strictEqual(c.url, "/v1beta/openai/chat/completions");
      assert.strictEqual(c.auth, "Bearer AIza-test-key");
      assert.strictEqual(c.body.model, "good");
      assert.strictEqual(c.body.temperature, 0);
      assert.strictEqual(c.body.messages[0].role, "system");
      const userParts = c.body.messages[1].content;
      assert.strictEqual(userParts[0].type, "text");
      assert.strictEqual(userParts[1].type, "image_url");
      assert.strictEqual(userParts[1].image_url.url, `data:image/png;base64,${IMG}`);
    });

    await check("resposta válida da IA vira análise completa (JSON em bloco ```json também)", async () => {
      configure({ models: ["good"] });
      behavior = { good: okJson(GOOD_JSON, { fenced: true }) };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(r.ai_used, true);
      assert.strictEqual(r.ai_model, "good");
      assert.strictEqual(r.is_valid_laudo, true);
      assert.strictEqual(r.confidence, 91);
      assert.strictEqual(r.cid, "F84.0");
      assert.strictEqual(r.crp_or_crm, "CRP 06/123456");
      assert.strictEqual(r.cross_check.patient_name_match, true);
      assert.strictEqual(r.cross_check.patient_cpf_match, true);
      assert.strictEqual(r.cross_check.fraud_risk, "low");
    });

    await check("fallback: 404 (modelo aposentado) -> 429 (limite) -> 200 usa o terceiro modelo", async () => {
      configure({ models: ["old", "limited", "good"] });
      behavior = {
        old: { status: 404, body: { error: { message: "model not found" } } },
        limited: { status: 429, body: { error: { message: "quota" } } },
        good: okJson(GOOD_JSON),
      };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.deepStrictEqual(calls.map((c) => c.body.model), ["old", "limited", "good"]);
      assert.strictEqual(r.ai_used, true);
      assert.strictEqual(r.ai_model, "good");
    });

    await check("todos os modelos no limite gratuito -> mensagem de limite", async () => {
      configure({ models: ["a", "b"] });
      behavior = { a: { status: 429, body: "x" }, b: { status: 429, body: "x" } };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(calls.length, 2);
      assert.strictEqual(r.ai_reason, "rate_limited");
      assert.ok(r.warnings[0].includes("limite gratuito"));
      assert.strictEqual(r.is_valid_laudo, false);
    });

    await check("chave inválida (400 do Gemini) para na hora, sem tentar outros modelos", async () => {
      configure({ models: ["a", "b"] });
      behavior = {
        a: { status: 400, body: { error: { message: "API key not valid. Please pass a valid API key." } } },
        b: okJson(GOOD_JSON),
      };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(r.ai_reason, "key_rejected");
      assert.ok(r.warnings[0].includes("recusou a chave"));
    });

    await check("HTTP 401/403 também são tratados como chave recusada", async () => {
      for (const status of [401, 403]) {
        configure({ models: ["a", "b"] });
        behavior = { a: { status, body: "denied" }, b: okJson(GOOD_JSON) };
        const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
        assert.strictEqual(r.ai_reason, "key_rejected", `status ${status}`);
        assert.strictEqual(calls.length, 1);
      }
    });

    await check("400 que NÃO é de chave (modelo sem suporte) segue para o próximo modelo", async () => {
      configure({ models: ["a", "good"] });
      behavior = { a: { status: 400, body: { error: { message: "unsupported model" } } }, good: okJson(GOOD_JSON) };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(r.ai_used, true);
      assert.strictEqual(calls.length, 2);
    });

    await check("erro 500 em todos -> mensagem com o código HTTP", async () => {
      configure({ models: ["a", "b"] });
      behavior = { a: { status: 503, body: "down" }, b: { status: 500, body: "down" } };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(r.ai_reason, "provider_error");
      assert.ok(r.warnings[0].includes("HTTP 500"), r.warnings[0]);
    });

    await check("resposta 200 sem JSON utilizável tenta o próximo e, se falhar, explica", async () => {
      configure({ models: ["a", "b"] });
      behavior = {
        a: { status: 200, body: completion("Desculpe, não consigo ler a imagem.") },
        b: { status: 200, body: completion("{ isto não é json }") },
      };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(calls.length, 2);
      assert.strictEqual(r.ai_reason, "bad_response");
      assert.ok(r.warnings[0].includes("formato"));
    });

    await check("timeout de rede -> mensagem de rede e não tenta os demais modelos", async () => {
      configure({ models: ["slow", "good"] });
      config.ocr.timeoutMs = 150;
      behavior = { slow: { ...okJson(GOOD_JSON), delayMs: 800 }, good: okJson(GOOD_JSON) };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(r.ai_reason, "network");
      assert.strictEqual(calls.length, 1);
      assert.ok(r.warnings[0].includes("rede"));
    });

    await check("nome do paciente muito diferente do cadastro invalida o laudo (antifraude)", async () => {
      configure({ models: ["good"] });
      behavior = { good: okJson({ ...GOOD_JSON, patient_name: "Roberto Carlos Pereira" }) };
      const r = await analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER });
      assert.strictEqual(r.ai_used, true);
      assert.strictEqual(r.is_valid_laudo, false);
      assert.strictEqual(r.cross_check.fraud_risk, "high");
    });

    await check("reanálise ignora o próprio laudo na comparação com laudos anteriores", async () => {
      let received = "nunca chamado";
      stub("repositories/laudos.js", {
        listValidForUser: async (id, limit, excludeId) => {
          received = excludeId;
          return [];
        },
        toApi: (row) => row,
      });
      delete require.cache[require.resolve("../src/services/laudoOcr")];
      const fresh = require("../src/services/laudoOcr");
      configure({ models: ["good"] });
      behavior = { good: okJson(GOOD_JSON) };
      await fresh.analyzeLaudo({ imageBase64: IMG, mimeType: "image/jpeg", currentUser: USER, excludeLaudoId: 7 });
      assert.strictEqual(received, 7);
    });

    await check("parseModelJson aceita texto com lixo ao redor, conteúdo em partes e limita a confiança", async () => {
      const a = parseModelJson('Claro! Aqui está:\n{"is_valid_laudo": true, "confidence": 250}\nEspero ter ajudado.');
      assert.strictEqual(a.is_valid_laudo, true);
      assert.strictEqual(a.confidence, 100);
      const b = parseModelJson([{ type: "text", text: '{"is_valid_laudo": false,' }, { type: "text", text: '"cid": "F84"}' }]);
      assert.strictEqual(b.cid, "F84");
      assert.strictEqual(parseModelJson(""), null);
      assert.strictEqual(parseModelJson("sem json"), null);
      assert.strictEqual(parseModelJson("{quebrado"), null);
    });
  } finally {
    console.warn = realWarn;
    server.close();
  }

  console.log("Teste do OCR (provedor de IA simulado):\n");
  results.forEach((line) => console.log(line));
  const falhas = results.filter((l) => l.includes("FAIL")).length;
  console.log(`\n${results.length - falhas}/${results.length} verificações passaram.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
