/* ======================================================================
   TEALYZE — 02_app_extensions.sql
   ----------------------------------------------------------------------
   Complemento do schema original (01_schema.sql). Adiciona as colunas e as
   tabelas que o aplicativo precisa e que não estavam previstas no modelo
   original. Única alteração em algo que já existia: a restrição UNIQUE de
   PACIENTE.id_usuario vira um índice único filtrado (ver explicação abaixo),
   porque a original só deixava cadastrar UM cuidador.

   Este script é IDEMPOTENTE: pode ser executado quantas vezes quiser.
   O backend o executa automaticamente a cada inicialização.
   ====================================================================== */

/* ---------------------------------------------------------------- PACIENTE
   O app cadastra o CPF do paciente junto do responsável. */
IF COL_LENGTH('PACIENTE', 'cpf') IS NULL
    ALTER TABLE PACIENTE ADD cpf VARCHAR(14) NULL;
GO

/* ------------------------------------------- PACIENTE.id_usuario (correção)
   No 01_schema.sql a coluna é `id_usuario INT UNIQUE` (anulável). No SQL Server
   uma restrição UNIQUE aceita apenas UM valor NULL. Como o app cadastra o
   paciente sem login próprio (id_usuario = NULL), só o primeiro cuidador
   conseguia se cadastrar; o segundo recebia "Registro duplicado".
   Solução: troca a restrição por um índice único FILTRADO — continua
   impedindo dois pacientes ligados ao mesmo usuário, mas aceita vários NULL. */
DECLARE @uq SYSNAME;
SELECT @uq = kc.name
FROM sys.key_constraints kc
INNER JOIN sys.index_columns ic
        ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
INNER JOIN sys.columns c
        ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID('PACIENTE')
  AND kc.type = 'UQ'
  AND c.name = 'id_usuario';

IF @uq IS NOT NULL
BEGIN
    -- EXEC não aceita função no argumento: o comando precisa estar numa variável.
    DECLARE @cmd NVARCHAR(400) = N'ALTER TABLE PACIENTE DROP CONSTRAINT ' + QUOTENAME(@uq);
    EXEC sp_executesql @cmd;
END
GO

SET QUOTED_IDENTIFIER ON;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PACIENTE_USUARIO' AND object_id = OBJECT_ID('PACIENTE'))
    CREATE UNIQUE INDEX UX_PACIENTE_USUARIO ON PACIENTE(id_usuario) WHERE id_usuario IS NOT NULL;
GO

/* ------------------------------------------------------------ PROFISSIONAL
   crp_verificado -> validação (mock) do registro profissional
   formacao       -> texto livre de formação acadêmica exibido no perfil */
IF COL_LENGTH('PROFISSIONAL', 'crp_verificado') IS NULL
    ALTER TABLE PROFISSIONAL ADD crp_verificado BIT NOT NULL
        CONSTRAINT DF_PROFISSIONAL_CRP_VERIFICADO DEFAULT 0;
GO

IF COL_LENGTH('PROFISSIONAL', 'formacao') IS NULL
    ALTER TABLE PROFISSIONAL ADD formacao NVARCHAR(1000) NULL;
GO

/* ------------------------------------------------------------------ SESSAO
   local_atendimento -> endereço/local combinado da consulta
   data_cadastro     -> quando o agendamento foi criado */
IF COL_LENGTH('SESSAO', 'local_atendimento') IS NULL
    ALTER TABLE SESSAO ADD local_atendimento NVARCHAR(300) NULL;
GO

IF COL_LENGTH('SESSAO', 'data_cadastro') IS NULL
    ALTER TABLE SESSAO ADD data_cadastro DATETIME2 NOT NULL
        CONSTRAINT DF_SESSAO_DATA_CADASTRO DEFAULT SYSDATETIME();
GO

/* ------------------------------------------------------------------- LAUDO
   mime_type -> necessário para devolver a imagem ao app */
IF COL_LENGTH('LAUDO', 'mime_type') IS NULL
    ALTER TABLE LAUDO ADD mime_type VARCHAR(100) NULL;
GO

/* ------------------------------------------------------- TOKEN_ACESSO (novo)
   Sessão de login. Substitui o "token local" da versão offline: agora o
   token é emitido e resolvido pelo servidor, contra o banco. */
IF OBJECT_ID('TOKEN_ACESSO', 'U') IS NULL
BEGIN
    CREATE TABLE TOKEN_ACESSO (
        token VARCHAR(128) NOT NULL PRIMARY KEY,
        id_usuario INT NOT NULL,
        data_criacao DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        data_expiracao DATETIME2 NULL,
        CONSTRAINT FK_TOKEN_USUARIO
            FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario)
    );

    CREATE INDEX IX_TOKEN_USUARIO ON TOKEN_ACESSO(id_usuario);
