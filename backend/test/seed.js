"use strict";

// -----------------------------------------------------------------------
// Teste do seed (logins de teste de profissional e cuidador).
//
// Troca os repositórios por um armazenamento em memória e confere a LÓGICA
// do seed: o que é criado, que é idempotente e que completa o que faltar.
// (O SQL em si é validado pelo `npm run check-db` contra o SQL Server real.)
//
// Uso: node test/seed.js
// -----------------------------------------------------------------------
const assert = require("assert");
const path = require("path");

function stub(relativePath, exports) {
  const resolved = require.resolve(path.join(__dirname, "..", "src", relativePath));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
}

// --- Armazenamento em memória ---------------------------------------------
const store = {};
function resetStore() {
  Object.assign(store, {
    nextUser: 1,
    nextPaciente: 1,
    nextSessao: 1,
    nextConversa: 1,
    nextMensagem: 1,
    nextPost: 1,
    users: [],
    triagens: [],
    sessoes: [],
    conversas: [],
    mensagens: [],
    posts: [],
    auditoria: [],
    arquivos: [],
  });
}
resetStore();

const roleFromTipo = (t) => (String(t || "").toUpperCase() === "PROFISSIONAL" ? "professional" : "caregiver");

stub("db.js", { withTransaction: async (fn) => fn(null) });
stub("audit.js", {
  log: async (idUsuario, acao, tabela, idRegistro) => {
    store.auditoria.push({ idUsuario, acao, tabela, idRegistro });
  },
});
stub("files.js", {
  saveBase64: (folder, base64) => {
    const buffer = Buffer.from(base64, "base64");
    assert.strictEqual(buffer.slice(1, 4).toString("ascii"), "PNG", "a imagem de demonstração deve ser um PNG");
    const fileName = `demo-${store.arquivos.length + 1}.png`;
    const relativePath = `${folder}/${fileName}`;
    store.arquivos.push(relativePath);
    return { fileName, relativePath, hash: "x", bytes: buffer.length };
  },
  remove: (relativePath) => {
    store.arquivos = store.arquivos.filter((f) => f !== relativePath);
  },
});

stub("repositories/users.js", {
  roleFromTipo,
  async countProfessionals() {
    return store.users.filter((u) => u.tipo_usuario === "PROFISSIONAL").length;
  },
  async createProfessional(transaction, data) {
    assert.ok(String(data.senhaHash).startsWith("sha256s2:"), "senha deve ir como hash");
    if (store.users.some((u) => u.email === data.email)) throw new Error("Email já cadastrado");
    store.users.push({
      id_usuario: store.nextUser++,
      email: data.email,
      nome: data.name,
      tipo_usuario: "PROFISSIONAL",
      endereco: data.address,
      id_paciente: null,
    });
    return { idUsuario: store.nextUser - 1 };
  },
  async createCaregiver(transaction, data) {
    assert.ok(String(data.senhaHash).startsWith("sha256s2:"), "senha deve ir como hash");
    assert.strictEqual(String(data.caregiver_cpf).length, 11);
    assert.strictEqual(String(data.patient_cpf).length, 11);
    if (store.users.some((u) => u.email === data.email)) throw new Error("Email já cadastrado");
    const idUsuario = store.nextUser++;
    store.users.push({
      id_usuario: idUsuario,
      email: data.email,
      nome: data.caregiver_name,
      tipo_usuario: "CUIDADOR",
      id_paciente: store.nextPaciente++,
      nome_social: data.patient_name,
    });
    return { idUsuario, idPaciente: store.nextPaciente - 1 };
  },
  async findRowByEmail(email) {
    return store.users.find((u) => u.email === String(email).toLowerCase()) || null;
  },
  async listProfessionals() {
    return store.users
      .filter((u) => u.tipo_usuario === "PROFISSIONAL")
      .map((u) => ({ id: String(u.id_usuario), email: u.email, name: u.nome, address: u.endereco }));
  },
  async getPacienteIdForResponsavel(idUsuario) {
    const u = store.users.find((x) => x.id_usuario === idUsuario);
    return u ? u.id_paciente : null;
  },
});

