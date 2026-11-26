"use strict";

// -----------------------------------------------------------------------
// Dados de demonstração (logins de teste).
//
// Na inicialização o backend garante, direto no SQL Server:
//
//   1. 3 PROFISSIONAIS de teste — criados só quando o banco ainda não tem
//      nenhum profissional;
//   2. 1 CUIDADOR de teste (com paciente, AQ respondido, agenda, conversa e
//      uma publicação) — criado se o e-mail de teste ainda não existir, e
//      completado se existir mas estiver faltando alguma dessas partes.
//
// Tudo é idempotente: rodar de novo não duplica nada.
// Senha de todos os logins de teste: senha123
// -----------------------------------------------------------------------
const { withTransaction } = require("../db");
const { hashPassword } = require("../crypto");
const dt = require("../datetime");
const files = require("../files");
const audit = require("../audit");
const { AQ_QUESTIONS, isAgreeScored, scoreAq, interpretAqScore } = require("./aq");
const { makeDemoPng } = require("./demoImage");
const usersRepository = require("../repositories/users");
const triagemRepository = require("../repositories/triagem");
const appointmentsRepository = require("../repositories/appointments");
const messagesRepository = require("../repositories/messages");
const postsRepository = require("../repositories/posts");

const DEMO_PASSWORD = "senha123";

const DEMO_PROFESSIONALS = [
  {
    email: "ana.silva@tealyze.app",
    name: "Dra. Ana Silva",
    cpf: "11111111111",
    crp: "06/123456",
    specialty: "Psicologia",
    formation:
      "Doutorado em Psicologia Clínica (USP), Mestrado em Neuropsicologia (UNIFESP), " +
      "Graduação em Psicologia (PUC-SP). Certificação ABA International.",
    bio: "10 anos de experiência com crianças no espectro autista.",
    phone: "(11) 98888-1111",
    latitude: -23.5605,
    longitude: -46.6543,
    address: "Av. Paulista, 1000 - São Paulo",
    teleconsulta: true,
  },
  {
    email: "carlos.mendes@tealyze.app",
    name: "Dr. Carlos Mendes",
    cpf: "22222222222",
    crp: "06/789012",
    specialty: "Terapia Ocupacional",
    formation:
      "Mestre em Terapia Ocupacional (UFSCar), Especialista em Integração Sensorial " +
      "(USC-Califórnia), Graduação em TO (Unifesp).",
    bio: "Especialista em integração sensorial e ABA.",
    phone: "(11) 97777-2222",
    latitude: -23.5489,
    longitude: -46.6388,
    address: "R. Augusta, 500 - São Paulo",
    teleconsulta: false,
  },
  {
    email: "juliana.rocha@tealyze.app",
    name: "Dra. Juliana Rocha",
    cpf: "33333333333",
    crp: "06/345678",
    specialty: "Fonoaudiologia",
    formation:
      "Mestrado em Fonoaudiologia (PUC-SP), Especialização em Comunicação Alternativa " +
      "e Ampliada (CAA), Graduação em Fonoaudiologia (USP).",
    bio: "Comunicação alternativa e desenvolvimento da fala.",
    phone: "(11) 96666-3333",
    latitude: -23.571,
    longitude: -46.642,
    address: "R. Oscar Freire, 200 - São Paulo",
    teleconsulta: true,
  },
];

const DEMO_CAREGIVER = {
  email: "test.caregiver@tealyze.app",
  caregiver_name: "Maria Oliveira",
  caregiver_cpf: "52998224725",
  grau_parentesco: "Mãe",
  profissao: "Professora",
  phone: "(11) 95555-0000",
  patient_name: "Lucas Oliveira",
  patient_cpf: "11144477735",
};

// Quantos itens do AQ o cuidador de teste "pontua" (faixa moderada: 26-31).
const DEMO_AQ_TARGET_SCORE = 28;

/** Profissionais de teste — só quando não existe nenhum profissional. */
async function seedProfessionals() {
  const total = await usersRepository.countProfessionals();
  if (total > 0) {
    console.log(`[seed] ${total} profissional(is) já cadastrado(s) — seed de profissionais ignorado`);
    return 0;
  }

  const senhaHash = hashPassword(DEMO_PASSWORD);
  let created = 0;
  for (const professional of DEMO_PROFESSIONALS) {
    try {
      await withTransaction((transaction) =>
        usersRepository.createProfessional(transaction, { ...professional, senhaHash })
      );
      created++;
    } catch (e) {
      console.warn(`[seed] não foi possível criar ${professional.email}: ${e.message}`);
    }
  }
  console.log(`[seed] ${created} profissional(is) de demonstração criado(s) (senha: ${DEMO_PASSWORD})`);
  return created;
}

