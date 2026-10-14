# AXO 0.2.0 — personal intelligence deployment

This release extends the existing AXO Streams application and isolated `axo_streams` database. It does not create a replacement database, deploy the VPS, provision accounts, or execute trades. The local preview is `http://127.0.0.1:43187/?view=compact-intel`; production is `https://streams.axo.vision` after OpenClaw installs and verifies this release.

The application version is **0.2.0**, the intelligence release identifier is **personal-intelligence-v1**, and saved-stream definitions are version **2**. Use the exact installed Git revision, rather than assuming the latest remote commit is running. The build label next to the AXO logo exposes startup revision, development state, asset fingerprint and startup time in a hover/focus/touch tooltip. `/api/release` returns the same public metadata. A dirty checkout shows `*`; changed assets require a restart. An unknown/no-Git checkout stays unknown unless an operator supplies an exact deployment commit or build manifest. No credential or filesystem path is returned.

## Implementation and evidence

All nine audit improvements have runtime and UI paths. Database-backed features require migrations and connectivity; accounting additionally needs a verified private history source. Those dependencies must not be described as already connected merely because the code is installed.

| Audit item | Implemented behavior | Validation and production condition |
| --- | --- | --- |
| 1. Saved-stream contract | `axo-stream-schema.cjs` is shared by browser normalization, API validation and durable storage. Rebound, custom layouts, filters and score ranges survive version-1 migration; Solana identities retain case. Attached layouts use canonical stream scope. | `test-stream-contract`, stream-memory API/store and durable tests. Migration 003 must precede this application. |
| 2. Private wallet workspace | Signed SIWE ownership selects a private revisioned workspace: Watchlist, Favorites, saved streams, attached cards, alarms, preferences, editable opt-in memory and rolling summary. Import of anonymous browser records is explicit. Owner changes clear previous data; stale results are ignored. Export, deletion, consent revocation and conflict choices are available in Profile. Server memory is authoritative for text and voice-delegated reasoning and planning. | Personal store/API and simulated UI tests cover isolation, conflicts, opt-out and stale wallet responses. Verify two real signed wallets and two devices after deployment. |
| 3. Shared project dossier | Exact chain/contract/pool records retain source URL, observation date, expiry and authority for market, contract, linked development, origin, category and available Hatchery evidence. Project cards and project pages expose the dossier. Holder requests queue collection; followed projects get two scheduling turns per candidate turn. Anonymous observations cannot overwrite shared project evidence. | Exact-pool, wrong identity, future/stale dates and sensitive public-payload tests. Actual provider gaps remain visible; enrichment is a bounded sample. |
| 4. Focused mobile feed | Home and chain views show a compact initial set with up to three ordinary project cards and seven context cards. Pinned/requested cards stay visible; More findings reveals the remainder. Resize relayout works independently of reading updates; phone controls and safe-area spacing are improved. Existing header/stream icons, Credits, Profile, Portfolio and far-right wallet are preserved. | Browser checks at desktop and 320/390 widths, including new views. These are browser viewport checks, not physical phone keyboard/audio testing. |
| 5. Shared Axo actions | `axo-action-registry.cjs` defines supported operations and feature permissions for both text and voice. Existing Watchlist/Favorites/alerts/streams/preferences/trade-review actions remain. New operations open supported streams, inspect exact-project evidence and manage owned inbox items; the four new data-only card components can be reused or attached to a stream. | Intent/rebound tests, AI adapter tests and route permission checks. Live model planning for the newly added operations needs a signed-user acceptance test. No arbitrary code or transaction execution is accepted. |
| 6. Intelligence inbox | Wallet-owned Inbox combines dated material changes, Bounce confirmations, threshold crossings and changed contract/development/origin evidence. Stable IDs, source dates, first-observation baselines, 1% rearming, same-observation deduplication, Read/Useful/Noise/Mute/Delete and a bounded display budget are supported. Fetch-date changes alone do not create material evidence alerts. | Alarm and evidence-signature tests, private routes and existing Bounce persistence tests. Collection runs while a qualifying signed dashboard is open; no OS/email push is promised. |
| 7. Sourced narratives | Exact CoinGecko contract/platform mapping establishes category membership. Fresh matched category-market observations can supply narrative evidence to scores and server answer context. Membership alone earns no narrative points; two endpoints from one provider remain one confirmation. Narrative cards link category connections to exact project pages. | Identity, membership-only and measured-category tests. Unmapped projects and missing social/sector coverage remain unknown. The connection map does not claim measured capital flows. |
| 8. Accounting and rewards | Private snapshots and a private operator-owned ledger support UTC-day, cash-flow-adjusted Modified Dietz P&L. Single-chain bridge flows are handled as scope inflows/outflows. Reward receipts retain full raw precision and separate assets; platform distribution totals are never personal payments. The Portfolio stream contains the result/coverage card. | Missing histories, incomplete inventory/quotes, duplicate/conflicting transactions, bridge scope, reward precision and stale-ledger tests. No complete EVM inventory or private receipt indexer is supplied by this release; leave P&L/receipts unavailable until those sources genuinely exist. |
| 9. Quality and release checks | Quality view reports observed request status, average/p95 latency, versioned prospective 24/72h review outcomes and missing follow-ups. Outcomes are journaled in the existing DB. Personal alert feedback stays private. Build identity and public/protected route checks distinguish installed code from live provider success. | Clean/dirty/no-Git/changed-asset tests, existing intelligence review checks, mocked migrations and localhost smoke tests. Real PostgreSQL migration and live signed/model/audio acceptance remain deployment checks. |

