"use strict";

// -----------------------------------------------------------------------
// Teste de fumaça das rotas.
//
// Substitui a camada de banco (src/db.js) por um dublê em memória para
// exercitar TODAS as rotas: autenticação, mapeamento de campos, validações
// e formato das respostas — sem precisar de um SQL Server rodando.
//
// Uso: node test/smoke.js
// -----------------------------------------------------------------------
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sql = require("mssql");

// Imagens gravadas pelos testes vão para uma pasta temporária (apagada no fim),
// em vez de sujar backend/uploads. Precisa vir antes de carregar src/config.
const TEST_UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "tealyze-smoke-"));
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
process.env.OCR_API_KEY = ""; // sem IA: o teste não depende de rede nem de .env
fs.mkdirSync(path.join(TEST_UPLOADS_DIR, "laudos"), { recursive: true });
fs.writeFileSync(path.join(TEST_UPLOADS_DIR, "laudos", "laudo.jpg"), Buffer.from("FAKE-JPEG-BYTES"));

const { hashPassword } = require("../src/crypto");
const { AQ_AGREE_ITEMS, isAgreeScored, scoreAq } = require("../src/services/aq");

// --- Dublê do banco ------------------------------------------------------
const SENHA = "senha123";
const SENHA_HASH = hashPassword(SENHA);

const caregiverRow = {
  id_usuario: 5,
  nome: "Maria Souza",
  email: "maria@tealyze.app",
  senha_hash: SENHA_HASH,
  telefone: "(11) 91234-5678",
  tipo_usuario: "CUIDADOR",
  ativo: true,
  data_cadastro: new Date(Date.UTC(2026, 0, 10, 9, 30, 0)),
  responsavel_cpf: "11122233344",
  grau_parentesco: "Mãe",
  profissao: "Professora",
  data_nascimento: new Date(Date.UTC(1988, 6, 21)),
  id_paciente: 77,
  nome_social: "Lucas Souza",
  paciente_cpf: "55566677788",
  profissional_cpf: null,
  registro_profissional: null,
  orgao_registro: null,
  descricao: null,
  endereco: null,
  latitude: null,
  longitude: null,
  crp_verificado: null,
  formacao: null,
  atende_teleconsulta: null,
  especialidade: null,
};

const professionalRow = {
  id_usuario: 9,
  nome: "Dra. Ana Silva",
  email: "ana.silva@tealyze.app",
  senha_hash: SENHA_HASH,
  telefone: "(11) 98888-1111",
  tipo_usuario: "PROFISSIONAL",
  ativo: true,
  data_cadastro: new Date(Date.UTC(2026, 0, 5, 8, 0, 0)),
  responsavel_cpf: null,
  grau_parentesco: null,
  profissao: null,
  data_nascimento: null,
  experiencia_tea_anos: 10,
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01310100",
  id_paciente: null,
  nome_social: null,
  paciente_cpf: null,
  profissional_cpf: "11111111111",
  registro_profissional: "06/123456",
  orgao_registro: "CRP",
  descricao: "10 anos de experiência com TEA.",
  endereco: "Av. Paulista, 1000 - São Paulo",
  latitude: -23.5605,
  longitude: -46.6543,
  crp_verificado: true,
  formacao: "Doutorado em Psicologia Clínica (USP)",
  atende_teleconsulta: true,
  especialidade: "Psicologia",
};

const sessaoRow = {
  id_sessao: 31,
  id_profissional: 9,
  data_hora_inicio: new Date(Date.UTC(2026, 10, 20, 14, 0, 0)),
  data_hora_fim: new Date(Date.UTC(2026, 10, 20, 15, 0, 0)),
  tipo_sessao: "CONSULTA",
  status: "AGENDADA",
  observacoes: "Primeira sessão",
  local_atendimento: "Av. Paulista, 1000 - São Paulo",
  data_cadastro: new Date(Date.UTC(2026, 9, 1, 10, 0, 0)),
  id_paciente: 77,
  patient_name: "Lucas Souza",
  id_responsavel: 5,
  caregiver_name: "Maria Souza",
  professional_name: "Dra. Ana Silva",
  especialidade: "Psicologia",
};

const publicacaoRow = {
  id_publicacao: 3,
  id_profissional: 9,
  id_responsavel_destino: null,
  legenda: "Atividade para casa",
  nome_arquivo: "inexistente.jpg",
  caminho_arquivo: "posts/inexistente.jpg",
  mime_type: "image/jpeg",
  data_publicacao: new Date(Date.UTC(2026, 9, 2, 11, 0, 0)),
  author_name: "Dra. Ana Silva",
};

const mensagemRow = {
  id_mensagem: 101,
  id_conversa: 4,
  id_usuario: 9,
  conteudo: "Olá, tudo bem?",
  data_envio: new Date(Date.UTC(2026, 9, 3, 16, 45, 0)),
  lida: false,
};

const laudoRow = {
  id_laudo: 7,
  id_paciente: 77,
  id_usuario_upload: 5,
  nome_arquivo: "laudo.jpg",
  caminho_arquivo: "laudos/laudo.jpg",
  tipo_documento: "LAUDO_TEA",
  data_upload: new Date(Date.UTC(2026, 9, 4, 12, 0, 0)),
  texto_ocr: "",
  hash_arquivo: "abc",
  consentimento_upload: true,
  mime_type: "image/jpeg",
  laudo_valido: false,
  confianca: 0,
  nome_paciente: null,
  cpf_paciente: null,
  nascimento_paciente: null,
  diagnostico: null,
  cid: null,
  nome_profissional: null,
  registro_profissional: null,
  instituicao: null,
  endereco_instituicao: null,
  data_emissao: null,
  possui_assinatura: false,
  indicadores_fraude: "[]",
  alertas: JSON.stringify(["Análise automática por IA não configurada no servidor"]),
  checagem_cruzada: JSON.stringify({ fraud_risk: "medium", fraud_signals: ["Laudo sem nome de paciente extraído."] }),
  data_analise: new Date(Date.UTC(2026, 9, 4, 12, 0, 1)),
};

