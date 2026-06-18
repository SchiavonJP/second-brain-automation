-- Databases separados por serviço
-- O Postgres cria 'secondbrain' automaticamente via POSTGRES_DB
-- Aqui criamos os databases adicionais para Hermes e Odysseus

CREATE DATABASE hermes;
CREATE DATABASE odysseus;
CREATE DATABASE dockhand;

-- Permissões
GRANT ALL PRIVILEGES ON DATABASE hermes TO secondbrain;
GRANT ALL PRIVILEGES ON DATABASE odysseus TO secondbrain;
GRANT ALL PRIVILEGES ON DATABASE dockhand TO secondbrain;