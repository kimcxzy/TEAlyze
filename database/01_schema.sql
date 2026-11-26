CREATE DATABASE TEALYZE;
GO

USE TEALYZE;
GO

CREATE TABLE USUARIO (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(150) NOT NULL,
    email NVARCHAR(150) NOT NULL UNIQUE,
    senha_hash NVARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    data_nascimento DATE,
    tipo_usuario VARCHAR(30) NOT NULL,
    ativo BIT NOT NULL DEFAULT 1,
    data_cadastro DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE RESPONSAVEL (
    id_responsavel INT PRIMARY KEY,
    cpf CHAR(11) NOT NULL UNIQUE,
    grau_parentesco NVARCHAR(50) NOT NULL,
    profissao NVARCHAR(100),
    CONSTRAINT FK_RESPONSAVEL_USUARIO
        FOREIGN KEY (id_responsavel)
        REFERENCES USUARIO(id_usuario)
);
GO

CREATE TABLE PACIENTE (
    id_paciente INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT UNIQUE,
    id_responsavel INT,
    nome_social NVARCHAR(150),
    nivel_suporte TINYINT,
    cid11 NVARCHAR(20),
    data_diagnostico DATE,
    historico NVARCHAR(MAX),
    observacoes NVARCHAR(MAX),
    data_cadastro DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT CK_PACIENTE_NIVEL
        CHECK (nivel_suporte BETWEEN 1 AND 3),

    CONSTRAINT FK_PACIENTE_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario),

    CONSTRAINT FK_PACIENTE_RESPONSAVEL
        FOREIGN KEY (id_responsavel)
        REFERENCES RESPONSAVEL(id_responsavel)
);
GO

CREATE TABLE PROFISSIONAL (
    id_profissional INT PRIMARY KEY,
    cpf CHAR(11) NOT NULL UNIQUE,
    registro_profissional NVARCHAR(50),
    orgao_registro NVARCHAR(100),
    descricao NVARCHAR(MAX),
    experiencia_tea_anos TINYINT,
    endereco NVARCHAR(200),
    numero VARCHAR(10),
    bairro NVARCHAR(100),
    cidade NVARCHAR(100),
    estado CHAR(2),
    cep CHAR(8),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    atende_teleconsulta BIT NOT NULL DEFAULT 0,
    ativo BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_PROFISSIONAL_USUARIO
        FOREIGN KEY (id_profissional)
        REFERENCES USUARIO(id_usuario)
);
GO

CREATE TABLE ESPECIALIDADE (
    id_especialidade INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(100) NOT NULL UNIQUE,
    descricao NVARCHAR(500)
);
GO

CREATE TABLE PROFISSIONAL_ESPECIALIDADE (
    id_profissional INT NOT NULL,
    id_especialidade INT NOT NULL,
    principal BIT NOT NULL DEFAULT 0,

    PRIMARY KEY (id_profissional, id_especialidade),

    CONSTRAINT FK_PE_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional),

    CONSTRAINT FK_PE_ESPECIALIDADE
        FOREIGN KEY (id_especialidade)
        REFERENCES ESPECIALIDADE(id_especialidade)
);
GO

CREATE TABLE PERMISSAO (
    id_permissao INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(100) NOT NULL UNIQUE,
    descricao NVARCHAR(500)
);
GO

CREATE TABLE USUARIO_PERMISSAO (
    id_usuario INT NOT NULL,
    id_permissao INT NOT NULL,

    PRIMARY KEY (id_usuario, id_permissao),

    CONSTRAINT FK_UP_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario),

    CONSTRAINT FK_UP_PERMISSAO
        FOREIGN KEY (id_permissao)
        REFERENCES PERMISSAO(id_permissao)
);
GO

CREATE TABLE COMORBIDADE (
    id_comorbidade INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(100) NOT NULL UNIQUE,
    descricao NVARCHAR(500)
);
GO

