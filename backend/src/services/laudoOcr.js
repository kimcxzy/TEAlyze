"use strict";

// -----------------------------------------------------------------------
// LAUDO OCR — única integração externa do sistema (opcional).
//
// Se OCR_API_KEY estiver configurada, a imagem é enviada a um modelo de visão
// por uma API no formato da OpenAI. O padrão é o Google Gemini, que tem plano
// GRATUITO (chave em aistudio.google.com/apikey). Os modelos configurados são
// tentados em ordem: se um estiver esgotado (limite gratuito), aposentado ou
// indisponível, o próximo assume.
//
// Sem chave (ou se todas as tentativas falharem), nada quebra: devolvemos um
// resultado vazio com um aviso que explica o motivo, e o laudo é gravado
// normalmente no banco. Dá para reanalisar depois (POST /laudo/:id/reanalyze).
//
// A checagem de fraude roda SEMPRE, comparando com os laudos anteriores do
// mesmo cuidador — lidos do SQL Server, não do dispositivo.
// -----------------------------------------------------------------------
const config = require("../config");
const laudosRepository = require("../repositories/laudos");

const SYSTEM_PROMPT =
  "Você é um perito documentoscópico especializado em laudos médicos brasileiros " +
  "de Transtorno do Espectro Autista (TEA/F84). Sua tarefa é fazer OCR minucioso " +
  "e avaliar a autenticidade do documento com rigor.\n\n" +
  "CRITÉRIOS de VALIDADE (o documento DEVE conter TODOS para is_valid_laudo=true):\n" +
  "1. Nome completo do paciente\n" +
  "2. Diagnóstico explícito (CID F84.x, TEA, autismo, síndrome de Asperger, etc)\n" +
  "3. Nome do profissional emissor\n" +
  "4. Número de registro profissional (CRP, CRM, CREFITO, CRFa, etc)\n" +
  "5. Data de emissão\n" +
  "6. Assinatura ou carimbo visível\n\n" +
  "SINAIS DE FRAUDE a observar: edição digital óbvia, campos apagados/rasurados, " +
  "diagnóstico genérico sem CID, ausência de papel timbrado ou instituição, " +
  "profissional sem registro válido, datas inconsistentes.\n\n" +
  "Responda SEMPRE em JSON PURO (sem markdown, sem ```json) com as chaves: " +
  "is_valid_laudo (bool), confidence (int 0-100), extracted_text (string), " +
  "patient_name, patient_cpf, patient_birthdate, diagnosis, cid, professional_name, " +
  "crp_or_crm, institution, institution_address, issue_date (string|null cada), " +
  "has_signature_or_stamp (bool), fraud_indicators (string[]), warnings (string[]).";

function emptyFallback(reason) {
  return {
    is_valid_laudo: false,
    confidence: 0,
    extracted_text: "",
    patient_name: null,
    patient_cpf: null,
    patient_birthdate: null,
    diagnosis: null,
    cid: null,
    professional_name: null,
    crp_or_crm: null,
    institution: null,
    institution_address: null,
    issue_date: null,
    has_signature_or_stamp: false,
    fraud_indicators: [],
    warnings: [reason],
  };
}

/** Mensagem para o usuário conforme o motivo de a IA não ter respondido. */
function reasonMessage(reason, status) {
  switch (reason) {
    case "disabled":
      return (
        "Leitura automática por IA desativada: o servidor não tem chave configurada (OCR_API_KEY). " +
        "O laudo foi salvo; revise-o manualmente ou peça para analisar novamente depois de configurar a chave."
      );
    case "key_rejected":
      return (
        "O provedor de IA recusou a chave configurada (OCR_API_KEY inválida ou sem permissão). " +
        "O laudo foi salvo; corrija a chave no servidor e analise novamente."
      );
    case "rate_limited":
      return (
        "O limite gratuito da IA foi atingido no momento. O laudo foi salvo; " +
        "tente analisar novamente mais tarde."
      );
    case "network":
      return (
        "Não foi possível falar com o provedor de IA (rede indisponível ou tempo esgotado). " +
        "O laudo foi salvo; tente analisar novamente."
      );
    case "bad_response":
      return (
        "A IA respondeu em um formato que não deu para interpretar. " +
        "O laudo foi salvo; tente analisar novamente."
      );
    default:
      return (
        `O provedor de IA está indisponível${status ? ` (HTTP ${status})` : ""}. ` +
        "O laudo foi salvo; tente analisar novamente mais tarde."
      );
  }
}

/** Estado da integração — exposto (sem a chave!) em GET /laudo/ocr-status. */
function getOcrStatus() {
  return {
    enabled: !!config.ocr.apiKey,
    provider: config.ocr.provider,
    models: config.ocr.models,
  };
}