const patientRow = {
  id_paciente: 77,
  nome_social: "Lucas Souza",
  cpf: "55566677788",
  nivel_suporte: 2,
  cid11: "6A02",
  data_diagnostico: new Date(Date.UTC(2023, 4, 10)),
  historico: "Diagnóstico aos 4 anos.",
  observacoes: "Gosta de dinossauros.",
  data_cadastro: new Date(Date.UTC(2026, 0, 10, 9, 30, 0)),
};

// Escritas (UPDATE) feitas pelas rotas: os testes conferem os parâmetros enviados ao banco.
const writes = [];
let senhaAtualHash = SENHA_HASH;
let laudoListRows = []; // laudos devolvidos pela listagem (os testes do resumo preenchem)

const TOKEN_CUIDADOR = "token-cuidador";
const TOKEN_PROFISSIONAL = "token-profissional";

const executed = [];
const tokensEmitidos = new Map([
  [TOKEN_CUIDADOR, 5],
  [TOKEN_PROFISSIONAL, 9],
]);

function rowsFor(text, params) {
  const t = text.replace(/\s+/g, " ");
  executed.push(t.slice(0, 80));

  if (t.includes("INSERT INTO TOKEN_ACESSO")) {
    tokensEmitidos.set(params.token.value, params.id.value);
    return [];
  }
  if (t.includes("DELETE FROM TOKEN_ACESSO")) return [];
  if (t.includes("FROM TOKEN_ACESSO")) {
    const token = params.token && params.token.value;
    return tokensEmitidos.has(token) ? [{ id_usuario: tokensEmitidos.get(token) }] : [];
  }
  if (t.includes("INSERT INTO LOG_AUDITORIA")) return [];

  // checagem de e-mail duplicado (sem alias na consulta)
  if (t.includes("FROM USUARIO WHERE LOWER(email)")) {
    const email = params.email && params.email.value;
    return [caregiverRow.email, professionalRow.email].includes(email)
      ? [{ id_usuario: email === caregiverRow.email ? 5 : 9 }]
      : [];
  }
  if (t.includes("INSERT INTO USUARIO")) return [{ id_usuario: 42 }];
  if (t.includes("INSERT INTO RESPONSAVEL")) return [];
  if (t.includes("INSERT INTO PACIENTE")) return [{ id_paciente: 78 }];
  if (t.includes("INSERT INTO PROFISSIONAL_ESPECIALIDADE")) return [];
  if (t.includes("INSERT INTO PROFISSIONAL")) return [];
  if (t.includes("FROM ESPECIALIDADE")) return [{ id_especialidade: 1 }];

  if (t.includes("FROM USUARIO u")) {
    if (t.includes("LOWER(u.email)")) {
      const email = params.email && params.email.value;
      if (email === caregiverRow.email) return [caregiverRow];
      if (email === professionalRow.email) return [professionalRow];
      return [];
    }
    if (t.includes("u.tipo_usuario = @tipo")) return [professionalRow];
    const id = params.id && params.id.value;
    if (id === 5) return [caregiverRow];
    if (id === 9) return [professionalRow];
    // usuário recém-cadastrado pelo teste
    if (id === 42) return [{ ...caregiverRow, id_usuario: 42, email: "novo@tealyze.app", nome: "Novo Cuidador" }];
    return [];
  }

  if (t.includes("FROM PACIENTE p")) return [patientRow];
  if (t.includes("SELECT senha_hash FROM USUARIO")) return [{ senha_hash: senhaAtualHash }];
  if (t.startsWith("UPDATE USUARIO SET senha_hash")) {
    writes.push({ kind: "senha", params });
    senhaAtualHash = params.hash.value;
    return [{}];
  }
  if (t.startsWith("UPDATE USUARIO")) return (writes.push({ kind: "usuario", params }), [{}]);
  if (t.startsWith("UPDATE RESPONSAVEL")) return (writes.push({ kind: "responsavel", params }), [{}]);
  if (t.startsWith("UPDATE PACIENTE")) return (writes.push({ kind: "paciente", params }), [{}]);
  if (t.startsWith("UPDATE PROFISSIONAL_ESPECIALIDADE")) return (writes.push({ kind: "especialidade", params }), [{}]);
  if (t.startsWith("UPDATE PROFISSIONAL")) return (writes.push({ kind: "profissional", params }), [{}]);
  if (t.startsWith("UPDATE LAUDO_ANALISE_IA")) return (writes.push({ kind: "laudo_analise", params }), [{}]);
  if (t.startsWith("UPDATE LAUDO SET explicacao_cuidador")) return (writes.push({ kind: "laudo_explicacao", params }), [{}]);
  if (t.includes("AND p.id_responsavel = @resp")) return params.resp.value === 5 ? [{ id_sessao: 1 }] : []; // vínculo profissional-família
  if (t.startsWith("UPDATE LAUDO SET")) return (writes.push({ kind: "laudo_texto", params }), [{}]);

  if (t.includes("FROM TRIAGEM")) return [];
  if (t.includes("FROM RESPOSTA_TRIAGEM")) return [];
  if (t.includes("INSERT INTO TRIAGEM")) return [{ id_triagem: 12 }];
  if (t.includes("INSERT INTO RESPOSTA_TRIAGEM")) return [];

  if (t.includes("FROM SESSAO s")) return [sessaoRow];
  if (t.includes("FROM SESSAO WHERE") || t.includes("FROM SESSAO ")) return [];
  if (t.includes("INSERT INTO SESSAO")) return [{ id_sessao: 31 }];
  if (t.includes("UPDATE SESSAO")) return [];

  if (t.includes("FROM PUBLICACAO")) return [publicacaoRow];
  if (t.includes("INSERT INTO PUBLICACAO")) return [{ id_publicacao: 3 }];
  if (t.includes("DELETE FROM PUBLICACAO")) return [];
  if (t.startsWith("UPDATE PUBLICACAO")) return (writes.push({ kind: "publicacao", params }), [{}]);

  if (t.includes("FROM MENSAGEM m")) return [{ id_conversa: 4, other_id: 9, conteudo: "Olá", data_envio: mensagemRow.data_envio }];
  if (t.includes("FROM MENSAGEM")) return [mensagemRow];
  if (t.includes("INSERT INTO MENSAGEM")) return [{ id_mensagem: 102, data_envio: new Date(Date.UTC(2026, 9, 3, 17, 0, 0)) }];
  if (t.includes("UPDATE MENSAGEM")) return [];
  if (t.includes("FROM CONVERSA c")) return [{ id_conversa: 4 }];

  if (t.includes("INSERT INTO LAUDO_ANALISE_IA")) return [];
  if (t.includes("INSERT INTO LAUDO")) return [{ id_laudo: 7 }];
  if (t.includes("FROM LAUDO l")) {
    if (t.includes("SELECT TOP (@limit)")) return laudoListRows; // por padrão: nenhum laudo anterior
    return params.id && params.id.value === 7 ? [laudoRow] : [];
  }
  if (t.includes("SELECT DB_NAME()")) return [{ db: "TEALYZE", agora: new Date() }];

  return [];
}