CREATE TABLE PACIENTE_COMORBIDADE (
    id_paciente INT NOT NULL,
    id_comorbidade INT NOT NULL,
    data_identificacao DATE,
    observacao NVARCHAR(500),

    PRIMARY KEY (id_paciente, id_comorbidade),

    CONSTRAINT FK_PC_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_PC_COMORBIDADE
        FOREIGN KEY (id_comorbidade)
        REFERENCES COMORBIDADE(id_comorbidade)
);
GO

CREATE TABLE TRIAGEM (
    id_triagem INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    tipo_questionario VARCHAR(30) NOT NULL,
    data_triagem DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    pontuacao DECIMAL(5,2),
    nivel_urgencia VARCHAR(20),
    resultado NVARCHAR(500),
    observacoes NVARCHAR(MAX),

    CONSTRAINT FK_TRIAGEM_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente)
);
GO

CREATE TABLE RESPOSTA_TRIAGEM (
    id_resposta INT IDENTITY(1,1) PRIMARY KEY,
    id_triagem INT NOT NULL,
    numero_questao SMALLINT NOT NULL,
    resposta NVARCHAR(500) NOT NULL,

    CONSTRAINT FK_RESPOSTA_TRIAGEM
        FOREIGN KEY (id_triagem)
        REFERENCES TRIAGEM(id_triagem)
);
GO

CREATE TABLE LAUDO (
    id_laudo INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_usuario_upload INT NOT NULL,
    nome_arquivo NVARCHAR(255) NOT NULL,
    caminho_arquivo NVARCHAR(500),
    tipo_documento VARCHAR(50),
    data_upload DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    texto_ocr NVARCHAR(MAX),
    hash_arquivo VARCHAR(128),
    consentimento_upload BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_LAUDO_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_LAUDO_USUARIO
        FOREIGN KEY (id_usuario_upload)
        REFERENCES USUARIO(id_usuario)
);
GO

CREATE TABLE AVALIACAO_ESCALA (
    id_avaliacao INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_profissional INT NOT NULL,
    escala VARCHAR(20) NOT NULL,
    data_avaliacao DATE NOT NULL,
    pontuacao DECIMAL(6,2),
    resultado NVARCHAR(500),
    observacoes NVARCHAR(MAX),

    CONSTRAINT FK_AVALIACAO_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_AVALIACAO_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional)
);
GO

CREATE TABLE META_TERAPEUTICA (
    id_meta INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_profissional INT NOT NULL,
    descricao NVARCHAR(MAX) NOT NULL,
    data_inicio DATE,
    data_prevista DATE,
    data_conclusao DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',

    CONSTRAINT FK_META_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_META_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional)
);
GO

CREATE TABLE FILA_ESPERA (
    id_fila INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_profissional INT,
    id_especialidade INT NOT NULL,
    data_entrada DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    prioridade INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO',
    data_atendimento DATETIME2,

    CONSTRAINT FK_FILA_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_FILA_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional),

    CONSTRAINT FK_FILA_ESPECIALIDADE
        FOREIGN KEY (id_especialidade)
        REFERENCES ESPECIALIDADE(id_especialidade)
);
GO

CREATE TABLE SESSAO (
    id_sessao INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_profissional INT NOT NULL,
    data_hora_inicio DATETIME2 NOT NULL,
    data_hora_fim DATETIME2,
    tipo_sessao VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AGENDADA',
    observacoes NVARCHAR(MAX),

    CONSTRAINT FK_SESSAO_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_SESSAO_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional)
);
GO

CREATE TABLE EVOLUCAO (
    id_evolucao INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_profissional INT NOT NULL,
    id_sessao INT NOT NULL,
    data_registro DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    descricao NVARCHAR(MAX) NOT NULL,
    observacoes NVARCHAR(MAX),

    CONSTRAINT FK_EVOLUCAO_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_EVOLUCAO_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional),

    CONSTRAINT FK_EVOLUCAO_SESSAO
        FOREIGN KEY (id_sessao)
        REFERENCES SESSAO(id_sessao)
);
GO

