"use strict";

// -----------------------------------------------------------------------
// Confere se a leitura de laudos por IA está funcionando — sem enviar um
// laudo de verdade e sem precisar do banco.
//
// Uso (dentro de backend/):        npm run test-ocr
// Dentro do Docker:                docker compose exec backend npm run test-ocr
//
// Manda uma imagem de teste (um degradê, sem texto) ao provedor configurado.
// Se a chave e a conexão estiverem certas, o modelo responde — mesmo dizendo
// que "não é um laudo", o que é o esperado aqui.
// -----------------------------------------------------------------------
const config = require("../config");
const { tryRemoteOcr, reasonMessage } = require("../services/laudoOcr");
const { makeDemoPng } = require("../services/demoImage");

async function main() {
  console.log("=== Teste da leitura de laudos por IA ===");
  console.log(`provedor : ${config.ocr.provider}`);
  console.log(`endereço : ${config.ocr.apiUrl}`);
  console.log(`modelos  : ${config.ocr.models.join(", ")}`);
  console.log(`chave    : ${config.ocr.apiKey ? `configurada (${config.ocr.apiKey.length} caracteres)` : "NÃO configurada"}`);

  if (!config.ocr.apiKey) {
    console.log("\n✗ " + reasonMessage("disabled"));
    console.log("\nComo configurar (grátis): https://aistudio.google.com/apikey");
    console.log("Depois coloque OCR_API_KEY=... no arquivo .env e reinicie o backend.");
    process.exitCode = 1;
    return;
  }

  console.log("\nEnviando imagem de teste...");
  const started = Date.now();
  const result = await tryRemoteOcr(makeDemoPng().toString("base64"), "image/png");
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  if (result.parsed) {
    console.log(`\n✓ A IA respondeu em ${seconds}s usando o modelo "${result.model}".`);
    console.log("  Está tudo certo: os laudos enviados pelo app serão lidos automaticamente.");
    return;
  }

  console.log(`\n✗ Falhou (${seconds}s): ${reasonMessage(result.reason, result.status)}`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
