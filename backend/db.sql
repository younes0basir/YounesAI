-- =========================================================
-- LITE SCHEMA: No external extensions required (Works on any Postgres 13+)
-- =========================================================

-- Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. USERS & DEVICES
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('phone','laptop','tablet','desktop')),
    platform TEXT,
    last_sync TIMESTAMPTZ,
    sync_token BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TASKS (With AI Smart Urgency)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id),
    title TEXT NOT NULL,
    description TEXT,
    details TEXT,
    checklist JSONB DEFAULT '[]'::jsonb,
    urgency SMALLINT CHECK (urgency BETWEEN 1 AND 5),
    priority SMALLINT DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled','archived')),
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    ai_priority_score FLOAT DEFAULT 0.5,
    quadrant TEXT CHECK (quadrant IN ('do_first', 'schedule', 'delegate', 'eliminate')),
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_tasks_updated ON tasks;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_tasks_user_status_due ON tasks (user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks (parent_task_id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_interval INT DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID;
CREATE INDEX IF NOT EXISTS idx_tasks_user_due_priority ON tasks (user_id, due_at, priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);

-- 3. PLACES (Using standard Lat/Lng instead of PostGIS)
CREATE TABLE IF NOT EXISTS places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    category TEXT,
    urgency SMALLINT CHECK (urgency BETWEEN 1 AND 5),
    notes TEXT,
    is_visited BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION,   -- Standard decimal latitude
    longitude DOUBLE PRECISION,  -- Standard decimal longitude
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_places_updated ON places;
CREATE TRIGGER trg_places_updated BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. CALENDAR & REMINDERS
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    place_id UUID REFERENCES places(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    location_text TEXT,
    recurrence_rule TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_events_updated ON calendar_events;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    trigger_at TIMESTAMPTZ,
    recurrence_rule TEXT,
    snoozed_until TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recurrence_interval INT DEFAULT 1;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS warn_minutes_before INT DEFAULT 5;
CREATE INDEX IF NOT EXISTS idx_reminders_user_trigger ON reminders (user_id, trigger_at);
CREATE INDEX IF NOT EXISTS idx_reminders_user_snooze ON reminders (user_id, snoozed_until);

CREATE TABLE IF NOT EXISTS geofences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID REFERENCES places(id) ON DELETE CASCADE,
    reminder_id UUID REFERENCES reminders(id) ON DELETE CASCADE,
    radius_meters INT DEFAULT 200,
    trigger_type TEXT CHECK (trigger_type IN ('entry', 'exit')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. FILES & AGENT ACTIONS (The Undo System)
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    extension TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    checksum TEXT,
    last_modified TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    payload_before JSONB,
    payload_after JSONB,
    status TEXT DEFAULT 'executed' CHECK (status IN ('executed', 'reverted', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AI CONVERSATIONS & MEMORY (Simplified without vector embeddings for now)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    role TEXT CHECK (role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    intent TEXT,
    entities JSONB,
    audio_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category TEXT,
    content TEXT NOT NULL,
    importance SMALLINT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
    last_accessed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('task_due', 'task_overdue', 'reminder_warning', 'reminder_due', 'system')),
    title TEXT NOT NULL,
    body TEXT,
    entity_type TEXT CHECK (entity_type IN ('task', 'reminder', 'project', 'comment')),
    entity_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
    ON notifications (user_id, read_at, created_at DESC);

-- Migration: add reminder_warning to notifications type check (idempotent)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('task_due', 'task_overdue', 'reminder_warning', 'reminder_due', 'system'));

-- 8. TAGS, ENTITY TAGS, SAVED VIEWS
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('task', 'reminder', 'file', 'place', 'project')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tag_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_scope TEXT NOT NULL CHECK (entity_scope IN ('tasks', 'reminders', 'files', 'places', 'global')),
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_by TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_saved_views_updated ON saved_views;
CREATE TRIGGER trg_saved_views_updated BEFORE UPDATE ON saved_views FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 9. COLLABORATION: PROJECTS, MEMBERSHIPS, COMMENTS, ACTIVITY
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS project_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (task_id, assignee_id)
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assignee ON task_assignments (assignee_id, assigned_at DESC);

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
DROP TRIGGER IF EXISTS trg_comments_updated ON comments;
CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_comments_project_created ON comments (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'task', 'comment', 'membership', 'reminder')),
    entity_id UUID NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_project_created ON activity_log (project_id, created_at DESC);

-- Add FK after projects creation (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_tasks_project'
    ) THEN
        ALTER TABLE tasks
            ADD CONSTRAINT fk_tasks_project
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
    END IF;
END;
$$;

-- =========================================================
-- 10. AGENT SYSTEM TABLES
-- =========================================================

-- request_id columns for idempotency
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS request_id UUID;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS warn_minutes_before INT DEFAULT 5;

-- Memory embeddings with optional pgvector support
DO $$
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'vector extension not available; continuing without pgvector support';
    END;
END $$;

CREATE TABLE IF NOT EXISTS memory_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1024),
    embedding_json JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user ON memory_embeddings (user_id, created_at DESC);

-- Agent metrics logging
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    provider TEXT,
    latency_ms INT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_created ON agent_metrics (agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_user_created ON agent_metrics (user_id, created_at DESC);

-- =========================================================
-- 11. REFACTOR ENHANCEMENTS (SECURITY, SCHEDULER, METRICS)
-- =========================================================

-- Agent metrics enhancements
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS tokens_used INT DEFAULT 0;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE agent_metrics ADD COLUMN IF NOT EXISTS conversation_id UUID;

-- Idempotency unique constraints (prevents race-condition duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_request_id
  ON tasks (request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_request_id
  ON calendar_events (request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_request_id
  ON reminders (request_id) WHERE request_id IS NOT NULL;

-- pgvector index (only if extension available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        CREATE INDEX IF NOT EXISTS idx_memory_embeddings_vector
          ON memory_embeddings USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);
    ELSE
        RAISE NOTICE 'vector extension not installed; skipping ivfflat index';
    END IF;
END $$;

-- Scheduler tracking
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_pending
  ON scheduled_jobs (scheduled_at, status) WHERE status = 'pending';

-- 12. ELECTRON DESKTOP ASSISTANT
CREATE TABLE IF NOT EXISTS indexed_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    folder_path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_scan TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, folder_path)
);

CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1024),
    embedding_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_user_path ON document_embeddings (user_id, file_path);

-- Backfill vector columns from JSONB for existing rows (idempotent)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        ALTER TABLE memory_embeddings ADD COLUMN IF NOT EXISTS embedding VECTOR(1024);
        UPDATE memory_embeddings
        SET embedding = embedding_json::text::vector
        WHERE embedding IS NULL AND embedding_json IS NOT NULL;

        ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS embedding VECTOR(1024);
        UPDATE document_embeddings
        SET embedding = embedding_json::text::vector
        WHERE embedding IS NULL AND embedding_json IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
          ON document_embeddings USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);
    END IF;
END $$;

-- =========================================================
-- 13. NVIDIA UPGRADE — KNOWLEDGE GRAPH + EVALUATION + DOC UNDERSTANDING
-- =========================================================

-- Document Understanding: enhance existing document_embeddings
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT '{}'::jsonb;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS word_count INT DEFAULT 0;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS chunk_index INT DEFAULT 0;
ALTER TABLE document_embeddings ADD COLUMN IF NOT EXISTS chunk_total INT DEFAULT 1;

-- Knowledge Graph: entity relationship adjacency table
CREATE TABLE IF NOT EXISTS entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    from_entity_type TEXT NOT NULL,
    from_entity_id UUID NOT NULL,
    relationship_type TEXT NOT NULL,
    to_entity_type TEXT NOT NULL,
    to_entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (from_entity_id, relationship_type, to_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_rel_from ON entity_relationships (from_entity_id, from_entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_rel_to ON entity_relationships (to_entity_id, to_entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_rel_user ON entity_relationships (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_rel_type ON entity_relationships (relationship_type);

-- AI Evaluation: per-request quality tracking
CREATE TABLE IF NOT EXISTS evaluation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    agent_metric_id UUID REFERENCES agent_metrics(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    retrieved_doc_count INT DEFAULT 0,
    retrieval_precision FLOAT,
    retrieval_recall FLOAT,
    groundedness_score FLOAT,
    hallucination_risk BOOLEAN DEFAULT FALSE,
    latency_ms INT DEFAULT 0,
    sources_used TEXT[] DEFAULT '{}',
    agents_used TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_eval_logs_user ON evaluation_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_logs_groundedness ON evaluation_logs (groundedness_score, created_at DESC);

-- Retrieval analytics (lightweight query log for monitoring)
CREATE TABLE IF NOT EXISTS retrieval_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    source TEXT NOT NULL,           -- 'documents','memories','tasks','events','projects','conversations'
    result_count INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    had_results BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_retrieval_logs_user_source ON retrieval_logs (user_id, source, created_at DESC);

-- =========================================================
-- EMAIL INTELLIGENCE (Stage C) — see backend/db/email.sql
-- =========================================================

