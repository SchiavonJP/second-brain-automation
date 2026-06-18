-- Databases separados por serviço
-- O Postgres cria 'secondbrain' automaticamente via POSTGRES_DB
-- Aqui criamos os databases adicionais para Hermes e Odysseus

CREATE DATABASE hermes;
CREATE DATABASE odysseus;
CREATE DATABASE dockhand;

-- Permissões: secondbrain é owner para poder criar schemas (necessário para migrações Drizzle)
ALTER DATABASE hermes OWNER TO secondbrain;
ALTER DATABASE odysseus OWNER TO secondbrain;
ALTER DATABASE dockhand OWNER TO secondbrain;

GRANT ALL PRIVILEGES ON DATABASE hermes TO secondbrain;
GRANT ALL PRIVILEGES ON DATABASE odysseus TO secondbrain;
GRANT ALL PRIVILEGES ON DATABASE dockhand TO secondbrain;