CREATE TABLE ENCAMINHAMENTO (
    id_encaminhamento INT IDENTITY(1,1) PRIMARY KEY,
    id_paciente INT NOT NULL,
    id_profissional INT NOT NULL,
    id_responsavel INT,
    data_encaminhamento DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    motivo NVARCHAR(MAX),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    data_resposta DATETIME2,

    CONSTRAINT FK_ENCAMINHAMENTO_PACIENTE
        FOREIGN KEY (id_paciente)
        REFERENCES PACIENTE(id_paciente),

    CONSTRAINT FK_ENCAMINHAMENTO_PROFISSIONAL
        FOREIGN KEY (id_profissional)
        REFERENCES PROFISSIONAL(id_profissional),

    CONSTRAINT FK_ENCAMINHAMENTO_RESPONSAVEL
        FOREIGN KEY (id_responsavel)
        REFERENCES RESPONSAVEL(id_responsavel)
);
GO

CREATE TABLE CONVERSA (
    id_conversa INT IDENTITY(1,1) PRIMARY KEY,
    data_criacao DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    ativa BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE PARTICIPANTE_CONVERSA (
    id_conversa INT NOT NULL,
    id_usuario INT NOT NULL,
    data_entrada DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    PRIMARY KEY (id_conversa, id_usuario),

    CONSTRAINT FK_PARTICIPANTE_CONVERSA
        FOREIGN KEY (id_conversa)
        REFERENCES CONVERSA(id_conversa),

    CONSTRAINT FK_PARTICIPANTE_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario)
);
GO

CREATE TABLE MENSAGEM (
    id_mensagem BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_conversa INT NOT NULL,
    id_usuario INT NOT NULL,
    conteudo NVARCHAR(MAX) NOT NULL,
    data_envio DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    data_leitura DATETIME2,
    lida BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_MENSAGEM_CONVERSA
        FOREIGN KEY (id_conversa)
        REFERENCES CONVERSA(id_conversa),

    CONSTRAINT FK_MENSAGEM_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario)
);
GO

CREATE TABLE TELECONSULTA (
    id_teleconsulta INT IDENTITY(1,1) PRIMARY KEY,
    id_sessao INT NOT NULL UNIQUE,
    link_sala NVARCHAR(500),
    token_sala NVARCHAR(255),
    data_inicio DATETIME2,
    data_fim DATETIME2,
    status VARCHAR(30) NOT NULL DEFAULT 'AGENDADA',

    CONSTRAINT FK_TELECONSULTA_SESSAO
        FOREIGN KEY (id_sessao)
        REFERENCES SESSAO(id_sessao)
);
GO

CREATE TABLE FINANCEIRO (
    id_financeiro INT IDENTITY(1,1) PRIMARY KEY,
    id_sessao INT NOT NULL UNIQUE,
    valor DECIMAL(10,2) NOT NULL,
    forma_pagamento VARCHAR(30),
    status_pagamento VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    data_pagamento DATETIME2,
    observacoes NVARCHAR(500),

    CONSTRAINT FK_FINANCEIRO_SESSAO
        FOREIGN KEY (id_sessao)
        REFERENCES SESSAO(id_sessao)
);
GO

CREATE TABLE RECIBO (
    id_recibo INT IDENTITY(1,1) PRIMARY KEY,
    id_financeiro INT NOT NULL UNIQUE,
    numero_recibo NVARCHAR(50) NOT NULL UNIQUE,
    data_emissao DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    valor DECIMAL(10,2) NOT NULL,
    caminho_pdf NVARCHAR(500),

    CONSTRAINT FK_RECIBO_FINANCEIRO
        FOREIGN KEY (id_financeiro)
        REFERENCES FINANCEIRO(id_financeiro)
);
GO

CREATE TABLE NOTIFICACAO (
    id_notificacao BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_sessao INT,
    titulo NVARCHAR(150) NOT NULL,
    mensagem NVARCHAR(MAX) NOT NULL,
    data_envio DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    data_leitura DATETIME2,
    lida BIT NOT NULL DEFAULT 0,
    tipo VARCHAR(30),

    CONSTRAINT FK_NOTIFICACAO_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario),

    CONSTRAINT FK_NOTIFICACAO_SESSAO
        FOREIGN KEY (id_sessao)
        REFERENCES SESSAO(id_sessao)
);
GO