Community co-op research is integrated into the existing Hatchery stream. A signed holder explicitly enables sharing in Profile and then shares each interest, like, watch intent, verified holding interest or sourced note from a project. Private Watchlist/Favorites/holdings are never automatically published. Holding interest needs a fresh server balance read; individual amounts are excluded from public payloads. Only cohorts of at least three wallets expose counts/notes. Wallets are not necessarily distinct people. Interest decays with a three-day half-life over a seven-day window; fresh holding interest has greater weight and expires after one hour. Community influence is capped at eight ranking points and at an 8% activity-ranking adjustment; it does not change the Axo evidence score, lower filters or bypass risk/stale gates. Notes can be reported and users can withdraw all contributions. Reports need operator moderation; this is a lightweight research layer, not a complete social platform. Existing Hatchery heat/fidelity stay separately labeled participation/peer-agreement measures.

## Files and integration points

The main integration is `work/axo-intelligence-runtime.mjs`, created by `work/axo-server.mjs`. New services include `axo-personal-*`, `axo-evidence-service`, `axo-signal-inbox`, `axo-community-*`, `axo-account*`, `axo-quality-metrics` and `axo-release*`. Browser scripts are `axo-private-storage.js`, `axo-personal-ui.js`, `axo-intelligence-ui.js` and `axo-release-ui.js`. The entry HTML loads the stream schema before stream-dependent scripts. `package.json`, `.env.example` and the README provide the new build/test commands.

Existing `DurableStore`, source caching, public project identity, strategy review, SIWE sessions, holder budgets, risk screening, Bounce service, chain data, linked GitHub research and Codex queue are reused. Migrations 001 and 002 are unchanged. The personal store has its own strict field whitelist; it does not use the public-cache sanitizer for private records.

## OpenClaw integration baseline

The release incorporates all five OpenClaw commits through `5f65b0e` and has been reconciled with `BUILDER_HANDOFF.md`. Keep Reown as the sole displayed connector and the main wallet button as the combined wallet/access entry. Only a user-initiated connection continues to SIWE signing; passive restoration never signs. New signatures force a fresh exact Robinhood AXO check before applying tier/allowances. The private-workspace session reader adds ownership access without weakening those research/voice gates.

