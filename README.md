# TEAlyze — app + API + SQL Server no Docker

O aplicativo **não usa mais banco local**. Agora todos os dados (usuários,
responsáveis, pacientes, profissionais, triagens AQ, agenda, chat,
publicações, laudos e auditoria) ficam no **SQL Server rodando em Docker**,
usando o schema de `database/01_schema.sql`.

```
┌──────────────────────┐      HTTP/JSON      ┌──────────────┐     TDS/1433    ┌──────────────────────┐
│  frontend (Expo)     │ ──────────────────► │  backend     │ ──────────────► │  SQL Server (Docker) │
│  React Native / web  │  /auth /posts ...   │  Node+Express│   driver mssql  │  database TEALYZE    │
└──────────────────────┘                     └──────────────┘                 └──────────────────────┘
```

Por que existe o backend: React Native **não** tem driver TDS, ou seja, o app
não consegue abrir conexão direto no SQL Server (e nem deveria, pois a senha
do banco ficaria dentro do aplicativo). O backend é a camada que fala SQL.

Como o app já chamava tudo por um único ponto (`apiFetch(path, token, options)`),
a migração não exigiu reescrever as telas — só o que acontece dentro do
`apiFetch` mudou: antes era SQLite local, agora é HTTP para a API. (Depois da
migração algumas telas ganharam correções pontuais; veja a seção 10.)

---

## 1. Estrutura

```
tealyze/
├── docker-compose.yml          # SQL Server + backend, prontos para subir
├── database/
│   ├── 01_schema.sql           # SEU script original, sem alterações
│   └── 02_app_extensions.sql   # colunas/tabelas extras (idempotente)
├── backend/                    # API Node.js + Express + mssql
│   ├── .env / .env.example     # host, senha e opções do banco
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.js            # inicialização (espera o banco, migra, sobe)
│   │   ├── db.js               # pool, criação do database, migrações
│   │   ├── routes/             # /auth /aq /posts /professionals /chat /appointments /laudo /profile
│   │   ├── repositories/       # SQL por assunto (users, appointments, ...)
│   │   └── services/           # AQ, OCR de laudo, seed (logins de teste), tokens
│   ├── test/smoke.js           # 74 verificações das rotas (sem precisar de banco)
│   ├── test/seed.js            # 10 verificações do seed dos logins de teste
│   ├── test/ocr.js             # 15 verificações da leitura de laudo por IA (provedor simulado)
│   ├── test/summary.js         # 14 verificações do resumo de documentos do profissional
│   └── uploads/                # imagens de publicações e laudos
├── frontend/                   # app Expo (celular e navegador)
│   ├── .env                    # EXPO_PUBLIC_API_URL
│   ├── app/(tabs)/profile.tsx  # aba Perfil (Dados · Laudos · Triagem · Ajustes)
│   ├── src/theme.ts            # paletas claro/escuro (+ alto contraste)
│   ├── src/components/         # perfil, análise de laudo, mapa (nativo + web/Leaflet)
│   ├── scripts/                # check-theme (contraste) e check-colors (cores fixas)
│   └── src/auth.tsx            # cliente HTTP + contexto de autenticação
└── memory/                     # PRD e credenciais de teste
```

---

## 2. Como rodar

### Opção A — subir tudo pelo Docker (recomendado)

```bash
cd tealyze
docker compose up -d --build
docker compose logs -f backend
```

Espere aparecer no log:

```
[db] conectado em sqlserver:1433/TEALYZE
[seed] 3 profissional(is) de demonstração criado(s) (senha: senha123)
[seed] cuidador de demonstração criado: test.caregiver@tealyze.app (senha: senha123) — AQ ok, 3 consulta(s), 4 mensagem(ns), 1 publicação(ões)
[boot] API ouvindo em http://0.0.0.0:3000
```

Confira a API: <http://localhost:3000/health>

Depois, o app:

```bash
cd frontend
npm install
npx expo start
```

Abra com `w` (navegador), no emulador ou no Expo Go.

### Opção B — usar o container de SQL Server que você já tem

Se o seu container (`SQL_HAS`) já está rodando com a porta 1433 publicada:

```bash
docker start SQL_HAS          # se estiver parado

cd tealyze/backend
cp .env.example .env          # DB_HOST=localhost já é o padrão
npm install
npm start                     # cria o database, aplica os scripts e sobe a API
```