CREATE TABLE VIDEO_TUTORIAL (
    id_video INT IDENTITY(1,1) PRIMARY KEY,
    titulo NVARCHAR(150) NOT NULL,
    descricao NVARCHAR(MAX),
    url_video NVARCHAR(500) NOT NULL,
    miniatura NVARCHAR(500),
    categoria NVARCHAR(100),
    duracao INT,
    data_cadastro DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    ativo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE CONSENTIMENTO (
    id_consentimento INT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT NOT NULL,
    tipo_consentimento VARCHAR(50) NOT NULL,
    versao_termo VARCHAR(20) NOT NULL,
    aceito BIT NOT NULL,
    data_consentimento DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_CONSENTIMENTO_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario)
);
GO

CREATE TABLE LOG_AUDITORIA (
    id_log BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_usuario INT,
    acao VARCHAR(50) NOT NULL,
    tabela_afetada VARCHAR(128),
    id_registro BIGINT,
    data_acao DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    descricao NVARCHAR(MAX),

    CONSTRAINT FK_LOG_USUARIO
        FOREIGN KEY (id_usuario)
        REFERENCES USUARIO(id_usuario)
);
GO

INSERT INTO ESPECIALIDADE (nome, descricao) VALUES
('Psicologia', 'Atendimento psicológico'),
('Fonoaudiologia', 'Atendimento fonoaudiológico'),
('Terapia Ocupacional', 'Atendimento de terapia ocupacional'),
('Neurologia', 'Atendimento neurológico'),
('Psiquiatria', 'Atendimento psiquiátrico'),
('Fisioterapia', 'Atendimento fisioterapêutico'),
('Terapia ABA', 'Intervenção baseada em ABA');
GO

INSERT INTO PERMISSAO (nome, descricao) VALUES
('VISUALIZAR_PACIENTE', 'Visualizar informações do paciente'),
('EDITAR_PACIENTE', 'Editar informações do paciente'),
('GERENCIAR_SESSAO', 'Gerenciar sessões'),
('REGISTRAR_EVOLUCAO', 'Registrar evolução'),
('GERENCIAR_PROFISSIONAL', 'Gerenciar profissionais'),
('GERENCIAR_USUARIO', 'Gerenciar usuários'),
('VISUALIZAR_RELATORIOS', 'Visualizar relatórios');
GO

INSERT INTO COMORBIDADE (nome, descricao) VALUES
('TDAH', 'Transtorno do Déficit de Atenção e Hiperatividade'),
('Ansiedade', 'Transtorno de ansiedade'),
('Epilepsia', 'Condição neurológica'),
('Distúrbio do Sono', 'Alterações relacionadas ao sono'),
('Deficiência Intelectual', 'Condição relacionada ao funcionamento intelectual e adaptativo');
GO

CREATE INDEX IX_PACIENTE_RESPONSAVEL
ON PACIENTE(id_responsavel);

CREATE INDEX IX_TRIAGEM_PACIENTE
ON TRIAGEM(id_paciente);

CREATE INDEX IX_LAUDO_PACIENTE
ON LAUDO(id_paciente);

CREATE INDEX IX_SESSAO_PACIENTE
ON SESSAO(id_paciente);

CREATE INDEX IX_SESSAO_PROFISSIONAL
ON SESSAO(id_profissional);

CREATE INDEX IX_SESSAO_DATA
ON SESSAO(data_hora_inicio);

CREATE INDEX IX_FILA_ESPECIALIDADE
ON FILA_ESPERA(id_especialidade);

CREATE INDEX IX_MENSAGEM_CONVERSA
ON MENSAGEM(id_conversa);

CREATE INDEX IX_NOTIFICACAO_USUARIO
ON NOTIFICACAO(id_usuario);
GO