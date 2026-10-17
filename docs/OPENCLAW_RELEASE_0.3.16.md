# OpenClaw release 0.3.16 — community research loop

Prepared 2026-10-17. Extends 0.3.15. Adds migration **007_community_lab.sql** to the existing database. Preserve migrations 001–006 and their checksums, all wallet workspaces, paper journals, positions, rewards and private configuration.

## Useful community production

Members can request four concrete checks on an exact chain/token: contract controls, liquidity and exits, product delivery, or an upcoming catalyst. They can publish a concise finding with a public HTTPS source and an observation date within seven days. Other signed members can mark a finding useful or in need of evidence. An edit increments its revision; previous reviews do not endorse a changed claim. Self-review, wrong-project reviews and stale edit overwrites are rejected by the database statements.

The Hatchery stream has a compact research board with chain/check filters, project logos and available dated market context. Full project streams contain the four research checks and inline contribution forms. Profile contains private contribution management and requested-check follow-ups, showing dated findings submitted since a request. Members can remove individual findings or requests and withdraw all their research. These features do not award XP, issue rewards, replace Crew voting or claim to have completed an automated contract check.

Member findings are explicitly public after opt-in and submission. Review/request counts below three signed wallets are withheld. Distinct wallets are not proof of distinct people, independent sources or consensus. A useful review is feedback on evidence, not a verified fact, token safety label, investment recommendation or expected profit. Nothing in the new research loop authorizes a paper entry, changes execution checks or increases the Axo evidence score.

## Storage, ownership and practical boundaries

- Three shared, bounded reads build the research board, cached for 15 seconds and invalidated by writes. Returned samples cap projects/findings/reviews; incomplete samples are not global totals. Existing community interest now uses one bounded batch instead of up to 81 queries, and renewed contributions use `updated_at` for freshness.
- Every write requires the existing signed session, same-origin request and explicit sharing permission. New submissions and peer reviews keep the existing holder capability check. Private management reads are owner-scoped. Withdrawal remains available after loss of tier access or sharing permission.
- Author and reviewer sharing permissions are rechecked in public reads and at insertion. Profile opt-out and private-workspace deletion also withdraw the new research. Findings delete their reviews through a foreign-key cascade. A cache refresh invalidated during withdrawal cannot republish its earlier result.
- Findings have revision conflicts, ten-second contributor throttling, bounded body/text/URL sizes and an 80-item request/finding allowance. Members can still update existing contributions at that allowance. No arbitrary fetch, model request, wallet operation or transaction is dispatched by a submission.
- The service never publishes owner keys, reviewer keys, session wallets or individual holdings. Member-written text and source links are explicitly public. Source dates are member supplied and labeled as member evidence; page contents are not fetched or verified by this feature. No anonymous contribution fallback is created when storage is unavailable.
- Seven-day freshness and six-hour cleanup cover requests, findings and reviews; useful findings can be renewed with fresh evidence. Old-revision reviews are ignored and later removed by retention. The legacy community privacy cohort and bounded ranking weight remain in place.
- The browser audit found Hatchery intake was accidentally inheriting Discovery's screened-only gate. Its dedicated research renderer now exposes incomplete checks as **Research intake**, while severe flags and excluded base assets stay hidden. Discovery keeps its existing eligibility gate. An empty filtered row also no longer crashes presentation. Explicit contribution feedback can update the card being read while preserving draft input and its position.

## Deployment

1. Pull the published main revision without overwriting newer OpenClaw integration work. Preserve runtime state and use the normal backup procedure for the existing `axo_streams` database.
2. Apply the repository's migration runner as the existing database role. Migration 007 adds three tables and indexes only. Do not rewrite historical migrations or create a replacement database. The migration has been executed together with 001–006 in disposable PostgreSQL, but live migration/role permissions still require operator acceptance.
3. Rebuild release metadata from the clean checkout and restart the dashboard. Retain `AXO_PAPER_ENGINE=strategies` and all existing wallet/auth configuration. No new production dependency, API key, fee service or environment secret is needed.
4. Verify `/api/release` reports 0.3.16 and the installed commit; `/api/community-lab` should report `available`. `/api/community-lab/own` must return 401 without a signed session. A missing database/migration returns an unavailable board with no fabricated contributions.
5. With approved test accounts, opt into community sharing in Profile. Request a check, publish dated evidence, review it from another account and edit the finding. Confirm feedback applies only to the current revision, self-review fails and a second account never receives the first account's private management history.
6. Withdraw a finding and confirm its reviews disappear. Revoke sharing and verify all new and legacy contributions disappear. Confirm Hatchery voting/XP/rewards and the five-chain paper engine continue using their existing authorities.
7. Check Hatchery, project and Profile at desktop and phone widths. Request/finding/review counters are evidence contributions, not profit or reward claims. Return installed revision and acceptance evidence through coordination; receipt is not installation.

Rollback: revert application code and restart while preserving migration 007 and its data. Older code will not display the research board. Prefer a forward fix for any privacy or contribution issue; do not erase the paper journal, workspaces or reward data. Dropping the new tables is unnecessary and would destroy member research.

## Verification and research basis

`pnpm --dir work/dom-test install --ignore-workspace --frozen-lockfile --ignore-scripts` installs the existing isolated test package, including pinned PGlite. It is only a test tool; production code still uses the existing PostgreSQL connector. Run `npm run test:community-lab` and `AXO_BROWSER_CHANNEL=chrome npm run test:community-lab-browser` with the bundled/installed Node runtime.

Checks execute all seven repository migrations and real parameterized contribution SQL in disposable PostgreSQL. They cover ownership/consent/origin, conflicts, self/wrong-project reviews, review revisions, private reads, withdrawal cascades, bounded shared reads, renewed interest, unavailable storage and stale evidence. Browser fixtures cover filters, market/logo context, inline contributions, feedback, unchanged compose drafts, Profile follow-up/withdrawal, account clearing and light/dark desktop/390/320 layouts. Existing private-workspace, community, saved-stream, route and paper regression checks accompany the release. Browser submissions are synthetic; these checks do not establish live member adoption, safety or investment performance.

Research: [GitHub Discussions](https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions) provides a useful pattern for focused questions, answers and contribution management. Axo applies that pattern to dated project evidence rather than treating popularity as verification. [PGlite's official documentation](https://pglite.dev/docs/) supports isolated in-memory PostgreSQL execution for migration and query verification.