/**
 * Respostas do AQ para o cuidador de teste: exatamente `target` itens pontuam
 * (concordar nos itens diretos, discordar nos invertidos); o resto não pontua.
 */
function buildDemoAqAnswers(target = DEMO_AQ_TARGET_SCORE) {
  return Array.from({ length: AQ_QUESTIONS.length }, (_, i) => {
    const scores = i < target;
    if (isAgreeScored(i)) return scores ? 0 : 3; // 0 = concordo totalmente
    return scores ? 3 : 0; // 3 = discordo totalmente
  });
}

/** Horário "de parede" (mesma regra do datetime.js): hoje + N dias, às HH:MM. */
function wallClock(daysFromToday, hour, minute = 0) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday, hour, minute, 0)
  );
}

/** Profissional usado nos dados do cuidador: a Dra. Ana, ou o primeiro que existir. */
async function pickDemoProfessional() {
  const list = await usersRepository.listProfessionals();
  if (!list.length) return null;
  return list.find((p) => p.email === DEMO_PROFESSIONALS[0].email) || list[0];
}

async function seedCaregiverAq(idPaciente, idUsuario) {
  if (await triagemRepository.getLatestAq(idPaciente)) return false;

  const answers = buildDemoAqAnswers();
  const score = scoreAq(answers);
  const idTriagem = await withTransaction((transaction) =>
    triagemRepository.saveAq(transaction, {
      idPaciente,
      answers,
      score,
      interpretation: interpretAqScore(score),
    })
  );
  await audit.log(idUsuario, "TRIAGEM_AQ", "TRIAGEM", idTriagem, `AQ-50 de demonstração (pontuação ${score})`);
  return true;
}

async function seedCaregiverAppointments({ idUsuario, idPaciente, professional }) {
  const existing = await appointmentsRepository.listForCaregiver(idUsuario);
  if (existing.length > 0) return 0;

  const idProfissional = Number(professional.id);
  const local = professional.address || null;
  const plan = [
    { when: wallClock(-7, 14), status: "confirmed", notes: "Primeira avaliação (consulta de exemplo no histórico)" },
    { when: wallClock(2, 14), status: "confirmed", notes: "Retorno — consulta confirmada pelo profissional" },
    { when: wallClock(6, 10), status: "scheduled", notes: "Consulta aguardando confirmação do profissional" },
  ];

  let created = 0;
  for (const item of plan) {
    try {
      const fim = dt.addMinutes(item.when, 60);
      if (await appointmentsRepository.hasConflict(idProfissional, item.when, fim)) continue;
      const idSessao = await appointmentsRepository.insert({
        idPaciente,
        idProfissional,
        inicio: item.when,
        fim,
        local,
        notes: item.notes,
      });
      if (item.status !== "scheduled") await appointmentsRepository.updateStatus(idSessao, item.status);
      await audit.log(idUsuario, "AGENDAR", "SESSAO", idSessao, "Consulta de demonstração");
      created++;
    } catch (e) {
      console.warn(`[seed] não foi possível criar consulta de exemplo: ${e.message}`);
    }
  }
  return created;
}

async function seedCaregiverChat({ idUsuario, professional }) {
  const idProfissional = Number(professional.id);
  if (await messagesRepository.findConversation(idUsuario, idProfissional)) return 0;

  const idConversa = await messagesRepository.findOrCreateConversation(idUsuario, idProfissional);
  const script = [
    [idUsuario, "Olá, doutora! Gostaria de saber como devemos nos preparar para a próxima consulta do Lucas."],
    [idProfissional, "Olá, Maria! Tudo bem? Traga o caderno de rotina da semana e, se possível, anote os horários de sono."],
    [idUsuario, "Perfeito, vou levar. Muito obrigada!"],
    [idProfissional, "Imagina! Já deixei um material de atividades para vocês na aba Início."],
  ];
  for (const [autor, texto] of script) {
    await messagesRepository.insertMessage(idConversa, autor, texto);
  }
  return script.length;
}