END
GO

/* --------------------------------------------------------- PUBLICACAO (nova)
   Feed de materiais publicados pelos profissionais (fotos + legenda).
   id_responsavel_destino NULL = publicação pública para todos os cuidadores. */
IF OBJECT_ID('PUBLICACAO', 'U') IS NULL
BEGIN
    CREATE TABLE PUBLICACAO (
        id_publicacao INT IDENTITY(1,1) PRIMARY KEY,
        id_profissional INT NOT NULL,
        id_responsavel_destino INT NULL,
        legenda NVARCHAR(MAX) NULL,
        nome_arquivo NVARCHAR(255) NULL,
        caminho_arquivo NVARCHAR(500) NULL,
        mime_type VARCHAR(100) NULL,
        data_publicacao DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_PUBLICACAO_PROFISSIONAL
            FOREIGN KEY (id_profissional) REFERENCES PROFISSIONAL(id_profissional),
        CONSTRAINT FK_PUBLICACAO_RESPONSAVEL
            FOREIGN KEY (id_responsavel_destino) REFERENCES RESPONSAVEL(id_responsavel)
    );

    CREATE INDEX IX_PUBLICACAO_PROFISSIONAL ON PUBLICACAO(id_profissional);
    CREATE INDEX IX_PUBLICACAO_DESTINO ON PUBLICACAO(id_responsavel_destino);
END
GO

/* ------------------------------------------------ LAUDO_ANALISE_IA (nova)
   Resultado estruturado da leitura (OCR/IA) e da checagem de fraude de
   cada laudo. Relação 1:1 com LAUDO. */
IF OBJECT_ID('LAUDO_ANALISE_IA', 'U') IS NULL
BEGIN
    CREATE TABLE LAUDO_ANALISE_IA (
        id_analise INT IDENTITY(1,1) PRIMARY KEY,
        id_laudo INT NOT NULL UNIQUE,
        laudo_valido BIT NOT NULL DEFAULT 0,
        confianca INT NULL,
        nome_paciente NVARCHAR(200) NULL,
        cpf_paciente VARCHAR(20) NULL,
        nascimento_paciente NVARCHAR(50) NULL,
        diagnostico NVARCHAR(500) NULL,
        cid NVARCHAR(50) NULL,
        nome_profissional NVARCHAR(200) NULL,
        registro_profissional NVARCHAR(50) NULL,
        instituicao NVARCHAR(300) NULL,
        endereco_instituicao NVARCHAR(300) NULL,
        data_emissao NVARCHAR(50) NULL,
        possui_assinatura BIT NOT NULL DEFAULT 0,
        indicadores_fraude NVARCHAR(MAX) NULL,   -- JSON (string[])
        alertas NVARCHAR(MAX) NULL,              -- JSON (string[])
        checagem_cruzada NVARCHAR(MAX) NULL,     -- JSON (objeto)
        data_analise DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_ANALISE_LAUDO
            FOREIGN KEY (id_laudo) REFERENCES LAUDO(id_laudo)
    );
END
GO

/* ------------------------------------ Resumo de documentos (profissional)
   - LAUDO_ANALISE_IA.lido_por_ia: a IA realmente leu o documento? Sem isso, um
     laudo que apenas não pôde ser lido (sem chave, sem cota, sem rede) seria
     confundido com um laudo suspeito. NULL = laudo antigo (anterior a esta coluna).
   - LAUDO.explicacao_cuidador: o cuidador pode explicar um alerta (opcional);
     o profissional que tem consulta com a família vê essa explicação. */
IF COL_LENGTH('LAUDO_ANALISE_IA', 'lido_por_ia') IS NULL
    ALTER TABLE LAUDO_ANALISE_IA ADD lido_por_ia BIT NULL;
GO

IF COL_LENGTH('LAUDO', 'explicacao_cuidador') IS NULL
    ALTER TABLE LAUDO ADD explicacao_cuidador NVARCHAR(500) NULL;
GO

/* -------------------------------------------------------------- Índices extra
   Consultas usadas pelo app em telas com polling (chat/agenda). */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MENSAGEM_DATA' AND object_id = OBJECT_ID('MENSAGEM'))
    CREATE INDEX IX_MENSAGEM_DATA ON MENSAGEM(id_conversa, data_envio);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PARTICIPANTE_USUARIO' AND object_id = OBJECT_ID('PARTICIPANTE_CONVERSA'))
    CREATE INDEX IX_PARTICIPANTE_USUARIO ON PARTICIPANTE_CONVERSA(id_usuario);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TRIAGEM_TIPO' AND object_id = OBJECT_ID('TRIAGEM'))
    CREATE INDEX IX_TRIAGEM_TIPO ON TRIAGEM(id_paciente, tipo_questionario);
GO
