"use strict";

// -----------------------------------------------------------------------
// Resumo de documentos de uma família, para o PROFISSIONAL.
//
// Princípios (decididos de propósito, por causa da natureza dos dados):
//   - NÃO existe nota nem pontuação guardada: o resumo é calculado na hora
//     a partir das análises que já existem, então não há nada para manipular
//     nem para ficar desatualizado.
//   - É um resumo de DOCUMENTOS, não um julgamento sobre a pessoa. Mostra
//     contagens e os motivos objetivos de alertas fortes.
//   - Só alerta FORTE conta (risco "alto" da checagem cruzada). Pontos de
//     atenção leves não aparecem para o profissional.
//   - Laudo que a IA NÃO leu (sem chave, sem cota, sem rede) não entra como
//     "com alerta": fica separado como "aguardando leitura".
//   - O profissional nunca recebe a imagem, o texto do laudo, nome, CPF ou
//     diagnóstico: só contagens, motivos genéricos e a explicação da família.
//
// Recebe os laudos no formato da API (`laudosRepository.toApi`).
// -----------------------------------------------------------------------

/** Máximo de alertas detalhados (os mais recentes). */
const MAX_ALERTS = 3;

/** A IA realmente leu este documento? Laudos antigos (ai_read nulo) usam um indício. */
function wasReadByAi(laudo) {
  if (laudo.ai_read === true) return true;
  if (laudo.ai_read === false) return false;
  return !!(laudo.extracted_text || (laudo.confidence || 0) > 0 || laudo.patient_name);
}

/** É um alerta forte? (só risco alto, em laudo lido pela IA) */
function isStrongAlert(laudo) {
  return wasReadByAi(laudo) && !!laudo.cross_check && laudo.cross_check.fraud_risk === "high";
}

/** Motivos objetivos e genéricos (sem dados do documento). */
function alertReasons(laudo) {
  const cc = laudo.cross_check || {};
  const reasons = [];
  if (cc.patient_name_match === false) reasons.push("Nome no laudo diferente do cadastro do paciente");
  if (cc.patient_cpf_match === false) reasons.push("CPF no laudo diferente do cadastro do paciente");
  if (cc.professional_consistency === "different") reasons.push("Profissional diferente dos laudos anteriores");
  if (cc.address_consistency === "different") reasons.push("Instituição ou endereço diferente dos laudos anteriores");
  if (!laudo.is_valid_laudo) reasons.push("Documento não reconhecido como laudo");
  if (!reasons.length) reasons.push("Vários sinais de inconsistência no documento");
  return reasons;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {Array} laudos laudos do cuidador, mais recentes primeiro
 */
function summarize(laudos) {
  const list = Array.isArray(laudos) ? laudos : [];
  let withAlerts = 0;
  let withoutAlerts = 0;
  let notRead = 0;
  const alerts = [];

  for (const laudo of list) {
    if (!wasReadByAi(laudo)) {
      notRead += 1;
    } else if (isStrongAlert(laudo)) {
      withAlerts += 1;
      if (alerts.length < MAX_ALERTS) {
        alerts.push({
          sent_at: laudo.created_at,
          reasons: alertReasons(laudo),
          explanation: laudo.explanation || "",
        });
      }
    } else {
      withoutAlerts += 1;
    }
  }

  const total = list.length;
  const parts = [plural(total, "laudo enviado", "laudos enviados")];
  if (total > 0) {
    parts.push(plural(withoutAlerts, "sem alerta", "sem alertas"));
    if (withAlerts) parts.push(plural(withAlerts, "com alerta", "com alertas"));
    if (notRead) parts.push(`${notRead} aguardando leitura`);
  }

  return {
    total,
    read_by_ai: withAlerts + withoutAlerts,
    without_alerts: withoutAlerts,
    with_alerts: withAlerts,
    not_read: notRead,
    last_sent_at: total ? list[0].created_at : null,
    alerts,
    label: parts.join(" · "),
  };
}

module.exports = { summarize, wasReadByAi, isStrongAlert, alertReasons, MAX_ALERTS };