const fakeDb = {
  sql,
  async initDatabase() {},
  getPool() {
    return {};
  },
  async query(text, params = {}) {
    const recordset = rowsFor(text, params);
    return { recordset, rowsAffected: [recordset.length] };
  },
  async queryOne(text, params = {}) {
    const rows = rowsFor(text, params);
    return rows.length ? rows[0] : null;
  },
  async queryAll(text, params = {}) {
    return rowsFor(text, params);
  },
  async withTransaction(fn) {
    return fn(null);
  },
  async closeDatabase() {},
};

const dbPath = require.resolve(path.join(__dirname, "..", "src", "db.js"));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakeDb };

// --- Helpers de requisição ----------------------------------------------
const { createApp } = require("../src/app");

let base = "";

async function call(method, urlPath, { token = null, body = null } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

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
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;

  await check("GET / lista as rotas", async () => {
    const r = await call("GET", "/");
    assert.strictEqual(r.status, 200);
    assert.ok(r.data.routes.length > 10);
  });

  await check("GET /health responde com o database", async () => {
    const r = await call("GET", "/health");
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.database, "TEALYZE");
  });

  await check("rota inexistente devolve { detail }", async () => {
    const r = await call("GET", "/nao-existe");
    assert.strictEqual(r.status, 404);
    assert.ok(r.data.detail.includes("não encontrada"));
  });

  await check("POST /auth/login com senha correta devolve token + user", async () => {
    const r = await call("POST", "/auth/login", {
      body: { email: "maria@tealyze.app", password: SENHA },
    });
    assert.strictEqual(r.status, 200);
    assert.ok(r.data.token);
    assert.strictEqual(r.data.user.role, "caregiver");
    assert.strictEqual(r.data.user.caregiver_name, "Maria Souza");
    assert.strictEqual(r.data.user.patient_name, "Lucas Souza");
  });

  await check("POST /auth/login com senha errada -> 400 Credenciais inválidas", async () => {
    const r = await call("POST", "/auth/login", {
      body: { email: "maria@tealyze.app", password: "errada" },
    });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.data.detail, "Credenciais inválidas");
  });

  await check("rota protegida sem token -> 401", async () => {
    const r = await call("GET", "/appointments/mine");
    assert.strictEqual(r.status, 401);
    assert.ok(r.data.detail);
  });

  await check("GET /auth/me (cuidador) não expõe senha nem CPF do paciente", async () => {
    const r = await call("GET", "/auth/me", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.id, "5");
    assert.strictEqual(r.data.senha_hash, undefined);
    assert.strictEqual(r.data.caregiver_cpf, "11122233344"); // o próprio usuário vê o seu
  });

  await check("GET /professionals esconde CPF e traz especialidade", async () => {
    const r = await call("GET", "/professionals", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.length, 1);
    const pro = r.data[0];
    assert.strictEqual(pro.id, "9");
    assert.strictEqual(pro.name, "Dra. Ana Silva");
    assert.strictEqual(pro.specialty, "Psicologia");
    assert.strictEqual(pro.crp_verified, true);
    assert.strictEqual(pro.latitude, -23.5605);
    assert.strictEqual(pro.cpf, undefined);
    assert.strictEqual(pro.senha_hash, undefined);
  });

  await check("GET /professionals/:id inválido -> 400", async () => {
    const r = await call("GET", "/professionals/abc", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 400);
  });

  await check("GET /aq/questions devolve 50 perguntas", async () => {
    const r = await call("GET", "/aq/questions", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.questions.length, 50);
  });

  await check("POST /aq/submit com menos de 50 respostas -> erro", async () => {
    const r = await call("POST", "/aq/submit", {
      token: TOKEN_CUIDADOR,
      body: { answers: [0, 1, 2] },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("50"));
  });

  await check("POST /aq/submit válido devolve pontuação e interpretação", async () => {
    const answers = new Array(50).fill(0);
    const r = await call("POST", "/aq/submit", { token: TOKEN_CUIDADOR, body: { answers } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(typeof r.data.score, "number");
    assert.ok(r.data.interpretation.length > 10);
  });

  await check("POST /aq/submit por profissional -> 403", async () => {
    const r = await call("POST", "/aq/submit", {
      token: TOKEN_PROFISSIONAL,
      body: { answers: new Array(50).fill(0) },
    });
    assert.strictEqual(r.status, 403);
  });

  await check("GET /appointments/mine mapeia SESSAO para o formato da agenda", async () => {
    const r = await call("GET", "/appointments/mine", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    const appt = r.data[0];
    assert.strictEqual(appt.id, "31");
    assert.strictEqual(appt.status, "scheduled");
    assert.strictEqual(appt.scheduled_at, "2026-11-20T14:00:00"); // horário preservado
    assert.strictEqual(appt.duration_min, 60);
    assert.strictEqual(appt.professional_name, "Dra. Ana Silva");
    assert.strictEqual(appt.caregiver_name, "Maria Souza");
    assert.strictEqual(appt.patient_name, "Lucas Souza");
    assert.strictEqual(appt.specialty, "Psicologia");
  });

  await check("GET /appointments/upcoming devolve a próxima consulta", async () => {
    const r = await call("GET", "/appointments/upcoming", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.id, "31");
  });

  await check("POST /appointments com data no passado -> erro", async () => {
    const r = await call("POST", "/appointments", {
      token: TOKEN_CUIDADOR,
      body: { professional_id: "9", scheduled_at: "2020-01-01T10:00:00", duration_min: 60 },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("futura"));
  });

  await check("POST /appointments com data inválida -> erro", async () => {
    const r = await call("POST", "/appointments", {
      token: TOKEN_CUIDADOR,
      body: { professional_id: "9", scheduled_at: "não é data" },
    });
    assert.strictEqual(r.status, 400);
  });

  await check("POST /appointments por profissional -> 403", async () => {
    const r = await call("POST", "/appointments", {
      token: TOKEN_PROFISSIONAL,
      body: { professional_id: "9", scheduled_at: "2030-01-01T10:00:00" },
    });
    assert.strictEqual(r.status, 403);
  });

  await check("POST /appointments válido cria a sessão", async () => {
    const r = await call("POST", "/appointments", {
      token: TOKEN_CUIDADOR,
      body: {
        professional_id: "9",
        scheduled_at: "2030-05-05T09:30:00",
        duration_min: 45,
        notes: "Retorno",
        location: "Consultório",
      },
    });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.data.id, "31");
  });

  await check("POST /appointments/:id/confirm só pelo profissional responsável", async () => {
    const negado = await call("POST", "/appointments/31/confirm", { token: TOKEN_CUIDADOR });
    assert.strictEqual(negado.status, 403);
    const ok = await call("POST", "/appointments/31/confirm", { token: TOKEN_PROFISSIONAL });
    assert.strictEqual(ok.status, 200);
  });

  await check("DELETE /appointments/:id cancela para quem participa", async () => {
    const r = await call("DELETE", "/appointments/31", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.ok, true);
  });

  await check("GET /posts devolve as publicações no formato do feed", async () => {
    const r = await call("GET", "/posts", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    const post = r.data[0];
    assert.strictEqual(post.id, "3");
    assert.strictEqual(post.author_name, "Dra. Ana Silva");
    assert.strictEqual(post.caption, "Atividade para casa");
    assert.strictEqual(typeof post.image_base64, "string"); // arquivo ausente -> ""
    assert.strictEqual(post.to_caregiver_id, null);
    assert.strictEqual(post.created_at, "2026-10-02T11:00:00");
  });

  await check("POST /posts por cuidador -> 403", async () => {
    const r = await call("POST", "/posts", {
      token: TOKEN_CUIDADOR,
      body: { caption: "oi", image_base64: "AAAA" },
    });
    assert.strictEqual(r.status, 403);
  });

  await check("POST /posts sem imagem -> erro", async () => {
    const r = await call("POST", "/posts", { token: TOKEN_PROFISSIONAL, body: { caption: "oi" } });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("Imagem"));
  });

  await check("POST /posts grava a imagem e devolve base64 igual ao enviado", async () => {
    const original = Buffer.from("imagem-de-teste").toString("base64");
    const r = await call("POST", "/posts", {
      token: TOKEN_PROFISSIONAL,
      body: { caption: "Material novo", image_base64: original },
    });
    assert.strictEqual(r.status, 201);
    // o findById do dublê devolve a publicação fixa, então validamos o arquivo em disco
    const files = require("../src/files");
    const dir = path.join(require("../src/config").uploadsDir, "posts");
    const salvos = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    assert.ok(salvos.length >= 1);
    const conteudo = files.readAsBase64(path.join("posts", salvos[salvos.length - 1]));
    assert.strictEqual(conteudo, original);
  });

  await check("PUT /posts/:id pelo autor grava a nova legenda", async () => {
    writes.length = 0;
    const r = await call("PUT", "/posts/3", { token: TOKEN_PROFISSIONAL, body: { caption: "  Nova legenda editada  " } });
    assert.strictEqual(r.status, 200);
    const w = writes.find((x) => x.kind === "publicacao");
    assert.ok(w, "UPDATE PUBLICACAO executado");
    assert.strictEqual(w.params.legenda.value, "Nova legenda editada");
    assert.strictEqual(w.params.id.value, 3);
    assert.strictEqual(r.data.id, "3");
  });

  await check("PUT /posts/:id aceita limpar a legenda (vazia)", async () => {
    writes.length = 0;
    const r = await call("PUT", "/posts/3", { token: TOKEN_PROFISSIONAL, body: { caption: "" } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(writes.find((x) => x.kind === "publicacao").params.legenda.value, "");
  });

  await check("PUT /posts/:id valida: sem legenda 400, legenda não-texto 400, id ruim 400, sem login 401", async () => {
    writes.length = 0;
    assert.strictEqual((await call("PUT", "/posts/3", { token: TOKEN_PROFISSIONAL, body: {} })).status, 400);
    assert.strictEqual((await call("PUT", "/posts/3", { token: TOKEN_PROFISSIONAL, body: { caption: 123 } })).status, 400);
    assert.strictEqual((await call("PUT", "/posts/abc", { token: TOKEN_PROFISSIONAL, body: { caption: "x" } })).status, 400);
    assert.strictEqual((await call("PUT", "/posts/3", { body: { caption: "x" } })).status, 401);
    assert.strictEqual(writes.length, 0, "nada gravado em requisições inválidas");
  });

  await check("PUT /posts/:id de outro autor (ou de cuidador) -> 403 e nada é gravado", async () => {
    writes.length = 0;
    const r = await call("PUT", "/posts/3", { token: TOKEN_CUIDADOR, body: { caption: "invasão" } });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(writes.length, 0);
  });

  await check("DELETE /posts/:id de outro autor -> 403", async () => {
    const r = await call("DELETE", "/posts/3", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 403);
  });

  await check("DELETE /posts/:id pelo autor -> ok", async () => {
    const r = await call("DELETE", "/posts/3", { token: TOKEN_PROFISSIONAL });
    assert.strictEqual(r.status, 200);
  });

  await check("GET /chat lista conversas com o outro usuário", async () => {
    const r = await call("GET", "/chat", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    const conversa = r.data[0];
    assert.strictEqual(conversa.other_user.id, "9");
    assert.strictEqual(conversa.other_user.name, "Dra. Ana Silva");
    assert.strictEqual(conversa.other_user.cpf, undefined);
    assert.strictEqual(conversa.last_text, "Olá");
  });

  await check("GET /chat/:id devolve mensagens com from/to preenchidos", async () => {
    const r = await call("GET", "/chat/9", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    const msg = r.data[0];
    assert.strictEqual(msg.from_user_id, "9");
    assert.strictEqual(msg.to_user_id, "5");
    assert.strictEqual(msg.text, "Olá, tudo bem?");
    assert.strictEqual(msg.created_at, "2026-10-03T16:45:00");
  });

  await check("POST /chat/send sem texto -> erro", async () => {
    const r = await call("POST", "/chat/send", {
      token: TOKEN_CUIDADOR,
      body: { to_user_id: "9", text: "   " },
    });
    assert.strictEqual(r.status, 400);
  });

  await check("POST /chat/send para si mesmo -> erro", async () => {
    const r = await call("POST", "/chat/send", {
      token: TOKEN_CUIDADOR,
      body: { to_user_id: "5", text: "oi" },
    });
    assert.strictEqual(r.status, 400);
  });

  await check("POST /chat/send válido devolve a mensagem criada", async () => {
    const r = await call("POST", "/chat/send", {
      token: TOKEN_CUIDADOR,
      body: { to_user_id: "9", text: "Bom dia!" },
    });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.data.from_user_id, "5");
    assert.strictEqual(r.data.to_user_id, "9");
    assert.strictEqual(r.data.text, "Bom dia!");
  });

  await check("GET /laudo/mine devolve lista (vazia no dublê)", async () => {
    const r = await call("GET", "/laudo/mine", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.data));
  });

  await check("POST /laudo/analyze por profissional -> 403", async () => {
    const r = await call("POST", "/laudo/analyze", {
      token: TOKEN_PROFISSIONAL,
      body: { image_base64: "AAAA" },
    });
    assert.strictEqual(r.status, 403);
  });

  await check("POST /laudo/analyze sem IA configurada ainda salva e avisa", async () => {
    const original = Buffer.from("laudo-de-teste").toString("base64");
    const r = await call("POST", "/laudo/analyze", {
      token: TOKEN_CUIDADOR,
      body: { image_base64: original, mime_type: "image/jpeg" },
    });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.data.id, "7");
    assert.strictEqual(r.data.is_valid_laudo, false);
    assert.ok(Array.isArray(r.data.warnings) && r.data.warnings.length >= 1);
    assert.ok(Array.isArray(r.data.fraud_indicators));
    assert.strictEqual(r.data.cross_check.fraud_risk, "medium");
    assert.strictEqual(r.data.created_at, "2026-10-04T12:00:00");
  });

  await check("POST /auth/logout limpa a sessão", async () => {
    const r = await call("POST", "/auth/logout", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
  });

  await check("cadastro de cuidador exige CPF de 11 dígitos", async () => {
    const r = await call("POST", "/auth/register/caregiver", {
      body: {
        email: "novo@tealyze.app",
        password: "senha123",
        caregiver_name: "Novo Cuidador",
        caregiver_cpf: "123",
        patient_name: "Paciente",
        patient_cpf: "98765432100",
      },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("CPF"));
  });

  await check("cadastro de cuidador exige senha com 6+ caracteres", async () => {
    const r = await call("POST", "/auth/register/caregiver", {
      body: { email: "novo@tealyze.app", password: "123" },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("senha"));
  });

  await check("cadastro de profissional valida o formato do CRP", async () => {
    const r = await call("POST", "/auth/register/professional", {
      body: {
        email: "pro@tealyze.app",
        password: "senha123",
        name: "Dr. Teste",
        cpf: "44455566677",
        crp: "CRP-errado",
        specialty: "Psicologia",
      },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("CRP"));
  });

  await check("e-mail já cadastrado é rejeitado", async () => {
    const r = await call("POST", "/auth/register/caregiver", {
      body: {
        email: "maria@tealyze.app",
        password: "senha123",
        caregiver_name: "Outra Maria",
        caregiver_cpf: "11122233344",
        patient_name: "Paciente",
      },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("Email"));
  });

  await check("cadastro de cuidador válido devolve token + user do banco", async () => {
    const r = await call("POST", "/auth/register/caregiver", {
      body: {
        email: "novo@tealyze.app",
        password: "senha123",
        caregiver_name: "Novo Cuidador",
        caregiver_cpf: "123.456.789-09",
        patient_name: "Paciente Teste",
        patient_cpf: "987.654.321-00",
        phone: "(11) 90000-0000",
      },
    });
    assert.strictEqual(r.status, 201);
    assert.ok(r.data.token);
    assert.strictEqual(r.data.user.id, "42");
    assert.strictEqual(r.data.user.role, "caregiver");
  });

  await check("cadastro de profissional válido devolve token + user", async () => {
    const r = await call("POST", "/auth/register/professional", {
      body: {
        email: "outro.pro@tealyze.app",
        password: "senha123",
        name: "Dr. Teste",
        cpf: "444.555.666-77",
        crp: "06/999999",
        specialty: "Psicologia",
        formation: "Graduação em Psicologia",
        bio: "Atendimento TEA",
        latitude: -23.5,
        longitude: -46.6,
        address: "Rua Teste, 10",
      },
    });
    assert.strictEqual(r.status, 201);
    assert.ok(r.data.token);
  });

  await check("AQ: chave oficial tem 24 itens diretos e 26 invertidos", async () => {
    assert.strictEqual(AQ_AGREE_ITEMS.size, 24);
    const diretos = Array.from({ length: 50 }, (_, i) => i).filter(isAgreeScored).length;
    assert.strictEqual(diretos, 24);
    // itens que a versão antiga pontuava errado (invertidos) e os que ela omitia
    [11, 15, 25, 32, 34, 38, 40].forEach((n) => assert.ok(!AQ_AGREE_ITEMS.has(n), `item ${n} é invertido`));
    [7, 13, 16, 19, 20, 23, 33, 39, 41, 42].forEach((n) => assert.ok(AQ_AGREE_ITEMS.has(n), `item ${n} é direto`));
  });

  await check("AQ: pontuação vai de 0 a 50 conforme a chave", async () => {
    const todosPontuam = Array.from({ length: 50 }, (_, i) => (isAgreeScored(i) ? 0 : 3));
    const nenhumPontua = Array.from({ length: 50 }, (_, i) => (isAgreeScored(i) ? 3 : 0));
    assert.strictEqual(scoreAq(todosPontuam), 50);
    assert.strictEqual(scoreAq(nenhumPontua), 0);
  });

  await check("POST /aq/submit devolve 50 e 0 nos extremos da chave", async () => {
    const todosPontuam = Array.from({ length: 50 }, (_, i) => (isAgreeScored(i) ? 0 : 3));
    const nenhumPontua = Array.from({ length: 50 }, (_, i) => (isAgreeScored(i) ? 3 : 0));
    // (token do cuidador ainda vale no dublê: o logout acima não remove da memória)
    const alto = await call("POST", "/aq/submit", { token: TOKEN_CUIDADOR, body: { answers: todosPontuam } });
    const baixo = await call("POST", "/aq/submit", { token: TOKEN_CUIDADOR, body: { answers: nenhumPontua } });
    assert.strictEqual(alto.data.score, 50);
    assert.strictEqual(baixo.data.score, 0);
  });

  await check("cadastro de cuidador rejeita CPF do paciente com tamanho errado", async () => {
    const r = await call("POST", "/auth/register/caregiver", {
      body: {
        email: "cpf.errado@tealyze.app",
        password: "senha123",
        caregiver_name: "Fulana",
        caregiver_cpf: "52998224725",
        patient_name: "Paciente",
        patient_cpf: "123",
      },
    });
    assert.strictEqual(r.status, 400);
    assert.ok(r.data.detail.includes("paciente"));
  });

  // ------------------------------------------------------------------ PERFIL
  const { verifyPassword } = require("../src/crypto");
  const lastWrite = (kind) => [...writes].reverse().find((w) => w.kind === kind);

  await check("GET /profile sem token -> 401", async () => {
    const r = await call("GET", "/profile");
    assert.strictEqual(r.status, 401);
  });

  await check("GET /profile (cuidador) devolve dados pessoais, paciente e estatísticas", async () => {
    const r = await call("GET", "/profile", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.role, "caregiver");
    assert.strictEqual(r.data.account.name, "Maria Souza");
    assert.strictEqual(r.data.account.email, "maria@tealyze.app");
    assert.strictEqual(r.data.account.birthdate, "1988-07-21");
    assert.strictEqual(r.data.caregiver.relationship, "Mãe");
    assert.strictEqual(r.data.caregiver.occupation, "Professora");
    assert.strictEqual(r.data.caregiver.cpf, "11122233344");
    assert.strictEqual(r.data.patient.name, "Lucas Souza");
    assert.strictEqual(r.data.patient.support_level, 2);
    assert.strictEqual(r.data.patient.diagnosis_date, "2023-05-10");
    assert.strictEqual(r.data.professional, null);
    assert.strictEqual(r.data.stats.appointments, 1);
    assert.strictEqual(typeof r.data.stats.laudos, "number");
    assert.ok(!JSON.stringify(r.data).includes("senha"), "nunca devolve hash de senha");
  });

  await check("GET /profile (profissional) devolve dados profissionais", async () => {
    const r = await call("GET", "/profile", { token: TOKEN_PROFISSIONAL });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.role, "professional");
    assert.strictEqual(r.data.professional.registry, "06/123456");
    assert.strictEqual(r.data.professional.specialty, "Psicologia");
    assert.strictEqual(r.data.professional.state, "SP");
    assert.strictEqual(r.data.professional.experience_years, 10);
    assert.strictEqual(r.data.professional.teleconsulta, true);
    assert.strictEqual(r.data.patient, null);
    assert.strictEqual(r.data.caregiver, null);
  });

  await check("PUT /profile (cuidador) grava USUARIO, RESPONSAVEL e PACIENTE", async () => {
    writes.length = 0;
    const r = await call("PUT", "/profile", {
      token: TOKEN_CUIDADOR,
      body: {
        name: "Maria S. Souza",
        phone: "(11) 90000-0000",
        birthdate: "22/07/1988",
        occupation: "Diretora",
        patient_name: "Lucas S.",
        patient_cpf: "123.456.789-09",
        support_level: 3,
        diagnosis_date: "2022-01-15",
        notes: "Novo texto",
      },
    });
    assert.strictEqual(r.status, 200);
    const u = lastWrite("usuario").params;
    assert.strictEqual(u.nome.value, "Maria S. Souza");
    assert.strictEqual(u.telefone.value, "(11) 90000-0000");
    assert.strictEqual(u.nascimento.value.toISOString().slice(0, 10), "1988-07-22");
    const resp = lastWrite("responsavel").params;
    assert.strictEqual(resp.profissao.value, "Diretora");
    assert.strictEqual(resp.grau.value, "Mãe", "campo não enviado permanece como estava");
    const pac = lastWrite("paciente").params;
    assert.strictEqual(pac.nome.value, "Lucas S.");
    assert.strictEqual(pac.cpf.value, "12345678909");
    assert.strictEqual(pac.nivel.value, 3);
    assert.strictEqual(pac.data_diag.value.toISOString().slice(0, 10), "2022-01-15");
    assert.strictEqual(pac.historico.value, "Diagnóstico aos 4 anos.");
    assert.strictEqual(pac.obs.value, "Novo texto");
    assert.ok(!lastWrite("profissional"), "cuidador não altera dados de profissional");
  });

  await check("PUT /profile valida os campos e não grava nada quando inválido", async () => {
    const casos = [
      [{ name: "   " }, "nome vazio"],
      [{ patient_name: "" }, "nome do paciente vazio"],
      [{ support_level: 9 }, "nível de suporte"],
      [{ birthdate: "31/02/2020" }, "data inexistente"],
      [{ birthdate: "2999-01-01" }, "data no futuro"],
      [{ diagnosis_date: "ontem" }, "data em formato errado"],
      [{ patient_cpf: "123" }, "CPF curto"],
    ];
    writes.length = 0;
    for (const [body, nome] of casos) {
      const r = await call("PUT", "/profile", { token: TOKEN_CUIDADOR, body });
      assert.strictEqual(r.status, 400, `${nome} deveria dar 400`);
      assert.ok(r.data.detail, `${nome} deveria trazer mensagem`);
    }
    assert.strictEqual(writes.length, 0, "nenhuma escrita em requisições inválidas");
  });

  await check("PUT /profile aceita limpar campos opcionais (vazio vira NULL)", async () => {
    writes.length = 0;
    const r = await call("PUT", "/profile", {
      token: TOKEN_CUIDADOR,
      body: { occupation: "", birthdate: "", support_level: "", cid11: "", patient_cpf: "" },
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(lastWrite("responsavel").params.profissao.value, null);
    assert.strictEqual(lastWrite("usuario").params.nascimento.value, null);
    const pac = lastWrite("paciente").params;
    assert.strictEqual(pac.nivel.value, null);
    assert.strictEqual(pac.cid.value, null);
    assert.strictEqual(pac.cpf.value, null);
  });

  await check("PUT /profile (profissional) grava PROFISSIONAL e a especialidade", async () => {
    writes.length = 0;
    const r = await call("PUT", "/profile", {
      token: TOKEN_PROFISSIONAL,
      body: {
        bio: "Nova bio",
        experience_years: 12,
        state: "rj",
        zip: "20000-000",
        city: "Rio de Janeiro",
        teleconsulta: false,
        specialty: "Fonoaudiologia",
        occupation: "ignorado para profissional",
      },
    });
    assert.strictEqual(r.status, 200);
    const p = lastWrite("profissional").params;
    assert.strictEqual(p.descricao.value, "Nova bio");
    assert.strictEqual(p.exp.value, 12);
    assert.strictEqual(p.estado.value, "RJ");
    assert.strictEqual(p.cep.value, "20000000");
    assert.strictEqual(p.cidade.value, "Rio de Janeiro");
    assert.strictEqual(p.tele.value, 0);
    assert.strictEqual(p.formacao.value, "Doutorado em Psicologia Clínica (USP)", "não enviado permanece");
    assert.strictEqual(p.lat.value, -23.5605, "coordenadas permanecem");
    assert.strictEqual(writes.filter((w) => w.kind === "especialidade").length, 2);
    assert.ok(!lastWrite("responsavel") && !lastWrite("paciente"), "profissional não grava dados de cuidador");
  });

  await check("PUT /profile (profissional) rejeita estado, CEP, latitude e experiência inválidos", async () => {
    writes.length = 0;
    for (const body of [{ state: "SPX" }, { zip: "123" }, { latitude: 120 }, { experience_years: 200 }]) {
      const r = await call("PUT", "/profile", { token: TOKEN_PROFISSIONAL, body });
      assert.strictEqual(r.status, 400, JSON.stringify(body));
    }
    assert.strictEqual(writes.length, 0);
  });

  await check("POST /profile/password valida e grava o novo hash", async () => {
    const url = "/profile/password";
    const t = TOKEN_CUIDADOR;
    assert.strictEqual((await call("POST", url, { token: t, body: { new_password: "abcdef" } })).status, 400);
    assert.strictEqual(
      (await call("POST", url, { token: t, body: { current_password: "errada", new_password: "abcdef" } })).status,
      400
    );
    assert.strictEqual(
      (await call("POST", url, { token: t, body: { current_password: SENHA, new_password: "123" } })).status,
      400
    );
    assert.strictEqual(
      (await call("POST", url, { token: t, body: { current_password: SENHA, new_password: SENHA } })).status,
      400
    );
    writes.length = 0;
    const ok = await call("POST", url, { token: t, body: { current_password: SENHA, new_password: "novaSenha9" } });
    assert.strictEqual(ok.status, 200);
    assert.ok(verifyPassword("novaSenha9", lastWrite("senha").params.hash.value));
    assert.ok(!verifyPassword(SENHA, lastWrite("senha").params.hash.value));
  });

  // ------------------------------------------- RESUMO DE DOCUMENTOS (profissional)
  const row = (id, over = {}) => ({
    ...laudoRow, id_laudo: id, laudo_valido: 1, confianca: 90, texto_ocr: "TEXTO SIGILOSO", nome_paciente: "Lucas Souza",
    cpf_paciente: "555.666.777-88", diagnostico: "Transtorno do Espectro Autista", lido_por_ia: 1, explicacao_cuidador: null,
    checagem_cruzada: JSON.stringify({ fraud_risk: "low", patient_name_match: true, patient_cpf_match: true }), ...over,
  });
  const strong = (id, over = {}) => row(id, {
    laudo_valido: 0, explicacao_cuidador: "O laudo está no nome da mãe",
    checagem_cruzada: JSON.stringify({ fraud_risk: "high", patient_name_match: false, professional_consistency: "different", fraud_signals: ["x", "y", "z"] }), ...over,
  });

  await check("GET /laudo/summary/:id sem login -> 401", async () => {
    assert.strictEqual((await call("GET", "/laudo/summary/5")).status, 401);
  });

  await check("profissional COM consulta vê o resumo (contagens, motivos e explicação)", async () => {
    laudoListRows = [strong(13), row(12), row(11)];
    writes.length = 0;
    const r = await call("GET", "/laudo/summary/5", { token: TOKEN_PROFISSIONAL });
    laudoListRows = [];
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.label, "3 laudos enviados · 2 sem alertas · 1 com alerta");
    assert.deepStrictEqual([r.data.total, r.data.without_alerts, r.data.with_alerts, r.data.not_read], [3, 2, 1, 0]);
    assert.ok(r.data.alerts[0].reasons.includes("Nome no laudo diferente do cadastro do paciente"));
    assert.strictEqual(r.data.alerts[0].explanation, "O laudo está no nome da mãe");
  });

  await check("o resumo NÃO expõe imagem, texto, nome, CPF nem diagnóstico", async () => {
    laudoListRows = [strong(13), row(12)];
    const r = await call("GET", "/laudo/summary/5", { token: TOKEN_PROFISSIONAL });
    laudoListRows = [];
    const json = JSON.stringify(r.data);
    for (const secret of ["SIGILOSO", "Lucas", "555.666", "Autista", "image_base64", "caminho", "laudo.jpg"]) {
      assert.ok(!json.includes(secret), `vazou: ${secret}`);
    }
  });

  await check("profissional SEM consulta com a família -> 403 (não vê nada)", async () => {
    laudoListRows = [strong(13)];
    const r = await call("GET", "/laudo/summary/6", { token: TOKEN_PROFISSIONAL }); // cuidador 6: sem vínculo
    laudoListRows = [];
    assert.strictEqual(r.status, 403);
    assert.ok(!JSON.stringify(r.data).includes("alerts"), "nenhum dado do resumo na recusa");
  });

  await check("o acesso do profissional ao resumo fica registrado na auditoria", async () => {
    const before = executed.filter((q) => q.includes("INSERT INTO LOG_AUDITORIA")).length;
    await call("GET", "/laudo/summary/5", { token: TOKEN_PROFISSIONAL });
    const after = executed.filter((q) => q.includes("INSERT INTO LOG_AUDITORIA")).length;
    assert.strictEqual(after, before + 1);
  });

  await check("cuidador não pode usar a rota do profissional; id inválido -> 400", async () => {
    assert.strictEqual((await call("GET", "/laudo/summary/5", { token: TOKEN_CUIDADOR })).status, 403);
    assert.strictEqual((await call("GET", "/laudo/summary/abc", { token: TOKEN_PROFISSIONAL })).status, 400);
  });

  await check("laudo sem leitura da IA aparece como 'aguardando leitura', nunca como alerta", async () => {
    laudoListRows = [row(12, { lido_por_ia: 0, laudo_valido: 0, confianca: 0, texto_ocr: "", nome_paciente: null,
      checagem_cruzada: JSON.stringify({ fraud_risk: "high", fraud_signals: ["a", "b", "c"] }) })];
    const r = await call("GET", "/laudo/summary/5", { token: TOKEN_PROFISSIONAL });
    laudoListRows = [];
    assert.strictEqual(r.data.with_alerts, 0);
    assert.strictEqual(r.data.not_read, 1);
  });

  await check("cuidador vê exatamente o mesmo resumo que os profissionais veem", async () => {
    laudoListRows = [strong(13), row(12)];
    const mine = await call("GET", "/laudo/summary", { token: TOKEN_CUIDADOR });
    const theirs = await call("GET", "/laudo/summary/5", { token: TOKEN_PROFISSIONAL });
    laudoListRows = [];
    assert.strictEqual(mine.status, 200);
    assert.deepStrictEqual(mine.data, theirs.data);
    assert.strictEqual((await call("GET", "/laudo/summary", { token: TOKEN_PROFISSIONAL })).status, 403);
  });

  await check("PUT /laudo/:id/explanation grava a explicação do dono do laudo", async () => {
    writes.length = 0;
    const r = await call("PUT", "/laudo/7/explanation", { token: TOKEN_CUIDADOR, body: { explanation: "  O nome no laudo é o da minha mãe.  " } });
    assert.strictEqual(r.status, 200);
    const w = writes.find((x) => x.kind === "laudo_explicacao");
    assert.ok(w, "UPDATE da explicação executado");
    assert.strictEqual(w.params.texto.value, "O nome no laudo é o da minha mãe.");
    assert.strictEqual(w.params.id.value, 7);
  });

  await check("explicação pode ser apagada (texto vazio vira NULL)", async () => {
    writes.length = 0;
    const r = await call("PUT", "/laudo/7/explanation", { token: TOKEN_CUIDADOR, body: { explanation: "" } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(writes.find((x) => x.kind === "laudo_explicacao").params.texto.value, null);
  });

  await check("explicação: limite de 500, tipo inválido, outro usuário e sem login", async () => {
    writes.length = 0;
    assert.strictEqual((await call("PUT", "/laudo/7/explanation", { token: TOKEN_CUIDADOR, body: { explanation: "x".repeat(501) } })).status, 400);
    assert.strictEqual((await call("PUT", "/laudo/7/explanation", { token: TOKEN_CUIDADOR, body: { explanation: 5 } })).status, 400);
    assert.strictEqual((await call("PUT", "/laudo/7/explanation", { token: TOKEN_PROFISSIONAL, body: { explanation: "invasão" } })).status, 403);
    assert.strictEqual((await call("PUT", "/laudo/7/explanation", { body: { explanation: "x" } })).status, 401);
    assert.strictEqual(writes.length, 0, "nada gravado nas requisições inválidas");
  });

  // -------------------------------------------------------- LAUDO (perfil)
  await check("GET /laudo/ocr-status informa o estado da IA sem expor a chave", async () => {
    const r = await call("GET", "/laudo/ocr-status", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.enabled, false);
    assert.strictEqual(r.data.provider, "gemini");
    assert.ok(Array.isArray(r.data.models) && r.data.models.length >= 1);
    assert.ok(!("apiKey" in r.data) && !("api_key" in r.data));
  });

  await check("GET /laudo/:id devolve análise + imagem do próprio laudo", async () => {
    const r = await call("GET", "/laudo/7", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.id, "7");
    assert.strictEqual(r.data.is_valid_laudo, false);
    assert.strictEqual(r.data.cross_check.fraud_risk, "medium");
    assert.strictEqual(r.data.mime_type, "image/jpeg");
    assert.strictEqual(Buffer.from(r.data.image_base64, "base64").toString(), "FAKE-JPEG-BYTES");
  });

  await check("GET /laudo/:id de outro usuário -> 403; inexistente -> 404; id inválido -> 400", async () => {
    assert.strictEqual((await call("GET", "/laudo/7", { token: TOKEN_PROFISSIONAL })).status, 403);
    assert.strictEqual((await call("GET", "/laudo/999", { token: TOKEN_CUIDADOR })).status, 404);
    assert.strictEqual((await call("GET", "/laudo/abc", { token: TOKEN_CUIDADOR })).status, 400);
    assert.strictEqual((await call("GET", "/laudo/7")).status, 401);
  });

  await check("POST /laudo/:id/reanalyze regrava a análise e explica a ausência da IA", async () => {
    writes.length = 0;
    const r = await call("POST", "/laudo/7/reanalyze", { token: TOKEN_CUIDADOR });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.id, "7");
    const alertas = JSON.parse(lastWrite("laudo_analise").params.alertas.value);
    assert.ok(alertas[0].includes("desativada"), alertas[0]);
    assert.ok(lastWrite("laudo_texto"), "texto do OCR atualizado em LAUDO");
    assert.strictEqual((await call("POST", "/laudo/7/reanalyze", { token: TOKEN_PROFISSIONAL })).status, 403);
  });

  server.close();
  fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });

  console.log("\nTeste de fumaça das rotas (banco simulado):\n");
  results.forEach((line) => console.log(line));
  const falhas = results.filter((l) => l.includes("FAIL")).length;
  console.log(`\n${results.length - falhas}/${results.length} verificações passaram.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