stub("repositories/triagem.js", {
  async getLatestAq(idPaciente) {
    const t = [...store.triagens].reverse().find((x) => x.idPaciente === idPaciente);
    return t ? { score: t.score, answers: t.answers } : null;
  },
  async saveAq(transaction, { idPaciente, answers, score, interpretation }) {
    assert.strictEqual(answers.length, 50);
    assert.ok(interpretation.length > 10);
    store.triagens.push({ id: store.triagens.length + 1, idPaciente, answers, score });
    return store.triagens.length;
  },
});

stub("repositories/appointments.js", {
  async listForCaregiver(idUsuario) {
    return store.sessoes.filter((s) => s.idResponsavel === idUsuario);
  },
  async hasConflict() {
    return false;
  },
  async insert({ idPaciente, idProfissional, inicio, fim, local, notes }) {
    const owner = store.users.find((u) => u.id_paciente === idPaciente);
    store.sessoes.push({
      id: store.nextSessao++,
      idResponsavel: owner.id_usuario,
      idPaciente,
      idProfissional,
      inicio,
      fim,
      local,
      notes,
      status: "scheduled",
    });
    return store.nextSessao - 1;
  },
  async updateStatus(id, status) {
    store.sessoes.find((s) => s.id === id).status = status;
  },
});

stub("repositories/messages.js", {
  async findConversation(a, b) {
    const c = store.conversas.find((x) => x.members.includes(a) && x.members.includes(b));
    return c ? c.id : null;
  },
  async findOrCreateConversation(a, b) {
    const existing = await this.findConversation(a, b);
    if (existing) return existing;
    store.conversas.push({ id: store.nextConversa++, members: [a, b] });
    return store.nextConversa - 1;
  },
  async insertMessage(idConversa, idAutor, texto) {
    store.mensagens.push({ id: store.nextMensagem++, idConversa, idAutor, texto });
    return { id: store.nextMensagem - 1, createdAt: new Date() };
  },
});

stub("repositories/posts.js", {
  async listVisibleToCaregiver(idUsuario) {
    return store.posts.filter((p) => p.dest === idUsuario || p.dest === null);
  },
  async insert({ idProfissional, idResponsavelDestino, legenda, file }) {
    assert.strictEqual(file.mimeType, "image/png");
    store.posts.push({ id: store.nextPost++, idProfissional, dest: idResponsavelDestino, legenda, file });
    return store.nextPost - 1;
  },
});

const seed = require("../src/services/seed");
const { scoreAq } = require("../src/services/aq");

// --- Verificações ----------------------------------------------------------
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

const caregiverRow = () => store.users.find((u) => u.email === seed.DEMO_CAREGIVER.email);
const countState = () => ({
  users: store.users.length,
  triagens: store.triagens.length,
  sessoes: store.sessoes.length,
  conversas: store.conversas.length,
  mensagens: store.mensagens.length,
  posts: store.posts.length,
});