Em outro terminal:

```bash
cd tealyze/frontend
npm install
npx expo start
```

> O backend **cria o database TEALYZE se não existir** e aplica
> `01_schema.sql` (só quando o banco está vazio) + `02_app_extensions.sql`
> (sempre, pois é idempotente). Se você já criou o schema no SSMS, ele
> apenas complementa o que falta (e corrige o `UNIQUE` de `PACIENTE.id_usuario`,
> ver seção 4).

---

## 3. Para onde o app deve apontar (`frontend/.env`)

| Onde você abre o app | `EXPO_PUBLIC_API_URL` |
|---|---|
| Navegador (`w`) ou emulador iOS | `http://localhost:3000` |
| Emulador Android | `http://10.0.2.2:3000` |
| Celular físico (Expo Go) | `http://SEU_IP_NA_REDE:3000` (ex.: `http://192.168.0.15:3000`) |

Descubra seu IP com `ipconfig` (Windows) ou `ip addr` (Linux/Mac). O celular
precisa estar na mesma rede Wi-Fi do computador. Se a variável ficar vazia, o
app tenta adivinhar o IP da máquina que serve o Metro.

---

## 4. Como o app foi mapeado no seu banco

| Conceito no app | Tabelas usadas |
|---|---|
| Usuário cuidador | `USUARIO` + `RESPONSAVEL` + `PACIENTE` |
| Usuário profissional | `USUARIO` + `PROFISSIONAL` + `ESPECIALIDADE` / `PROFISSIONAL_ESPECIALIDADE` |
| Login / sessão | `TOKEN_ACESSO` *(nova)* |
| Questionário AQ-50 | `TRIAGEM` + `RESPOSTA_TRIAGEM` (50 linhas por envio) |
| Agenda / consultas | `SESSAO` (`AGENDADA` / `CONFIRMADA` / `CANCELADA`) |
| Chat | `CONVERSA` + `PARTICIPANTE_CONVERSA` + `MENSAGEM` |
| Laudo + análise | `LAUDO` + `LAUDO_ANALISE_IA` *(nova)* |
| Feed de materiais | `PUBLICACAO` *(nova)* |
| Trilha de auditoria | `LOG_AUDITORIA` (login, cadastro, agendamento, laudo, etc.) |

O que `02_app_extensions.sql` acrescenta, sem tocar no seu script:

- `PACIENTE.cpf`
- `PROFISSIONAL.crp_verificado`, `PROFISSIONAL.formacao`
- `SESSAO.local_atendimento`, `SESSAO.data_cadastro`
- `LAUDO.mime_type`
- tabelas `TOKEN_ACESSO`, `PUBLICACAO`, `LAUDO_ANALISE_IA`
- três índices de apoio (chat, participantes, triagem)
- **correção:** a restrição `UNIQUE` de `PACIENTE.id_usuario` (anulável) vira o
  índice único filtrado `UX_PACIENTE_USUARIO ... WHERE id_usuario IS NOT NULL`.
  No SQL Server um `UNIQUE` aceita só um `NULL`, e o app cadastra o paciente
  sem `id_usuario` — então só o primeiro cuidador conseguia se cadastrar

Senhas: nunca trafegam nem ficam em texto puro — `USUARIO.senha_hash` guarda
`sha256s2:<salt>:<iterações>:<hash>` (SHA-256 com salt e 2000 iterações),
calculado no servidor.

---

## 5. Rotas da API

