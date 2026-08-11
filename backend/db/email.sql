CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address TEXT NOT NULL,
    display_name TEXT,
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    history_id TEXT,
    sync_status TEXT DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error')),
    last_sync_at TIMESTAMPTZ,
    last_sync_error TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, email_address)
);

DROP TRIGGER IF EXISTS trg_email_accounts_updated ON email_accounts;
CREATE TRIGGER trg_email_accounts_updated BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts (user_id, is_active);

CREATE TABLE IF NOT EXISTS email_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    gmail_thread_id TEXT NOT NULL,
    subject TEXT,
    snippet TEXT,
    last_message_at TIMESTAMPTZ,
    message_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, gmail_thread_id)
);

DROP TRIGGER IF EXISTS trg_email_threads_updated ON email_threads;
CREATE TRIGGER trg_email_threads_updated BEFORE UPDATE ON email_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_email_threads_user ON email_threads (user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES email_threads(id) ON DELETE SET NULL,
    gmail_message_id TEXT NOT NULL,
    from_address TEXT,
    from_name TEXT,
    to_addresses TEXT[] DEFAULT '{}',
    subject TEXT,
    snippet TEXT,
    body_text TEXT,
    received_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    label_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id, gmail_message_id)
);

DROP TRIGGER IF EXISTS trg_emails_updated ON emails;
CREATE TRIGGER trg_emails_updated BEFORE UPDATE ON emails FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_emails_user_received ON emails (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_account ON emails (account_id, received_at DESC);

CREATE TABLE IF NOT EXISTS email_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL,
    label_name TEXT,
    UNIQUE (email_id, label_id)
);

CREATE TABLE IF NOT EXISTS email_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    history_id TEXT,
    last_sync_at TIMESTAMPTZ,
    last_sync_error TEXT,
    messages_synced INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (account_id)
);

CREATE TABLE IF NOT EXISTS email_classifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'IMPORTANT', 'ACTION_REQUIRED', 'PERSONAL', 'NEWSLETTER',
        'PROMOTION', 'SPAM', 'UNKNOWN'
    )),
    confidence FLOAT DEFAULT 0.5,
    source TEXT NOT NULL CHECK (source IN ('rule', 'learning', 'llm', 'manual')),
    evidence JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (email_id)
);

CREATE INDEX IF NOT EXISTS idx_email_classifications_user_cat ON email_classifications (user_id, category);

CREATE TABLE IF NOT EXISTS email_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    match_sender TEXT,
    match_domain TEXT,
    match_subject_contains TEXT,
    match_label TEXT,
    category TEXT CHECK (category IN (
        'IMPORTANT', 'ACTION_REQUIRED', 'PERSONAL', 'NEWSLETTER',
        'PROMOTION', 'SPAM', 'UNKNOWN'
    )),
    action TEXT CHECK (action IN ('classify', 'archive', 'mark_important', 'mute')),
    priority INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_rules_user ON email_rules (user_id, is_active, priority DESC);

CREATE TABLE IF NOT EXISTS email_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    account_id UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    actor TEXT NOT NULL CHECK (actor IN ('user', 'ai', 'rule')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_actions_user ON email_actions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sender_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_address TEXT,
    sender_domain TEXT,
    preferred_category TEXT CHECK (preferred_category IN (
        'IMPORTANT', 'ACTION_REQUIRED', 'PERSONAL', 'NEWSLETTER',
        'PROMOTION', 'SPAM', 'UNKNOWN'
    )),
    action_counts JSONB DEFAULT '{}'::jsonb,
    total_actions INT DEFAULT 0,
    confidence FLOAT DEFAULT 0.0,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, sender_address)
);

CREATE INDEX IF NOT EXISTS idx_sender_profiles_domain ON sender_profiles (user_id, sender_domain);

CREATE TABLE IF NOT EXISTS email_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_approvals_pending ON email_approvals (user_id, status) WHERE status = 'pending';