/** Converte o texto devolvido pelo modelo no objeto padronizado (ou null). */
function parseModelJson(content) {
  let text = content;
  if (Array.isArray(text)) {
    text = text.map((part) => (part && typeof part.text === "string" ? part.text : "")).join("");
  }
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const str = (x) => (x === undefined || x === null || x === "" ? null : String(x));
  return {
    is_valid_laudo: !!parsed.is_valid_laudo,
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
    extracted_text: parsed.extracted_text ? String(parsed.extracted_text) : "",
    patient_name: str(parsed.patient_name),
    patient_cpf: str(parsed.patient_cpf),
    patient_birthdate: str(parsed.patient_birthdate),
    diagnosis: str(parsed.diagnosis),
    cid: str(parsed.cid),
    professional_name: str(parsed.professional_name),
    crp_or_crm: str(parsed.crp_or_crm),
    institution: str(parsed.institution),
    institution_address: str(parsed.institution_address),
    issue_date: str(parsed.issue_date),
    has_signature_or_stamp: !!parsed.has_signature_or_stamp,
    fraud_indicators: Array.isArray(parsed.fraud_indicators) ? parsed.fraud_indicators.map(String) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}

/** Uma chamada HTTP ao provedor com um modelo. Lança em erro de rede/timeout. */
async function callProvider(model, base64Image, mimeType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ocr.timeoutMs);
  try {
    const response = await fetch(config.ocr.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.ocr.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analise este laudo com rigor pericial e retorne APENAS o JSON.",
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
            ],
          },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const bodyText = await response.text();
    return { ok: response.ok, status: response.status, bodyText };
  } finally {
    clearTimeout(timer);
  }
}

/** O Gemini devolve 400 (e não 401) quando a chave é inválida. */
function looksLikeBadKey(status, bodyText) {
  if (status === 401 || status === 403) return true;
  return status === 400 && /api[ _-]?key|API_KEY_INVALID|permission/i.test(bodyText || "");
}

/**
 * Chama o modelo de visão. Nunca lança.
 * @returns {{parsed: object|null, model: string|null, reason: string|null, status: number|null}}
 */
async function tryRemoteOcr(base64Image, mimeType) {
  if (!config.ocr.apiKey) return { parsed: null, model: null, reason: "disabled", status: null };

  let rateLimited = false;
  let badResponse = false;
  let lastStatus = null;

  for (const model of config.ocr.models) {
    let res;
    try {
      res = await callProvider(model, base64Image, mimeType);
    } catch (e) {
      // Sem rede / timeout: os próximos modelos falhariam do mesmo jeito.
      const why = e && e.name === "AbortError" ? "tempo esgotado" : e && e.message;
      console.warn(`[laudoOcr] ${model}: falha de rede (${why})`);
      return { parsed: null, model: null, reason: "network", status: null };
    }

    if (res.ok) {
      let content = "";
      try {
        const data = JSON.parse(res.bodyText);
        content = data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content
          : "";
      } catch {
        content = "";
      }
      const parsed = parseModelJson(content);
      if (parsed) return { parsed, model, reason: null, status: res.status };
      console.warn(`[laudoOcr] ${model}: resposta sem JSON utilizável`);
      badResponse = true;
      continue;
    }

    lastStatus = res.status;
    console.warn(`[laudoOcr] ${model} -> HTTP ${res.status}: ${String(res.bodyText).slice(0, 160)}`);
    if (looksLikeBadKey(res.status, res.bodyText)) {
      return { parsed: null, model: null, reason: "key_rejected", status: res.status };
    }
    if (res.status === 429) rateLimited = true;
    // 404/400 (modelo aposentado ou sem suporte), 429 e 5xx: tenta o próximo modelo.
  }

  const reason = rateLimited ? "rate_limited" : badResponse ? "bad_response" : "provider_error";
  return { parsed: null, model: null, reason, status: lastStatus };
}

// --- Checagem de fraude (roda sempre, com dados do SQL Server) -----------

function normText(s) {
  if (typeof s !== "string") return "";
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split("")
    .filter((c) => /[a-z0-9 ]/.test(c))
    .join("")
    .trim();
}

/** Similaridade por LCS (substituto leve do difflib.SequenceMatcher). */
function sequenceRatio(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  let prev = new Array(n + 1).fill(0);
  let cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
    cur.fill(0);
  }
  return (2 * prev[n]) / (m + n);
}

function similarity(a, b) {
  const a2 = normText(a);
  const b2 = normText(b);
  if (!a2 || !b2) return 0;
  return sequenceRatio(a2, b2);
}

function normCpf(s) {
  return typeof s === "string" ? s.replace(/\D/g, "") : "";
}

function normCrp(s) {
  return typeof s === "string" ? s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
}

