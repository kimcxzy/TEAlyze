# TEAlyze — Product Requirements Document

## Overview
Blue-themed mobile health app that connects **caregivers of people with ASD (TEA)** to independent **professionals** (psychologists, therapists, speech therapists). Built with Expo (React Native) + a **Node.js/Express API** backed by **SQL Server running in Docker**.

## Architecture (updated — API + SQL Server no Docker)
All application data lives in SQL Server (database `TEALYZE`, schema in
`database/01_schema.sql` plus the idempotent `database/02_app_extensions.sql`).
React Native cannot speak TDS, so a Node.js/Express API (`backend/`) is the
only layer that talks SQL, using the `mssql` driver.

The UI still calls a single `apiFetch(path, token, options)` helper
(`frontend/src/auth.tsx`), but it now performs HTTP requests against the API
instead of resolving locally — no screen under `frontend/app/**` changed.

Entity mapping: caregiver = USUARIO + RESPONSAVEL + PACIENTE; professional =
USUARIO + PROFISSIONAL + ESPECIALIDADE; AQ = TRIAGEM + RESPOSTA_TRIAGEM;
appointments = SESSAO; chat = CONVERSA + PARTICIPANTE_CONVERSA + MENSAGEM;
laudo = LAUDO + LAUDO_ANALISE_IA; feed = PUBLICACAO; sessions = TOKEN_ACESSO;
audit trail = LOG_AUDITORIA.

The **only** feature allowed to use AI/network is laudo OCR
(`backend/src/services/laudoOcr.js`), fully optional and isolated — without
`OCR_API_KEY` the rest of the system is unaffected and the fraud cross-check
still runs against the database.

## User Roles
- **Cuidador (Caregiver)** — Legal guardian of an ASD patient.
- **Profissional (Professional)** — Independent therapist with verified CRP.

## Core Features
1. **Auth (API + SQL Server)** — Login, signup with role picker. Caregiver form (caregiver name/CPF, patient name/CPF). Professional form (name, CPF, CRP, specialty, location). Passwords are salted+stretched with SHA-256 on the server (`backend/src/crypto.js`) and stored in `USUARIO.senha_hash`; a session is an opaque token stored in `TOKEN_ACESSO` and sent as `Authorization: Bearer`.
2. **AQ Autism Spectrum Quotient** — 50-question questionnaire completed by caregivers on first use; scored on the server (`backend/src/services/aq.js`) and stored in TRIAGEM/RESPOSTA_TRIAGEM.
3. **Laudo (Medical Report) OCR** — Caregiver uploads photo of laudo. If an AI key is configured on the server (`OCR_API_KEY`), an OpenAI-compatible vision model extracts validity, text, patient name, diagnosis, professional name, CRP/CRM, warnings. Without a key, the app still works — the document is saved under `backend/uploads/laudos`, registered in LAUDO, and fields can be filled manually. Fraud cross-checks against the caregiver's previous laudos always run on the server, against LAUDO/LAUDO_ANALISE_IA.
4. **Professionals Map** — react-native-maps view with pins for autonomous professionals (data from SQL Server); horizontal card list; caregiver can start chat.
5. **Chat (polling every 3s against the API)** — 1:1 messages between caregiver and professional.
6. **Post Feed** — Professionals publish photos + captions (session materials, homework), stored as files under `backend/uploads/posts` with the path saved in PUBLICACAO; caregivers view updates.
7. **Accessibility Settings** — Font size (4 levels), brightness (4 levels via dim overlay), high-contrast toggle.

## Tech
- Frontend: Expo Router, react-native-maps, expo-image-picker, expo-secure-store (token), expo-constants.
- Backend: Node.js 18+, Express, mssql (tedious), Docker Compose.
- Database: SQL Server 2019 (container), collation Latin1_General_CS_AI.
- Design: `#2C6491` (calming blue), Ionicons, iOS-native clean personality.

## Integrations
- **Laudo OCR AI (optional, isolated)** — OpenAI-compatible chat/vision endpoint, configured via `OCR_API_KEY` / `OCR_API_URL` / `OCR_MODEL` in `backend/.env`. The only external call in the system, and it stays on the server (the key never reaches the app).
- **CRP Validation** — MOCK (regex `NN/NNNNNN`, marks `crp_verified: true`), same as before.

## Seed Data
- 3 professionals auto-seeded (São Paulo coordinates) on backend startup when the database has no professional yet (`backend/src/services/seed.js`), idempotent.
- 1 test caregiver (`test.caregiver@tealyze.app` / `senha123`) auto-seeded the same way, independent of the professionals check: USUARIO + RESPONSAVEL + PACIENTE, a completed AQ (TRIAGEM + RESPOSTA_TRIAGEM, score 28), 3 appointments (SESSAO), a chat with the first professional (CONVERSA + PARTICIPANTE_CONVERSA + MENSAGEM) and one targeted PUBLICACAO. Missing pieces are topped up on later boots; nothing is duplicated.

## Update — MODIFICAÇÕES.txt
- OCR de laudo com IA gratuita (Gemini por padrão, fallback entre modelos, reanálise, status).
- Aba Perfil (Dados/Laudos/Triagem/Ajustes) lendo e gravando tudo no SQL Server (`/profile`, `/laudo/mine`, `/laudo/:id`).
- Botão voltar do laudo → início; mapa funcionando no navegador (Leaflet); modo escuro completo (Sistema/Claro/Escuro).

## Update — segunda rodada
- Título/nome do app: Tealyze. Editar legenda de publicação (PUT /posts/:id) no lugar da lixeira do topo. Tela da publicação themed.
- Imagens em proporção real (AutoImage). Mapa oculto para profissionais. Provedor de mapa configurável (EXPO_PUBLIC_MAP_*) com fallback automático.

## Update — resumo de documentos para o profissional
- GET /laudo/summary (cuidador) e /laudo/summary/:caregiverId (profissional com consulta ativa); PUT /laudo/:id/explanation.
- Sem nota guardada: resumo calculado na hora; só alerta forte; laudo não lido pela IA fica "aguardando leitura"; nenhum dado do laudo vaza; acesso auditado.
