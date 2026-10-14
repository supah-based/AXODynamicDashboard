-- Additive extension of the existing axo_streams database. Do not replace migrations 001/002.
CREATE TABLE axo_wallet_workspaces (
 wallet_key char(64) PRIMARY KEY CHECK (wallet_key ~ '^[a-f0-9]{64}$'),
 revision bigint NOT NULL DEFAULT 0 CHECK (revision>=0),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144)
);
CREATE TABLE axo_project_evidence (
 evidence_id char(64) PRIMARY KEY, chain text NOT NULL, address text NOT NULL, pool text,
 kind text NOT NULL, authority text NOT NULL, source text NOT NULL, observed_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, payload jsonb NOT NULL,
 CHECK (expires_at>observed_at AND octet_length(payload::text)<=262144)
);
CREATE INDEX axo_project_evidence_lookup ON axo_project_evidence(chain,address,observed_at DESC);
CREATE TABLE axo_personal_signals (
 wallet_key char(64) NOT NULL REFERENCES axo_wallet_workspaces(wallet_key) ON DELETE CASCADE,
 event_id char(64) NOT NULL, at timestamptz NOT NULL, payload jsonb NOT NULL,
 read_at timestamptz, feedback text CHECK (feedback IN ('useful','noise')), muted boolean NOT NULL DEFAULT false,
 PRIMARY KEY(wallet_key,event_id), CHECK (octet_length(payload::text)<=32768)
);
CREATE INDEX axo_personal_signals_recent ON axo_personal_signals(wallet_key,at DESC);
CREATE TABLE axo_portfolio_history (
 wallet_key char(64) NOT NULL REFERENCES axo_wallet_workspaces(wallet_key) ON DELETE CASCADE,
 chain text NOT NULL, block_key text NOT NULL, observed_at timestamptz NOT NULL,
 payload jsonb NOT NULL, PRIMARY KEY(wallet_key,chain,block_key),
 CHECK (octet_length(payload::text)<=262144)
);
CREATE TABLE axo_intelligence_outcomes (
 signal_id char(64) NOT NULL, horizon integer NOT NULL CHECK (horizon IN (24,72)),
 issued_at timestamptz NOT NULL, observed_at timestamptz, payload jsonb NOT NULL,
 PRIMARY KEY(signal_id,horizon), CHECK (octet_length(payload::text)<=32768)
);
-- Browser history remains private context. It must no longer overwrite authoritative public records.
ALTER TABLE axo_stream_project_history DROP CONSTRAINT IF EXISTS axo_stream_project_history_chain_address_pool_key_fkey;
CREATE INDEX axo_project_evidence_expiry ON axo_project_evidence(expires_at);
CREATE TABLE axo_signal_baselines (
 wallet_key char(64) NOT NULL REFERENCES axo_wallet_workspaces(wallet_key) ON DELETE CASCADE,
 rule_key char(64) NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(wallet_key,rule_key), CHECK(octet_length(payload::text)<=2048)
);
CREATE TABLE axo_quality_metrics (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(),
 operation text NOT NULL, status text NOT NULL CHECK(status IN ('success','failed','limited')),
 duration_ms integer NOT NULL CHECK(duration_ms BETWEEN 0 AND 300000), version text NOT NULL
);
CREATE INDEX axo_quality_metrics_recent ON axo_quality_metrics(at);
