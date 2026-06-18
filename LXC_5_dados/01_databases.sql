-- Databases separados por serviço
-- O Postgres cria 'secondbrain' automaticamente via POSTGRES_DB
-- Aqui criamos os databases adicionais para Hermes e Odysseus

CREATE DATABASE hermes;
CREATE DATABASE odysseus;

-- Permissões
GRANT ALL PRIVILEGES ON DATABASE hermes TO secondbrain;
GRANT ALL PRIVILEGES ON DATABASE odysseus TO secondbrain;