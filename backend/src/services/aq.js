"use strict";

// -----------------------------------------------------------------------
// Questionário AQ-50 (perguntas + pontuação).
//
// Mesmo conteúdo e mesma regra de pontuação da versão anterior do app, mas
// agora servido pelo backend (rota GET /aq/questions) e com o resultado
// gravado no SQL Server (tabelas TRIAGEM / RESPOSTA_TRIAGEM).
// -----------------------------------------------------------------------

const AQ_QUESTIONS = [
  "Prefiro fazer coisas com outras pessoas do que sozinho(a).",
  "Prefiro fazer as coisas da mesma forma, repetidamente.",
  "Se tento imaginar algo, é fácil criar uma imagem em minha mente.",
  "Costumo ficar tão absorto(a) em algo que perco a noção das outras coisas.",
  "Frequentemente noto pequenos sons quando outros não notam.",
  "Costumo notar placas de carros ou sequências de informação semelhantes.",
  "Outras pessoas frequentemente me dizem que o que eu disse foi indelicado.",
  "Quando leio uma história, consigo facilmente imaginar como os personagens podem parecer.",
  "Sou fascinado(a) por datas.",
  "Em um grupo social, consigo acompanhar as conversas de várias pessoas.",
  "Acho fácil situações sociais.",
  "Tendo a notar detalhes que outros não notam.",
  "Prefiro ir a uma biblioteca do que a uma festa.",
  "Acho fácil inventar histórias.",
  "Sou mais atraído(a) por pessoas do que por coisas.",
  "Costumo ter interesses muito fortes que fico chateado(a) se não puder buscá-los.",
  "Gosto de conversa fiada.",
  "Quando falo, nem sempre é fácil para outros ficarem 'na conversa'.",
  "Sou fascinado(a) por números.",
  "Ao ler uma história, tenho dificuldade em entender as intenções dos personagens.",
  "Não gosto particularmente de ler ficção.",
  "Acho difícil fazer novos amigos.",
  "Noto padrões nas coisas o tempo todo.",
  "Prefiro ir ao teatro do que a um museu.",
  "Não me perturba quando minha rotina diária é interrompida.",
  "Frequentemente não sei como manter uma conversa.",
  "Acho fácil 'ler nas entrelinhas' quando alguém está falando comigo.",
  "Costumo focar mais no quadro geral do que em pequenos detalhes.",
  "Não sou muito bom(a) em memorizar números de telefone.",
  "Geralmente não noto pequenas mudanças em situações ou aparência de alguém.",
  "Sei se alguém que me ouve está ficando entediado(a).",
  "Acho fácil fazer mais de uma coisa ao mesmo tempo.",
  "Ao falar ao telefone, não sei quando é minha vez de falar.",
  "Gosto de fazer coisas espontaneamente.",
  "Costumo ser o(a) último(a) a entender o sentido de uma piada.",
  "Acho fácil descobrir o que outra pessoa está pensando ou sentindo apenas olhando para o rosto dela.",
  "Se sou interrompido(a), posso voltar rapidamente ao que estava fazendo.",
  "Sou bom(a) em conversa fiada.",
  "Frequentemente as pessoas me dizem que fico repetindo a mesma coisa.",
  "Quando era criança, costumava gostar de brincar de faz de conta com outras crianças.",
  "Gosto de coletar informações sobre categorias de coisas.",
  "Acho difícil imaginar como seria ser outra pessoa.",
  "Gosto de planejar cuidadosamente qualquer atividade da qual participo.",
  "Gosto de ocasiões sociais.",
  "Acho difícil entender as intenções das pessoas.",
  "Novas situações me deixam ansioso(a).",
  "Gosto de conhecer novas pessoas.",
  "Sou uma boa pessoa diplomática.",
  "Não sou muito bom(a) em lembrar aniversários das pessoas.",
  "Acho muito fácil brincar de faz de conta com crianças.",
];

// Chave oficial de pontuação do AQ-50 (Baron-Cohen et al., 2001).
// Itens numerados de 1 a 50, como no questionário.
//
//  - "Concordo totalmente/um pouco" (respostas 0/1) vale 1 ponto nestes itens:
const AQ_AGREE_ITEMS = new Set([
  2, 4, 5, 6, 7, 9, 12, 13, 16, 18, 19, 20, 21, 22, 23, 26, 33, 35, 39, 41, 42, 43, 45, 46,
]);
//  - "Discordo um pouco/totalmente" (respostas 2/3) vale 1 ponto em todos os demais
//    (itens redigidos no sentido contrário, ex.: "Acho fácil situações sociais").
const AQ_AGREE_IDX = new Set(Array.from(AQ_AGREE_ITEMS, (i) => i - 1));
const AQ_DISAGREE_IDX = new Set(
  Array.from({ length: 50 }, (_, i) => i).filter((i) => !AQ_AGREE_IDX.has(i))
);

/** true se, para o item de índice 0-based `index`, concordar é o que pontua. */
function isAgreeScored(index) {
  return AQ_AGREE_IDX.has(index);
}

function scoreAq(answers) {
  let score = 0;
  answers.slice(0, 50).forEach((a, i) => {
    if (AQ_AGREE_IDX.has(i) && (a === 0 || a === 1)) score += 1;
    else if (AQ_DISAGREE_IDX.has(i) && (a === 2 || a === 3)) score += 1;
  });
  return score;
}

function interpretAqScore(score) {
  if (score >= 32) {
    return "Pontuação alta (≥32): traços característicos do TEA presentes; consulte um profissional.";
  }
  if (score >= 26) {
    return "Pontuação moderada (26-31): alguns traços presentes; considere avaliação profissional.";
  }
  return "Pontuação baixa (<26): poucos traços do espectro identificados.";
}

module.exports = { AQ_QUESTIONS, AQ_AGREE_ITEMS, isAgreeScored, scoreAq, interpretAqScore };