async function main() {
  console.log("\n[console do seed silenciado durante o teste]\n");
  const realLog = console.log;
  const realWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};

  try {
    await check("primeira execução cria 3 profissionais + 1 cuidador de teste", async () => {
      resetStore();
      const out = await seed.seedIfNeeded();
      assert.strictEqual(out.professionals, 3);
      assert.strictEqual(out.caregiver.created, true);
      assert.strictEqual(store.users.filter((u) => u.tipo_usuario === "PROFISSIONAL").length, 3);
      const c = caregiverRow();
      assert.ok(c, "cuidador de teste deve existir");
      assert.strictEqual(c.tipo_usuario, "CUIDADOR");
      assert.strictEqual(c.email, "test.caregiver@tealyze.app");
      assert.ok(c.id_paciente, "cuidador deve ter paciente");
    });

    await check("AQ de teste é gravado com 50 respostas e pontuação 28", async () => {
      assert.strictEqual(store.triagens.length, 1);
      const t = store.triagens[0];
      assert.strictEqual(t.idPaciente, caregiverRow().id_paciente);
      assert.strictEqual(t.answers.length, 50);
      assert.strictEqual(t.score, 28);
      assert.strictEqual(scoreAq(t.answers), 28);
    });

    await check("agenda de teste: 1 no histórico, 1 confirmada e 1 aguardando", async () => {
      assert.strictEqual(store.sessoes.length, 3);
      const now = Date.now();
      const [passada, confirmada, pendente] = store.sessoes;
      assert.ok(passada.inicio.getTime() < now && passada.status === "confirmed");
      assert.ok(confirmada.inicio.getTime() > now && confirmada.status === "confirmed");
      assert.ok(pendente.inicio.getTime() > now && pendente.status === "scheduled");
      const ana = store.users.find((u) => u.email === "ana.silva@tealyze.app");
      assert.ok(store.sessoes.every((s) => s.idProfissional === ana.id_usuario));
      assert.ok(store.sessoes.every((s) => s.idResponsavel === caregiverRow().id_usuario));
    });

    await check("conversa de teste: 1 conversa com mensagens dos dois lados", async () => {
      assert.strictEqual(store.conversas.length, 1);
      assert.strictEqual(store.mensagens.length, 4);
      const autores = new Set(store.mensagens.map((m) => m.idAutor));
      assert.strictEqual(autores.size, 2);
      assert.ok(autores.has(caregiverRow().id_usuario));
    });

    await check("publicação de teste é direcionada ao cuidador (imagem PNG)", async () => {
      assert.strictEqual(store.posts.length, 1);
      assert.strictEqual(store.posts[0].dest, caregiverRow().id_usuario);
      assert.strictEqual(store.arquivos.length, 1);
    });

    await check("segunda execução não duplica nada (idempotente)", async () => {
      const antes = countState();
      const out = await seed.seedIfNeeded();
      assert.strictEqual(out.professionals, 0);
      assert.strictEqual(out.caregiver.created, false);
      assert.deepStrictEqual(countState(), antes);
    });

    await check("completa só o que faltar (AQ e agenda apagados)", async () => {
      store.triagens.length = 0;
      store.sessoes.length = 0;
      const antes = countState();
      const out = await seed.seedCaregiver();
      assert.strictEqual(out.created, false);
      assert.strictEqual(out.aq, true);
      assert.strictEqual(out.appointments, 3);
      assert.strictEqual(out.messages, 0);
      assert.strictEqual(out.posts, 0);
      assert.strictEqual(store.triagens.length, 1);
      assert.strictEqual(store.sessoes.length, 3);
      assert.strictEqual(store.users.length, antes.users);
      assert.strictEqual(store.mensagens.length, antes.mensagens);
    });

    await check("cria o cuidador mesmo quando já existem outros profissionais", async () => {
      resetStore();
      store.users.push({
        id_usuario: store.nextUser++,
        email: "real.pro@clinica.com",
        nome: "Dr. Real",
        tipo_usuario: "PROFISSIONAL",
        endereco: "Rua X",
        id_paciente: null,
      });
      const out = await seed.seedIfNeeded();
      assert.strictEqual(out.professionals, 0, "não deve recriar profissionais de demonstração");
      assert.strictEqual(out.caregiver.created, true);
      assert.strictEqual(store.users.filter((u) => u.tipo_usuario === "PROFISSIONAL").length, 1);
      assert.strictEqual(store.sessoes[0].idProfissional, 1, "usa o profissional que existir");
    });

    await check("sem nenhum profissional: cria cuidador + AQ e pula o que depende deles", async () => {
      resetStore();
      const out = await seed.seedCaregiver();
      assert.strictEqual(out.created, true);
      assert.strictEqual(out.aq, true);
      assert.strictEqual(store.sessoes.length, 0);
      assert.strictEqual(store.mensagens.length, 0);
      assert.strictEqual(store.posts.length, 0);
    });

    await check("e-mail de teste já usado por profissional: não mexe em nada", async () => {
      resetStore();
      store.users.push({
        id_usuario: store.nextUser++,
        email: seed.DEMO_CAREGIVER.email,
        nome: "Outro",
        tipo_usuario: "PROFISSIONAL",
        id_paciente: null,
      });
      const antes = countState();
      const out = await seed.seedCaregiver();
      assert.strictEqual(out.created, false);
      assert.deepStrictEqual(countState(), antes);
    });
  } finally {
    console.log = realLog;
    console.warn = realWarn;
  }

  console.log("Teste do seed (repositórios em memória):\n");
  results.forEach((line) => console.log(line));
  const falhas = results.filter((l) => l.includes("FAIL")).length;
  console.log(`\n${results.length - falhas}/${results.length} verificações passaram.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
