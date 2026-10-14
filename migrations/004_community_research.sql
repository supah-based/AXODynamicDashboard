CREATE TABLE axo_community_contributions (
 project_key char(64) NOT NULL, owner_key char(64) NOT NULL,
 chain text NOT NULL, address text NOT NULL, kind text NOT NULL CHECK(kind IN ('interest','watch','like','holding','note')),
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz,
 PRIMARY KEY(project_key,owner_key,kind), CHECK(octet_length(payload::text)<=2048)
);
CREATE INDEX axo_community_recent ON axo_community_contributions(created_at DESC) WHERE withdrawn_at IS NULL;
CREATE TABLE axo_community_reports (
 project_key char(64) NOT NULL, reporter_key char(64) NOT NULL, contribution_key char(64) NOT NULL,
 reason text NOT NULL CHECK(length(reason)<=280), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_key,reporter_key,contribution_key)
);
