# TEAlyze — credenciais de teste (SQL Server em Docker)

## Profissionais semeados automaticamente
Criados pelo backend na primeira execução, quando não há nenhum profissional
no banco (tabelas USUARIO + PROFISSIONAL + PROFISSIONAL_ESPECIALIDADE).

| E-mail | Senha | Papel | Nome | Especialidade |
|---|---|---|---|---|
| ana.silva@tealyze.app | senha123 | professional | Dra. Ana Silva | Psicologia |
| carlos.mendes@tealyze.app | senha123 | professional | Dr. Carlos Mendes | Terapia Ocupacional |
| juliana.rocha@tealyze.app | senha123 | professional | Dra. Juliana Rocha | Fonoaudiologia |

## Cuidador semeado automaticamente
Criado pelo backend na inicialização (`DB_RUN_SEED=true`) se o e-mail ainda não
existir; se existir mas faltar algo, o que falta é completado. Idempotente.

| E-mail | Senha | Papel | Responsável | Paciente |
|---|---|---|---|---|
| test.caregiver@tealyze.app | senha123 | caregiver | Maria Oliveira (mãe) | Lucas Oliveira |

Dados gravados no SQL Server para esse login:

- `USUARIO` + `RESPONSAVEL` (CPF 52998224725) + `PACIENTE` (CPF 11144477735)
- AQ-50 respondido, pontuação 28 (`TRIAGEM` + 50 linhas em `RESPOSTA_TRIAGEM`) —
  o login entra direto na tela inicial, sem refazer o questionário
- 3 consultas com a Dra. Ana Silva em `SESSAO` (histórico, confirmada, aguardando)
- Conversa com a Dra. Ana: `CONVERSA` + `PARTICIPANTE_CONVERSA` + 4 `MENSAGEM`
- 1 `PUBLICACAO` direcionada ao cuidador (imagem em `backend/uploads/posts`)
- Registros em `LOG_AUDITORIA`

Para testar o fluxo "primeiro acesso" (AQ + cadastro), crie outro cuidador pela
tela de cadastro ("Sou Cuidador(a)"): CPF do responsável com **11 dígitos**
(obrigatório — `RESPONSAVEL.cpf` é `CHAR(11) NOT NULL UNIQUE`).

## Observações
- A autenticação é feita pelo backend contra o SQL Server; o token é uma linha
  em `TOKEN_ACESSO` (validade padrão: 30 dias) e é enviado como
  `Authorization: Bearer <token>`.
- Senhas ficam em `USUARIO.senha_hash` no formato
  `sha256s2:<salt>:<iterações>:<hash>` — nunca em texto puro.
- Validação de CRP é MOCK (aceita o padrão `NN/NNNNNN`) e grava
  `PROFISSIONAL.crp_verificado = 1`.
- Para zerar os dados: `docker compose down -v` e suba novamente (o seed recria todos os logins de teste).