The current Hatchery `intel.projects` bridge, current/accepting project presentation and qualified-review progress are retained. Streams consumes exact project handoffs and separately labeled peer evidence; it does not duplicate Hatchery wallet, Pet, XP, Crew voting or chain-resolution authority. The merged sign-in UI also dispatches the event that loads the matching private workspace. No migration-number collision occurred: the existing live baseline has 001/002; this release adds 003/004.

Builder identifies the application supervisor as `axo-streams`; confirm the installed unit/path, then restart only that application for server authentication/service changes. Do not restart `axo-streams-codex` for this release. Preserve `/var/lib/axo-streams` and isolated Postgres state. Source UI routes remain no-store, while the startup build tooltip intentionally asks for a process restart if source/assets change after its stamp.

## Deployment sequence

1. Identify the **existing** application unit, checkout, OS runtime user and private runtime directory. Keep its environment, reverse proxy, provider limits and queue settings. This document deliberately does not guess a VPS service name. Confirm that the unit runs Node 24+ and the checkout points to `supah-based/AXODynamicDashboard`.
2. Record the currently running commit and operator configuration. Back up the isolated PostgreSQL cluster with the existing `db-deploy/backup.sh` procedure; confirm the dump catalog and restore process. Back up private runtime files, including holder usage, Bounce state, voice profiles and any verified history. Keep backups outside the repository with restricted permissions. Do not print environment values or credentials into the handoff/logs.
3. Fetch GitHub and fast-forward the intended release. If OpenClaw has local edits or unpushed commits, preserve and integrate them before deployment; do not reset, force-push or overwrite them. Verify `git status --short` and `git rev-parse HEAD`.
4. Install from the committed lockfile and run the bounded tests below. `pnpm-workspace.yaml` disables the unnecessary Reown lifecycle script; no TLS verification bypass is needed. Use Node's `--use-system-ca` when the host requires its system trust store.
5. As the existing peer-auth OS user, apply/verify all numbered migrations **before** starting the new application. Use the same isolated socket/database/role already configured for AXO. The maintenance CLI does not load `.env` itself; Node 24's `--env-file=/absolute/path/to/.env` can supply the existing private environment without displaying it.
6. Build a release manifest on the clean installed checkout, then restart only the existing AXO application unit through its normal supervisor. A build manifest is particularly useful for archive deployments without `.git`. Do not restart or reprovision the database merely to install the application.
7. Verify localhost first, then the public HTTPS routes, then signed-user acceptance. Reload the browser so it receives the new scripts. Compare `/api/release` to the intended installed revision; a GitHub push alone is not proof of deployment.

Commands from the installed application checkout:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run test:personal-intelligence
pnpm run test:stream-memory
pnpm run test:durable
node work/test-intelligence-core.mjs
node work/test-rebound-intent.mjs
node work/test-ai.mjs
node work/test-ask-context.mjs
node work/test-axo-score.mjs
```

Database migration command, substituting the actual private environment path and running as the peer-auth service user:

```sh
node --env-file=/absolute/private/path/.env db-deploy/db-maintenance.mjs migrate
pnpm run build:release
```

After the existing supervisor has restarted the application:

```sh
pnpm run test:release-routes
curl --fail http://127.0.0.1:43187/api/release
curl --fail http://127.0.0.1:43187/api/intelligence-quality
curl --fail http://127.0.0.1:43187/api/coverage
```

`test:release-routes` defaults to localhost. `AXO_TEST_URL=https://streams.axo.vision` checks the public deployment without wallet signatures, model calls or trades. Unsigned private requests must be HTTP 401. Do not run historical live-provider or wallet diagnostics indiscriminately; some use resources or require local fixtures.

## Database and migrations

Reuse `AXO_STREAMS_DB_SOCKET`, `AXO_STREAMS_DB_NAME` and `AXO_STREAMS_DB_ROLE`. The existing design uses an isolated Unix socket and peer authentication, not a shared product cluster or a password/TCP connection string.

