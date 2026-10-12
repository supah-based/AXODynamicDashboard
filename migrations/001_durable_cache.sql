CREATE TABLE axo_source_cache (
 cache_key char(64) PRIMARY KEY, provider text NOT NULL, source text NOT NULL,
 model text NOT NULL DEFAULT '', operation text NOT NULL DEFAULT '', evidence_hash char(64), prompt_hash char(64),
 chain text, address text, pool text,
 fetched_at timestamptz NOT NULL, observed_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL, stale_until timestamptz NOT NULL,
 payload jsonb NOT NULL, hit_count integer NOT NULL DEFAULT 0,
 CHECK (expires_at>fetched_at AND stale_until>=expires_at), CHECK (octet_length(payload::text)<=262144)
);
CREATE INDEX axo_source_expiry ON axo_source_cache(stale_until);
CREATE TABLE axo_ai_cache (LIKE axo_source_cache INCLUDING ALL);
CREATE INDEX axo_ai_expiry ON axo_ai_cache(stale_until);
CREATE TABLE axo_projects (
 chain text NOT NULL, address text NOT NULL, pool text,
 pool_key text GENERATED ALWAYS AS (coalesce(pool,'')) STORED,
 provider text NOT NULL, observed_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL,
 PRIMARY KEY(chain,address,pool_key), CHECK (octet_length(payload::text)<=262144)
);
CREATE INDEX axo_projects_retention ON axo_projects(updated_at);
CREATE TABLE axo_cache_imports (
 file_name text PRIMARY KEY, sha256 char(64) NOT NULL, imported_at timestamptz NOT NULL DEFAULT now(), row_count integer NOT NULL DEFAULT 0
);