async function seedCaregiverPost({ idUsuario, professional }) {
  // Se o cuidador já enxerga alguma publicação (inclusive públicas), não cria outra.
  const visible = await postsRepository.listVisibleToCaregiver(idUsuario);
  if (visible.length > 0) return 0;

  const saved = files.saveBase64("posts", makeDemoPng().toString("base64"), "image/png");
  saved.mimeType = "image/png";
  try {
    const idPublicacao = await postsRepository.insert({
      idProfissional: Number(professional.id),
      idResponsavelDestino: idUsuario,
      legenda: "Atividade sensorial para casa: repetir 3x por semana, 10 minutos por sessão.",
      file: saved,
    });
    await audit.log(Number(professional.id), "PUBLICAR", "PUBLICACAO", idPublicacao, "Publicação de demonstração");
    return 1;
  } catch (e) {
    files.remove(saved.relativePath); // não deixa arquivo órfão
    throw e;
  }
}

/**
 * Cuidador de teste. Cria USUARIO + RESPONSAVEL + PACIENTE se o e-mail ainda
 * não existe e depois completa o que estiver faltando: AQ (TRIAGEM +
 * RESPOSTA_TRIAGEM), agenda (SESSAO), conversa (CONVERSA + PARTICIPANTE_CONVERSA
 * + MENSAGEM) e uma publicação (PUBLICACAO), tudo vinculado a um profissional.
 */
async function seedCaregiver() {
  const summary = { created: false, aq: false, appointments: 0, messages: 0, posts: 0 };

  let row = await usersRepository.findRowByEmail(DEMO_CAREGIVER.email);
  if (row && usersRepository.roleFromTipo(row.tipo_usuario) !== "caregiver") {
    console.warn(`[seed] ${DEMO_CAREGIVER.email} já existe com outro perfil — cuidador de teste ignorado`);
    return summary;
  }

  if (!row) {
    try {
      const { idUsuario } = await withTransaction((transaction) =>
        usersRepository.createCaregiver(transaction, {
          ...DEMO_CAREGIVER,
          senhaHash: hashPassword(DEMO_PASSWORD),
        })
      );
      await audit.log(idUsuario, "CADASTRO", "USUARIO", idUsuario, "Cuidador de demonstração criado pelo seed");
      summary.created = true;
      row = await usersRepository.findRowByEmail(DEMO_CAREGIVER.email);
    } catch (e) {
      // Ex.: o CPF de teste já pertence a outro responsável.
      console.warn(`[seed] não foi possível criar o cuidador de teste: ${e.message}`);
      return summary;
    }
  }

  const idUsuario = row.id_usuario;
  const idPaciente =
    row.id_paciente || (await usersRepository.getPacienteIdForResponsavel(idUsuario));
  if (!idPaciente) {
    console.warn("[seed] cuidador de teste sem paciente vinculado — dados de exemplo ignorados");
    return summary;
  }

  summary.aq = await seedCaregiverAq(idPaciente, idUsuario);

  const professional = await pickDemoProfessional();
  if (!professional) {
    console.warn("[seed] nenhum profissional cadastrado — agenda, conversa e publicação de exemplo ignoradas");
  } else {
    const ctx = { idUsuario, idPaciente, professional };
    for (const [key, fn] of [
      ["appointments", seedCaregiverAppointments],
      ["messages", seedCaregiverChat],
      ["posts", seedCaregiverPost],
    ]) {
      try {
        summary[key] = await fn(ctx);
      } catch (e) {
        console.warn(`[seed] falha ao criar ${key} de exemplo do cuidador: ${e.message}`);
      }
    }
  }

  if (summary.created) {
    console.log(
      `[seed] cuidador de demonstração criado: ${DEMO_CAREGIVER.email} (senha: ${DEMO_PASSWORD}) — ` +
        `AQ ${summary.aq ? "ok" : "já existia"}, ${summary.appointments} consulta(s), ` +
        `${summary.messages} mensagem(ns), ${summary.posts} publicação(ões)`
    );
  } else if (summary.aq || summary.appointments || summary.messages || summary.posts) {
    console.log(`[seed] cuidador de teste ${DEMO_CAREGIVER.email} completado com dados de exemplo que faltavam`);
  } else {
    console.log(`[seed] cuidador de teste ${DEMO_CAREGIVER.email} já está completo — nada a fazer`);
  }
  return summary;
}

/** Ponto de entrada: profissionais primeiro (o cuidador de teste usa um deles). */
async function seedIfNeeded() {
  const professionals = await seedProfessionals();
  let caregiver = null;
  try {
    caregiver = await seedCaregiver();
  } catch (e) {
    console.warn(`[seed] falha no seed do cuidador de teste: ${e.message}`);
  }
  return { professionals, caregiver };
}

module.exports = {
  seedIfNeeded,
  seedProfessionals,
  seedCaregiver,
  buildDemoAqAnswers,
  DEMO_PROFESSIONALS,
  DEMO_CAREGIVER,
  DEMO_PASSWORD,
};