| Método | Rota | Observação |
|---|---|---|
| POST | `/auth/login` | devolve `{ token, user }` |
| POST | `/auth/register/caregiver` | CPF do responsável obrigatório (11 dígitos) |
| POST | `/auth/register/professional` | CRP no formato `NN/NNNNNN` |
| GET | `/auth/me` | usuário da sessão |
| POST | `/auth/logout` | apaga o token no banco |
| GET | `/aq/questions` · POST `/aq/submit` | AQ-50 |
| GET | `/professionals` · `/professionals/:id` | mapa e perfil |
| GET/POST | `/posts` · DELETE `/posts/:id` | feed de materiais |
| GET | `/chat` · `/chat/:id` · POST `/chat/send` | mensagens |
| POST | `/appointments` · GET `/appointments/mine` · `/appointments/upcoming` | agenda |
| POST | `/appointments/:id/confirm` · DELETE `/appointments/:id` | confirmar / cancelar |
| POST | `/laudo/analyze` · GET `/laudo/mine` | enviar e listar laudos |
| GET | `/laudo/:id` · POST `/laudo/:id/reanalyze` · GET `/laudo/ocr-status` | detalhe (com imagem), nova análise e estado da IA |
| GET | `/laudo/summary` · GET `/laudo/summary/:caregiverId` · PUT `/laudo/:id/explanation` | resumo de documentos (cuidador vê o seu; profissional vê o de famílias que atende) e explicação de alerta |
| GET | `/profile` · PUT `/profile` · POST `/profile/password` | perfil completo, edição parcial e troca de senha |
| PUT | `/posts/:id` | editar a legenda de uma publicação (só o autor) |
| GET | `/health` | diagnóstico (banco + hora do servidor) |

Erros sempre voltam como `{ "detail": "mensagem" }` — é essa mensagem que
aparece na tela do app.

---

## 6. Ferramentas de conferência

```bash
cd backend

npm run check-db     # conexão + tabelas + contagem de registros + profissionais
npm test             # rotas (74) + seed (10) + OCR (15) + resumo de documentos (14), sem Docker e sem internet
node test/smoke.js   # só as rotas (banco simulado)
node test/seed.js    # só o seed (repositórios em memória)
node test/ocr.js     # só o OCR (provedor de IA simulado)
npm run test-ocr     # confere SUA chave de IA de verdade (veja a seção 8)

cd ../frontend
npm run check-theme   # contraste WCAG de todos os pares de cores (claro, escuro e alto contraste)
npm run check-colors  # nenhuma cor fixa / Text sem cor nas telas (nada escapa do modo escuro)
npm run check-map     # escolha das fontes do mapa web e conferência da chave (respostas simuladas)
npx tsc --noEmit      # tipagem
npm run lint
```

---

## 7. Dados de teste (logins de teste)

Quando o backend sobe (com `DB_RUN_SEED=true`, o padrão), ele garante estes
logins **direto no SQL Server**. Senha de todos: `senha123`.

**Profissionais** — criados quando o banco não tem nenhum profissional:

| E-mail | Senha | Especialidade |
|---|---|---|
| ana.silva@tealyze.app | senha123 | Psicologia |
| carlos.mendes@tealyze.app | senha123 | Terapia Ocupacional |
| juliana.rocha@tealyze.app | senha123 | Fonoaudiologia |

**Cuidador** — criado se o e-mail ainda não existir (e completado se existir
mas faltar alguma parte):

| E-mail | Senha | Responsável | Paciente |
|---|---|---|---|
| test.caregiver@tealyze.app | senha123 | Maria Oliveira (mãe) | Lucas Oliveira |

O que fica gravado para o cuidador de teste e em qual tabela:

| Dado | Tabelas |
|---|---|
| Login, responsável e paciente | `USUARIO` + `RESPONSAVEL` + `PACIENTE` |
| AQ-50 já respondido (pontuação 28, faixa moderada) — por isso o login cai direto na tela inicial | `TRIAGEM` + `RESPOSTA_TRIAGEM` (50 linhas) |
| 3 consultas com a Dra. Ana: uma no histórico, uma confirmada, uma aguardando confirmação | `SESSAO` |
| Conversa com a Dra. Ana (4 mensagens) | `CONVERSA` + `PARTICIPANTE_CONVERSA` + `MENSAGEM` |
| Publicação de atividade direcionada ao cuidador (imagem em `uploads/posts`) | `PUBLICACAO` |
| Trilha de auditoria | `LOG_AUDITORIA` |

Laudo não é semeado (depende de um arquivo real enviado pelo app).

O seed é idempotente: reiniciar não duplica nada, e se você apagar só uma parte
(ex.: a agenda) ela é recriada na próxima inicialização. Para rodar à mão:
`npm run seed` (dentro de `backend/`). Para recomeçar do zero:
`docker compose down -v`.

Outros cuidadores: crie pela tela de cadastro ("Sou Cuidador(a)"). Informe um
**CPF com 11 dígitos** para o responsável — a coluna `RESPONSAVEL.cpf` é
`CHAR(11) NOT NULL UNIQUE` no seu schema. O CPF do paciente é opcional, mas se
for preenchido precisa ter 11 dígitos.

