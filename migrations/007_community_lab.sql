-- Shared research is separate from Hatchery XP, votes, rewards and market evidence.
CREATE TABLE axo_community_requests (
 project_key char(64) NOT NULL, owner_key char(64) NOT NULL,
 chain text NOT NULL, address text NOT NULL,
 topic text NOT NULL CHECK(topic IN ('contract','liquidity','delivery','catalyst')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_key,owner_key,topic)
);
CREATE INDEX axo_community_requests_recent ON axo_community_requests(updated_at DESC);
CREATE TABLE axo_community_findings (
 id uuid PRIMARY KEY, project_key char(64) NOT NULL, owner_key char(64) NOT NULL,
 chain text NOT NULL, address text NOT NULL,
 topic text NOT NULL CHECK(topic IN ('contract','liquidity','delivery','catalyst')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 payload jsonb NOT NULL CHECK(octet_length(payload::text)<=4096),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_key,owner_key,topic)
);
CREATE INDEX axo_community_findings_recent ON axo_community_findings(updated_at DESC);
CREATE TABLE axo_community_reviews (
 finding_id uuid NOT NULL REFERENCES axo_community_findings(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), reviewer_key char(64) NOT NULL,
 verdict text NOT NULL CHECK(verdict IN ('useful','needs-evidence')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(finding_id,revision,reviewer_key)
);
CREATE INDEX axo_community_reviews_recent ON axo_community_reviews(updated_at DESC);
