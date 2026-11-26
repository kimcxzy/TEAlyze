"use strict";

// Uso: npm run check-db
// Confere conexão, existência das tabelas e contagem de registros.
const { initDatabase, queryAll, queryOne, closeDatabase } = require("../db");

const TABELAS = [
  "USUARIO",
  "RESPONSAVEL",
  "PACIENTE",
  "PROFISSIONAL",
  "ESPECIALIDADE",
  "PROFISSIONAL_ESPECIALIDADE",
  "TRIAGEM",
  "RESPOSTA_TRIAGEM",
  "SESSAO",
  "CONVERSA",
  "PARTICIPANTE_CONVERSA",
  "MENSAGEM",
  "LAUDO",
  "LAUDO_ANALISE_IA",
  "PUBLICACAO",
  "TOKEN_ACESSO",
  "LOG_AUDITORIA",
];

async function main() {
  await initDatabase();

  const info = await queryOne("SELECT DB_NAME() AS db, @@VERSION AS versao");
  console.log(`\nDatabase: ${info.db}`);
  console.log(`${String(info.versao).split("\n")[0]}\n`);

  for (const tabela of TABELAS) {
    const existe = await queryOne("SELECT OBJECT_ID(@t, 'U') AS id", { t: tabela });
    if (!existe.id) {
      console.log(`  [FALTA] ${tabela}`);
      continue;
    }
    const total = await queryOne(`SELECT COUNT(*) AS total FROM ${tabela}`);
    console.log(`  [ok]    ${tabela.padEnd(28)} ${total.total} registro(s)`);
  }

  const profissionais = await queryAll(
    `SELECT u.id_usuario, u.nome, u.email FROM USUARIO u
     WHERE u.tipo_usuario = 'PROFISSIONAL' ORDER BY u.id_usuario`
  );
  if (profissionais.length) {
    console.log("\nProfissionais cadastrados:");
    profissionais.forEach((p) => console.log(`  #${p.id_usuario} ${p.nome} <${p.email}>`));
  }

  const cuidadores = await queryAll(
    `SELECT u.id_usuario, u.nome, u.email,
            (SELECT COUNT(*) FROM PACIENTE p WHERE p.id_responsavel = u.id_usuario) AS pacientes,
            (SELECT COUNT(*) FROM TRIAGEM t
               INNER JOIN PACIENTE p ON p.id_paciente = t.id_paciente
              WHERE p.id_responsavel = u.id_usuario) AS triagens,
            (SELECT COUNT(*) FROM SESSAO s
               INNER JOIN PACIENTE p ON p.id_paciente = s.id_paciente
              WHERE p.id_responsavel = u.id_usuario) AS sessoes
     FROM USUARIO u
     WHERE u.tipo_usuario = 'CUIDADOR' ORDER BY u.id_usuario`
  );
  if (cuidadores.length) {
    console.log("\nCuidadores cadastrados:");
    cuidadores.forEach((c) =>
      console.log(
        `  #${c.id_usuario} ${c.nome} <${c.email}> — ${c.pacientes} paciente(s), ` +
          `${c.triagens} triagem(ns), ${c.sessoes} consulta(s)`
      )
    );
  }

  await closeDatabase();
}

main().catch((e) => {
  console.error("Falha:", e.message);
  process.exit(1);
});