---

## 8. Leitura de laudo por IA gratuita (opcional)

Sem configurar nada, o laudo é enviado, salvo em disco, registrado em `LAUDO`
e a checagem de fraude roda comparando com os laudos anteriores do mesmo
cuidador (tudo dentro do banco). Para ligar a leitura automática (OCR) com uma
**IA gratuita** — o Google Gemini, que não pede cartão:

1. Abra <https://aistudio.google.com/apikey>, entre com uma conta Google e crie uma chave.
2. Coloque a chave em `OCR_API_KEY`:
   - **com Docker:** crie um arquivo `.env` **ao lado do `docker-compose.yml`** com
     `OCR_API_KEY=sua-chave` e rode `docker compose up -d`;
   - **sem Docker:** edite `backend/.env`.
3. Confira se funcionou, sem precisar enviar um laudo:

```bash
docker compose exec backend npm run test-ocr     # ou, sem Docker: cd backend && npm run test-ocr
```

Deve responder `✓ A IA respondeu ... usando o modelo "gemini-flash-lite-latest"`.
Na aba **Perfil → Laudos** aparece "Leitura automática por IA ativa (gemini)".

**Como funciona:** os modelos `gemini-flash-lite-latest`, `gemini-flash-latest` e
`gemini-3.5-flash-lite` são tentados em ordem — se um estiver sem cota, aposentado
ou fora do ar, o próximo assume. Os erros viram mensagens claras no laudo
("limite gratuito atingido", "chave recusada", "sem rede"...), e em **Perfil → Laudos →
Analisar novamente** dá para repetir a análise depois, sem reenviar o arquivo.

**Outros provedores:** `OCR_PROVIDER=openai` (chave `sk-...`), ou qualquer serviço compatível com a
API da OpenAI via `OCR_API_URL` + `OCR_MODEL` (vários modelos separados por vírgula).