Migration 003 adds private wallet workspaces, project evidence, personal signals, signal baselines, portfolio history, prospective outcomes and request quality measurements. It removes the old history-to-public-project foreign key so anonymous history can remain private without inserting browser-supplied market values into authoritative public project records. Existing history is retained; old `stream-memory` public project records are refused as authoritative profile reads. Migration 004 adds explicit community contributions and moderation reports. The runner uses checksums, a transaction and an advisory lock; reruns verify already-applied files. Never edit migrations 001/002 or a migration already applied on a host.

Check `axo_streams_migrations` for versions 1–4 after migration. Use representative test wallets rather than real holder data to verify new tables/ownership. Local tests used deterministic store fakes; no real PostgreSQL migration was executed in this workspace.

The application runs six-hour retention for new data: evidence/outcomes 180 days, signals 30 days, portfolio snapshots 90 days, quality rows/reports 30 days, baselines 90 days, shared contributions seven days. Private workspace deletion cascades its signals/baselines/history and retains only an empty owner-key/revision tombstone so late saves cannot restore deleted records; the deletion flow also removes explicit shared contributions and Bounce monitoring. Existing anonymous workspaces/history remain a separate scope. Private workspaces have revision checks and 250KB application bounds, not a shared public cache.

## Proxy, authentication and permissions

Preserve `AXO_PUBLIC_ORIGIN=https://streams.axo.vision` and same-origin headers/cookies. The proxy must pass GET/POST/DELETE for `/api/personal-workspace` and `/api/community`, GET/POST for `/api/project-evidence`, `/api/signal-inbox` and `/api/accounting`, and GET for `/api/community/own`, `/api/intelligence-quality` and `/api/release`. Serve the new browser script routes as normal same-origin scripts. Do not strip `Cookie`, `Origin`, `x-axo-request`, response `Set-Cookie`, or no-store headers. Private routes must not be CDN cached.

Signed ownership determines the workspace owner; a wallet address in the body cannot select another user's records. Fresh exact AXO holdings gate paid/research mutations, while signed owners can read/delete their own records and revoke memory/sharing even when balance reads fail. Existing SIWE/session expiry and logout semantics remain. In-memory authentication sessions require verification again after a server restart; persistent workspace data is not deleted.

Public browsing stays open. Ask/voice still need at least 1m AXO; custom cards and new/resumed project monitoring need the Improved 2.5m tier. Top/Whale remain 5m/10m. Shared root-directory publishing is still a separate reviewed capability; community interest does not grant permission to edit system configuration. Wallet approvals and trade submission remain explicit. No new automated trade execution was added.

## Private accounting source contract

`AXO_ACCOUNT_HISTORY_DIR` is optional and must point to a private, operator-owned directory outside the public checkout/assets. Files are named by `walletKey(address)` from `axo-personal-model.mjs`, plus `.json`. Restrict directory access and use 0600 files. The adapter accepts at most 2MB/5,000 events, checks the exact wallet and a 15-minute observation age, and never accepts browser-uploaded balances or receipts. With no source, invalid source, partial ledger, missing comparable opening inventory or stale quotes, the UI returns unavailable.

Expected envelope:

```json
{
  "version": 1,
  "wallet": "EXACT_AUTHENTICATED_EVM_ADDRESS",
  "source": "operator-verified-receipts",
  "observedAt": 0,
  "from": 0,
  "to": 0,
  "complete": false,
  "chains": ["robinhood"],
  "events": []
}
```

The zero timestamps above are placeholders and are not production history. OpenClaw must supply actual dated values from verified private sources. The adapter trusts an operator-verified ledger; it does not independently turn arbitrary `verified` flags into blockchain proof. Before populating it, validate exact chain, successful receipt, finality/block date, recipient ownership, event/log identity, asset contract/decimals, recognized reward distributor and source coverage. Do not mark `complete:true` unless the requested interval and all relevant scoped transactions are covered.

