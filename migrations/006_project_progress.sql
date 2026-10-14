-- Public exact-project extension of the existing database; no personal follows or portfolios.
CREATE TABLE axo_project_progress (
 chain text NOT NULL, address text NOT NULL, pool text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 checked_at timestamptz, next_check_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, priority text NOT NULL DEFAULT 'candidate' CHECK(priority IN ('candidate','followed')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(chain,address,pool),
 CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144)
);
CREATE INDEX axo_project_progress_due ON axo_project_progress(next_check_at) WHERE lease_until IS NULL;