async function runFraudChecks(user, parsed, excludeLaudoId = null) {
  const result = {
    patient_name_similarity: 0,
    patient_name_match: false,
    expected_patient_name: user.patient_name ?? null,
    patient_cpf_match: null,
    expected_patient_cpf: user.patient_cpf ?? null,
    professional_consistency: "first_laudo",
    previous_professionals: [],
    address_consistency: "first_laudo",
    previous_institutions: [],
    fraud_signals: [],
    fraud_risk: "low",
  };

  // 1. Nome do paciente
  const expectedName = user.patient_name || "";
  const gotName = parsed.patient_name || "";
  const sim = similarity(gotName, expectedName);
  result.patient_name_similarity = Math.round(sim * 100) / 100;
  if (gotName) {
    result.patient_name_match = sim >= 0.7;
    if (sim < 0.7) {
      result.fraud_signals.push(
        `Nome do paciente no laudo ('${gotName}') diverge do cadastro ('${expectedName}').`
      );
    }
  } else {
    result.fraud_signals.push("Laudo sem nome de paciente extraído.");
  }

  // 2. CPF do paciente
  const gotCpf = normCpf(parsed.patient_cpf);
  const expectedCpf = normCpf(user.patient_cpf);
  if (gotCpf && expectedCpf) {
    result.patient_cpf_match = gotCpf === expectedCpf;
    if (!result.patient_cpf_match) {
      result.fraud_signals.push("CPF do paciente no laudo não confere com o cadastro.");
    }
  }

  // 3. Comparação com laudos válidos anteriores (SQL Server)
  const prevRows = await laudosRepository.listValidForUser(Number(user.id), 20, excludeLaudoId);
  const prev = prevRows.map((r) => laudosRepository.toApi(r));
  if (prev.length > 0) {
    const curCrp = normCrp(parsed.crp_or_crm);
    const curPro = parsed.professional_name || "";
    let proSeenMatch = false;
    for (const p of prev) {
      const pCrp = normCrp(p.crp_or_crm);
      if (curCrp && pCrp && curCrp === pCrp) proSeenMatch = true;
      else if (similarity(curPro, p.professional_name) >= 0.85) proSeenMatch = true;
    }
    result.previous_professionals = prev.map((p) => ({
      name: p.professional_name,
      crp_or_crm: p.crp_or_crm,
    }));
    result.professional_consistency = proSeenMatch ? "same" : "different";
    if (!proSeenMatch && (curCrp || curPro)) {
      result.fraud_signals.push(
        "Profissional emissor diferente de laudos anteriores — investigar se troca é legítima."
      );
    }

    const curInst = parsed.institution || "";
    const curAddr = parsed.institution_address || "";
    let addrMatch = false;
    for (const p of prev) {
      if (similarity(curInst, p.institution) >= 0.75) addrMatch = true;
      if (similarity(curAddr, p.institution_address) >= 0.75) addrMatch = true;
    }
    result.previous_institutions = prev.map((p) => ({
      institution: p.institution,
      address: p.institution_address,
    }));
    result.address_consistency = addrMatch ? "same" : "different";
    if (!addrMatch && (curInst || curAddr)) {
      result.fraud_signals.push("Instituição/endereço diferente de laudos anteriores.");
    }
  }

  // 4. Indicadores reportados pela IA
  for (const ind of parsed.fraud_indicators || []) {
    result.fraud_signals.push(`IA: ${ind}`);
  }

  // 5. Risco agregado
  const signals = result.fraud_signals.length;
  result.fraud_risk = signals === 0 ? "low" : signals <= 2 ? "medium" : "high";

  // 6. Divergência crítica de nome invalida o laudo
  if (gotName && result.patient_name_similarity < 0.4) {
    parsed.is_valid_laudo = false;
    result.fraud_signals.push("Divergência crítica de nome — validação automática rejeitada.");
    result.fraud_risk = "high";
  }

  return result;
}

/**
 * Ponto de entrada das rotas POST /laudo/analyze e /laudo/:id/reanalyze.
 * `excludeLaudoId`: ao reanalisar, o próprio laudo não conta como "anterior".
 */
async function analyzeLaudo({ imageBase64, mimeType, currentUser, excludeLaudoId = null }) {
  const remote = await tryRemoteOcr(imageBase64, mimeType);
  const parsed = remote.parsed || emptyFallback(reasonMessage(remote.reason, remote.status));

  const crossCheck = await runFraudChecks(currentUser, parsed, excludeLaudoId);
  return {
    ...parsed,
    cross_check: crossCheck,
    ai_used: !!remote.parsed,
    ai_model: remote.model,
    ai_reason: remote.reason,
  };
}

module.exports = {
  analyzeLaudo,
  getOcrStatus,
  tryRemoteOcr,
  parseModelJson,
  reasonMessage,
  similarity,
};