Every transaction needs a unique stable `id`, `at`, chain and verified classification: `deposit`, `withdrawal`, `trade`, `internal-transfer`, `reward` or `fee`. Scope cash flows need nonnegative `usd` and comparable `quoteAt` within five minutes of the event. Cross-chain internal transfers need `fromChain`/`toChain` and those same dated values; they are cash flows for a single-chain result. Unknown classification or conflicting duplicate IDs prevents reconciliation.

Rewards additionally need `proof:"confirmed-reward-transfer"`, exact `asset:{chain,address}`, `rawAmount` as an integer string, and integer `decimals`. Keep different assets separate. A platform tracker distribution/allocation, selected reward asset, or estimate is not a personal receipt. DeFi/staking inventory, tax/cost-basis accounting, lifetime history and complete EVM discovery are not inferred. Current API results are per supported EVM chain; Solana ownership needs its separate verified-wallet source. Snapshot capture is bounded to once per wallet per 15 minutes; a day-start snapshot within five minutes of UTC midnight is required. Server downtime/missing history remains a gap.

## Scheduling, cost and source coverage

Keep the installed operator's actual `AXO_LUNA_CALLS_PER_HOUR` and `AXO_LUNA_CONCURRENCY`; this release does not silently raise them. The code default and a deployed operator override can differ. One existing Codex connection supplies reasoning; OpenAI API remains audio-only for Radio/explicit voice. Personal/shared voice keys and existing per-wallet budgets are preserved. No paid text fallback or new provider purchase is added.

Evidence collection allows two concurrent projects and at most six starts/minute with a queue of 100, in addition to existing upstream throttling/caching. Followed projects receive two scheduling turns per candidate turn; a missing source does not become a pass. Community snapshots coalesce and cache for 30 seconds; signed contributions have a ten-second per-wallet spacing. Inbox collection is coalesced and limited to one pass per wallet per 15 seconds; the visible page polls once/minute. Outcomes journal at most once per five minutes; existing hourly bounded strategy samples and three-day research reviews remain. These are process schedules, not promises of delivery while the server is down.

Source coverage remains uneven: linked repositories do not prove team ownership or deployed-code correspondence; category membership is not narrative momentum; social coverage remains bounded/unknown where unconnected; DEX venue is not launch origin. Preserve severe-risk exclusion for suggestions and warnings for watched/held assets. Axo scores and rebound rules are research heuristics, never calibrated profit probabilities. Credits remain an actual-account connection gap with an unavailable balance indicator, not a fabricated balance.

No Alchemy integration. Moralis remains a future option only after actual platform revenue reaches $250/month; that is a business threshold, not a verified subscription price. This release does not sign up, purchase, or assume that revenue.

## Signed-user acceptance and rollback

After migration and restart, test two different signed wallets and two devices for one wallet. Save a project/stream/memory correction, reload elsewhere, provoke a revision conflict, switch accounts during a pending request, revoke memory/sharing, and verify deleted records do not reappear. Browser import/export uses user review; use disposable test data for deletion. Verify body-supplied wallet addresses cannot cross ownership boundaries.

Test one exact project request through text and voice, one new card attached to the current stream, Inbox navigation/Read/Mute, and private accounting unknown states. A real microphone/session/model response is still necessary to validate the full live path. Do not execute a trade to validate these features. Check mobile header and stream icons, wallet at the right edge, tooltip keyboard/touch access, project anchoring, narrow layouts, drawer scrolling and a real phone keyboard. Confirm all new scripts return 200 and there are no application startup errors.

If validation fails, stop rollout and restore the previously recorded application revision through the existing supervisor. Preserve additive tables and private data; do not drop tables or overwrite a newer database with an old backup as a routine application rollback. Older applications may not understand version-2/new stream definitions and do not provide the new private features; document that downgrade limitation. Restore a database backup only through the operator's separately verified recovery procedure if required. No migration, reverse-proxy change, production restart or live database restore has been performed by the local implementation task.