> **Privacidade (LGPD):** no plano gratuito o Google pode usar o conteúdo enviado para
> melhorar seus produtos. Laudos são dados de saúde: para uso real com pacientes, use
> um plano pago ou um provedor com termos de privacidade adequados. O limite gratuito
> também muda com o tempo (consulte <https://ai.google.dev/gemini-api/docs/rate-limits>).

Essa é a **única** chamada externa do sistema, e fica no servidor — a chave nunca vai para o aplicativo.

---

## 9. Se algo der errado

| Sintoma | O que verificar |
|---|---|
| `Bind for 0.0.0.0:1433 failed: port is already allocated` — o backend fica em `Created` e `docker compose logs -f backend` não mostra nada | Outro SQL Server (ex.: o container `SQL_HAS` ou uma instalação no Windows) usa a 1433. Pare-o (`docker stop SQL_HAS`) **ou** publique o novo banco em outra porta: no PowerShell `$env:SQLSERVER_HOST_PORT=1434; docker compose up -d --build` (Linux/macOS: `SQLSERVER_HOST_PORT=1434 docker compose up -d --build`). O backend não é afetado; só quem conecta de fora (SSMS) usa `localhost,1434` |
| `aguardando SQL Server ... ECONNREFUSED` | `docker ps` mostra o container? `docker port SQL_HAS` mostra `1433`? |
| `Login failed for user 'sa'` | `DB_PASSWORD` no `.env` precisa ser exatamente `*123456HAS*` (a senha do seu container) |
| App diz "Não foi possível falar com o servidor" | abra `http://localhost:3000/health` no navegador; se responder, o problema é o `EXPO_PUBLIC_API_URL` (celular precisa do IP da rede, não `localhost`) |
| Login antes funcionava e parou | reinicie o app: o token fica em `TOKEN_ACESSO` e expira em 30 dias (`TOKEN_TTL_DAYS`) |
| Quero recomeçar o banco do zero | `docker compose down -v` e suba de novo (apaga o volume de dados) |
| Horário da consulta aparece deslocado | mantenha o mesmo fuso nos containers (`TZ=America/Sao_Paulo`, já definido no compose) |

Depois de mudar `frontend/.env`, reinicie o Expo limpando o cache:
`npx expo start -c`.

---

## 10. Correções feitas após a migração

**Banco / backend**

- `PACIENTE.id_usuario UNIQUE` só aceitava um `NULL`: o segundo cuidador a se
  cadastrar recebia "Registro duplicado". Corrigido em `02_app_extensions.sql`
  (índice único filtrado).
- Pontuação do AQ-50: a lista de itens em que "concordar" pontua estava errada
  (7 itens invertidos contavam ao contrário e 10 itens diretos ficavam de fora).
  Agora segue a chave oficial (Baron-Cohen et al., 2001): 24 itens diretos e 26
  invertidos. **Triagens já gravadas antes desta correção mantêm a pontuação
  antiga**; peça para refazer o questionário se precisar do valor correto.
- CPF do paciente com tamanho errado era aceito e podia estourar a coluna
  (`VARCHAR(14)`); agora devolve uma mensagem clara.
- Falha no seed não derruba mais a inicialização da API.

**App**

- Agenda e lista de mensagens agora atualizam ao voltar para a aba (antes uma
  consulta recém-agendada só aparecia após puxar para atualizar).
- Chat do profissional mostrava "Usuário" no lugar do nome do cuidador.
- Mapa não quebra mais com profissional sem coordenadas.
- Questionário AQ mostra erro de carregamento/envio (antes falhava em silêncio).
- Agendamento valida data/hora (aceita `9:30`) antes de enviar.
- Fotos de publicação/laudo enviam o tipo real da imagem; seletor de imagens
  usa a API atual do `expo-image-picker`.
- Mensagem digitada não se perde quando o envio falha.

---

## 11. Novidades (pedidas em MODIFICAÇÕES.txt)

- **IA gratuita no OCR:** Gemini como padrão, com troca automática de modelo, mensagens de erro
  específicas, `GET /laudo/ocr-status`, `POST /laudo/:id/reanalyze` e `npm run test-ocr` (seção 8).
- **Aba Perfil** (substitui "Ajustes", que virou uma seção dela): **Dados** (informações pessoais,
  paciente/dados profissionais e troca de senha), **Laudos** (lista com imagem e análise do OCR),
  **Triagem** (resultado do AQ-50) e **Ajustes** (tema, letra, brilho, alto contraste, sair).
  Tudo é lido e gravado no SQL Server (`GET/PUT /profile`, `GET /laudo/mine`) — **nada fica em
  cache do aparelho**: os mesmos dados aparecem em qualquer dispositivo. E-mail, CPF e registro
  profissional são somente leitura.
- **Botão voltar do laudo** leva sempre à tela inicial (também funciona abrindo a página direto,
  e no botão físico do Android).
- **Mapa no PC:** no navegador usa Leaflet; no celular continua o `react-native-maps`. Claro: OpenStreetMap
  (sem chave). Escuro: CARTO Dark Matter, que exige chave grátis (ver seção 12).
- **Modo escuro em todo o app** (Perfil → Ajustes → Tema: Sistema, Claro ou Escuro; funciona junto
  com o alto contraste). As cores vivem em `frontend/src/theme.ts` e as telas só usam a paleta do tema.
  Dois verificadores impedem regressões: `check-theme` (contraste de todos os pares de cores) e
  `check-colors` (cor fixa no código, `Text`/ícone sem cor, `colors` global antigo).

**Para atualizar um banco já existente:** nada a fazer — não há scripts SQL novos; basta
`docker compose up -d --build`.

---

## 12. Ajustes da segunda rodada

- **Nome da página:** o título do navegador (e o nome do app) agora é **Tealyze** (`app.json`:
  `name`, `slug`, `scheme`; `package.json`). A pasta continua se chamando `frontend`.
- **Publicações do profissional:** o ícone de **lixeira** do canto superior direito foi trocado por um
  **lápis** que edita a **legenda** (`PUT /posts/:id`; só o autor pode). O botão grande
  "Excluir publicação" do rodapé foi mantido — ele some enquanto a legenda está sendo editada.
- **Tema na tela da publicação:** cabeçalho (nome do profissional) e legenda seguem o tema —
  escuros com letras claras no tema escuro, claros com letras escuras no tema claro.
- **Proporção das imagens:** feed e publicação mostram a foto inteira na proporção real (retrato,
  paisagem ou quadrada), sem cortar nem esticar. No feed, fotos muito altas são reduzidas para
  caber (limite de 560 px); na publicação aparecem no tamanho proporcional completo.
- **Mapa só para cuidadores:** na conta de profissional a aba Mapa não aparece e a rota `/map`
  volta ao início.
- **Mapa no PC — aviso "API KEY REQUIRED":** a CARTO (mapa escuro) passou a exigir uma chave grátis e,
  sem ela, devolve blocos carimbados com esse aviso (com resposta "200 OK", por isso não parece erro).
  Agora o mapa escuro usa o endereço novo com a sua chave:
  `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=SUA_CHAVE`.
  - **Onde:** `frontend/.env` → `EXPO_PUBLIC_MAP_API_KEY` (já preenchida). Chave nova: <https://carto.com/basemaps/apikey>
    (grátis até 5 milhões de blocos/mês, chega por e-mail, não precisa de conta).
  - **Depois de mexer no `.env`:** pare o Expo e rode `npx expo start -c` (o Metro guarda o `.env` em cache) e,
    no navegador, `Ctrl+F5` (blocos antigos com o aviso ficam em cache do navegador).
  - **Autoverificação:** antes de mostrar o mapa da CARTO, o app compara um bloco pedido com e sem a chave;
    se forem idênticos (chave ignorada) ou a CARTO recusar, ele usa o OpenStreetMap escurecido — o aviso
    nunca aparece. Sem chave, o tema escuro já usa o OpenStreetMap escurecido direto.
  - **Segurança:** a chave de um app web fica visível no navegador (é assim em qualquer mapa web). No painel
    da CARTO dá para restringir por domínio; para um projeto acadêmico não é necessário.
  - **Outro provedor:** preencha `EXPO_PUBLIC_MAP_TILES_URL` (com `{key}` onde a chave entra).

---

## 13. Resumo de documentos para o profissional

O profissional consegue conferir se os documentos enviados por uma família têm consistência, **sem nota e sem
julgamento sobre a pessoa**. A decisão de projeto (e o porquê) é parte importante do trabalho:

- **Não existe nota nem pontuação guardada.** Uma nota de "honestidade" de 0 a 100 puniria famílias honestas por
  foto tremida, apelido ou o nome de outro familiar no documento (a IA erra), criaria estigma sobre dados de saúde de
  crianças e esbarraria na LGPD (decisão automatizada sobre uma pessoa, art. 20). Em vez disso, o resumo é
  **calculado na hora** (`backend/src/services/laudoSummary.js`) a partir das análises já existentes.
- **Conteúdo:** só contagens ("4 laudos enviados · 2 sem alertas · 1 com alerta") e, quando há alerta forte,
  motivos objetivos e genéricos. O profissional **nunca recebe** a imagem, o texto, o nome, o CPF nem o diagnóstico do laudo.
- **Só alerta forte conta** (risco alto da checagem cruzada). Pontos de atenção leves não aparecem.
- **Laudo que a IA não leu** (sem chave, sem cota, sem rede) **nunca vira alerta**: aparece como "aguardando leitura".
  A coluna `LAUDO_ANALISE_IA.lido_por_ia` (criada em `02_app_extensions.sql`) registra se a IA realmente leu.
- **Só para quem atende a família:** o servidor recusa (403) se o profissional não tiver ao menos uma consulta não
  cancelada com aquela família (`appointmentsRepository.hasActiveRelation`). Cada consulta ao resumo é registrada em
  `LOG_AUDITORIA` (`VER_RESUMO_LAUDOS`).
- **Transparência e direito de resposta:** o cuidador vê, em **Perfil → Laudos → "O que os profissionais veem"**,
  exatamente o mesmo resumo. Em laudos com alerta ele pode escrever uma **explicação** (até 500 caracteres,
  `LAUDO.explicacao_cuidador`), que o profissional vê junto do alerta, e pode pedir **nova análise**.
- **Onde aparece para o profissional:** cartão recolhível "Documentos da família" na **Agenda** (consultas não
  canceladas) e sob o cabeçalho da **conversa** com o cuidador. O cartão só consulta o servidor quando é aberto.
- Toda tela mostra um aviso de que é um indicador automático de apoio, sem valor de diagnóstico nem de julgamento.

**Atualização de banco existente:** nada a fazer além de reiniciar o backend (as duas colunas novas são criadas
automaticamente e de forma idempotente).
