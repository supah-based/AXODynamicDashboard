CREATE TABLE axo_stream_workspaces (
 workspace_hash char(64) PRIMARY KEY CHECK (workspace_hash ~ '^[a-f0-9]{64}$'),
 revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
 shortcuts jsonb NOT NULL DEFAULT '[]'::jsonb,
 preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 tombstones jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (jsonb_typeof(shortcuts)='array' AND jsonb_array_length(shortcuts)<=12),
 CHECK (octet_length(shortcuts::text)<=32768),
 CHECK (jsonb_typeof(preferences)='object' AND octet_length(preferences::text)<=4096),
 CHECK (jsonb_typeof(tombstones)='array' AND jsonb_array_length(tombstones)<=128),
 CHECK (octet_length(tombstones::text)<=16384)
);
CREATE INDEX axo_stream_workspaces_retention ON axo_stream_workspaces(updated_at);
CREATE TABLE axo_stream_project_history (
 workspace_hash char(64) NOT NULL REFERENCES axo_stream_workspaces(workspace_hash) ON DELETE CASCADE,
 stream_id text NOT NULL CHECK (length(stream_id) BETWEEN 1 AND 64),
 stream_title text NOT NULL CHECK (length(stream_title) BETWEEN 1 AND 120),
 stream_definition jsonb NOT NULL,
 chain text NOT NULL,
 address text NOT NULL,
 pool text,
 pool_key text GENERATED ALWAYS AS (coalesce(pool,'')) STORED,
 first_seen timestamptz NOT NULL,
 last_seen timestamptz NOT NULL,
 seen_count integer NOT NULL DEFAULT 1 CHECK (seen_count BETWEEN 1 AND 2147483647),
 payload jsonb NOT NULL,
 PRIMARY KEY(workspace_hash,stream_id,chain,address,pool_key),
 FOREIGN KEY(chain,address,pool_key) REFERENCES axo_projects(chain,address,pool_key) ON DELETE RESTRICT,
 CHECK (last_seen>=first_seen),
 CHECK (octet_length(payload::text)<=32768),
 CHECK (octet_length(stream_definition::text)<=4096)
);
CREATE INDEX axo_stream_project_history_recent ON axo_stream_project_history(workspace_hash,last_seen DESC);
CREATE INDEX axo_stream_project_history_project ON axo_stream_project_history(chain,address,pool_key);
