# AXO Dynamic Dashboard

A local crypto research dashboard with configurable streams, project discovery, launchpad feeds, wallet portfolio views, and Ask Axo text and voice controls.

Builder and agent integrations should start with [`BUILDER_HANDOFF.md`](BUILDER_HANDOFF.md), then fetch the current `main` branch before making changes.

## Conversational streams and voice

Ask Axo can open builtin or saved streams by name, create and save named streams with supported filters and data-bound cards, and ask before adding an optional improvement. Requests use the active stream and public source references. Existing wallet verification and tier permissions still apply.

Voice defaults to Realtime 2 with Verse. Set `AXO_VOICE_MODEL=gpt-realtime-2.1-mini` for the smaller option, or explicitly select `gpt-live-1` for the legacy protocol. Keep the existing server/personal key configuration; provider errors never silently select another key. Restart after changing the model. See [0.3.21 deployment and validation](docs/OPENCLAW_RELEASE_0.3.21.md).

## Run locally

Requires Node.js 24 or newer and pnpm. Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Open http://127.0.0.1:43187/?view=compact-intel. The server binds to loopback and is intended for local use. First launch collects public data; missing or rate-limited sources are shown as unavailable.

Public market views work without private API keys. Optional services:

- **Ask Axo / Luna research:** a locally installed and signed-in Codex CLI available as `codex`, or configured with `AXO_CODEX_PATH`.
- **Live voice:** copy `.env.example` to `.env` and configure `OPENAI_API_KEY`. A personal voice key entered in Profile overrides the shared key for that browser session. Personal keys are held in server memory and must be entered again after a server restart. Both shared and personal voice keys require verified holder access.
- **Argus launch events:** configure `AXO_BITQUERY_ACCESS_TOKEN` for the optional Bitquery source.

Credentials belong in the local `.env` file or the process environment. Neither credentials nor local usage records are included in the repository.

## Holder access and tiers

Public streams remain open. The main wallet button is the single Reown entry for wallet connection and holder access. A user-initiated connection continues to an explicit Sign-In with Ethereum ownership message, then checks the exact AXO holding and automatically applies the matching tier. Connecting or restoring an address without the ownership signature grants no AI access. Signing in authorizes no transaction or token approval. Ownership verification currently supports standard EVM wallet message signatures; Solana and contract-wallet sign-in are not implemented.

The server reads the exact AXO token balance on Robinhood, independently of the wallet's browsing network. It classifies exact integer token units, caches routine verified balance reads for up to one minute, and refuses missing, stale or mismatched evidence. Every newly completed ownership signature bypasses that cache and forces a fresh holdings read before tier assignment. Authentication uses an HttpOnly, SameSite cookie lasting two hours, with Secure cookies on the HTTPS origin. Sign-out and wallet changes clear browser access; active voice rechecks server access every minute and also checks after startup.

| Tier | Minimum AXO | Backend AI requests/day | Voice minutes/day | Additional available utilities |
| --- | ---: | ---: | ---: | --- |
| Public | 0 | 0 | 0 | Browse public streams; existing browser-local tools |
| Normal holder | 1,000,000 | 20 | 5 | Ask Axo and voice; conversational Watchlist, Favorites and local alert controls |
| Improved | 2,500,000 | 60 | 15 | Custom research cards, comparisons, saved research streams and tracked-project actions |
| Top | 5,000,000 | 120 | 30 | Larger daily service allowance |
| Whale | 10,000,000 | 240 | Unlimited | No Axo voice session timer or voice-start quota; shared capacity still applies |

These are initial service limits, separate from credit pricing and reward eligibility. Requests include planning attempts, so one question may consume multiple requests. Limits apply per verified wallet across browsers and reset at UTC midnight. Standard voice also respects operator settings (default three-minute sessions and ten shared starts per rolling 24 hours) and the remaining wallet allowance. Unused reserved seconds are returned after successful hangup. Whale holders have no application voice timer or daily voice quota, but provider limits, shared capacity (currently one live session) and current wallet verification still apply. Daily usage survives restarts in the ignored `private/holder-usage.json` under `AXO_RUNTIME_DIR` (default `work`); authentication sessions and personal voice keys do not. Keep that directory persistent and private on the VPS. Planned portfolio monitoring, recurring briefings, priority scheduling and shared launchpad publishing remain labeled unavailable.

For the VPS reverse proxy, set `AXO_PUBLIC_ORIGIN` to the exact public HTTPS origin (default `https://streams.axo.vision`), preserve a supported Host header, and proxy to loopback. Requests from unrelated origins are rejected. This implementation uses one Node process and a local usage ledger; sharing quotas between multiple server processes or replicas requires a shared datastore. Existing browser workspaces and AXO Postgres account linking remain separate from wallet authentication.

## AXO education and current rewards

One prominent, dismissible AXO education card appears near the start of eligible streams, after up to three data cards, and refreshes every 15 minutes while the dashboard is visible. It rotates between tier utility, the exact AXO buy destination and current rewards. Cards replace each other rather than accumulating; dismissal and reload preserve the cooldown. It does not become a project-page anchor or interrupt portfolio views.

Each variant has a cinematic 3:1 AXO-and-Pets header tailored to its subject: utility access, finding the exact token, or selecting a reward basket. The illustrations are brand metaphors; current values and verified destinations remain in the card body. Header space is reserved before images load, and the ratio stays the same on mobile. Artwork and generation prompts are versioned with the application.

Decorative masonry fillers use a separate set of twenty cinematic action scenes: gem discoveries, cave expeditions, scam investigations and adventures across varied landscapes. They fill only existing gaps, disappear when the gap closes, and never move research cards. Visible gaps use distinct images, and versioned image URLs refresh replaced artwork in existing browsers. The original slot filenames remain stable; scene names and prompts live in `work/axo-brand-manifest.json`.

The rewards variant refreshes once per minute while the page is visible, using the ecosystem adapter's exact-token official configuration, Based.bid observations and reward relay feeds. It shows the current selected basket separately from lifetime tracker distributions, retains exact per-asset token amounts, and dates observations. Fee values come from current verified configuration and explicitly identify the buy trade denominator; no fixed 5% or 3% assumption is made. These feeds do not establish holder-paid totals, so confirmed holder payments remain unverified. Stale or missing values are shown as unavailable, and no reward or price gain is promised.

## Rebound research and Bounce cards

Open **Rebound research** from the stream bar, or ask Axo to “Find rebound projects on Base” or “Add a rebound research card to this stream.” Reusable `rebound_radar` and `bounce_board` layouts work in the current stream or a named chain stream. Chain overviews and Discovery also surface the research; Discovery retains its active project filters. Public browsing reads cached research. A signed normal holder can request a source scan; adding or resuming a watch requires the Improved tier (2,500,000 AXO). Ask Axo can track, pause, resume and remove an exact project’s watch after research establishes eligibility.

The initial screen requires a price at least 35% below the highest daily **close** across the previous 30 completed UTC days, pool liquidity of at least $100,000, 24-hour pool volume of at least $10,000, and commits on at least two distinct dates in the previous 30 days in a provider-linked repository. It excludes stablecoins, known bonding-curve venues and reported honeypot, sell-blocking or non-transferable tokens. A previously reported severe contract flag remains blocking until a fresh exact-token response explicitly clears that flag; an outage does not clear it. Unknown screening remains visible and is not a safety pass.

Research requires 30 consecutive completed USD daily candles and 80 consecutive completed USD hourly candles for the exact chain, token and pool. Incomplete bars are ignored; missing intervals are not filled. The development adapter checks one provider-listed website when needed, then public GitHub metadata and up to 100 commits. Explicitly identified bots are excluded. A linked repository and commit count do not verify team ownership, product delivery, competence or continued funding; those gaps remain in each card. Neither the signal count nor the Axo score is a calibrated recovery probability.

Bounce confirmation requires all seven observed conditions: the close is above the 20- and 50-hour averages; the 20-hour average is above the 50-hour average and rising versus six hours earlier; the last 24-hour low exceeds the preceding 24-hour low; the close exceeds the preceding 24-hour high; and mean USD trading volume over the last six hours is at least 1.5 times the preceding 24-hour mean. All conditions must hold on two newly observed consecutive closed hourly candles. The first snapshot is a baseline, not an alert. Duplicate polls, missing history and restart do not create a second confirmation. Each dated Bounce card preserves the triggering evidence and original dip; a 24-hour cooldown limits repeat alerts.

The original dip thesis lasts 30 days, allowing an existing watch to follow repair even after the dip falls below 35%. An expired thesis does not alert; remove it, run fresh research and track again to establish a new baseline. Pool liquidity must retain at least 80% of its initial USD valuation and still meet the fixed minimum. This valuation comparison does not establish net capital flows. Monitoring checks fresh holdings, suspends on failed verification or tier loss, and stops when paused or removed. Watches and alerts are owned by the signed wallet across browsers and persist in the private `rebound-monitoring.json` under `AXO_RUNTIME_DIR`; preserve that directory on the VPS. Alerts appear as in-app Bounce cards and an unread stream badge, not email or OS notifications.

Collection is a bounded sample, not a market census or a list of guaranteed winners. A scan takes up to two recent decliners and one high-volume pool per requested chain, keeps the deepest observed pool per token, and checks up to twelve exact projects. At most two projects are checked per minute; watches take priority and have a minimum fifteen-minute check interval. Shared provider budgets, missing coverage and server downtime can defer checks or miss a confirmation. The cards expose sample coverage, dates and unavailable sources rather than inventing candidates.

## Project layout

- `work/axo-server.mjs`: server entry point and API routing.
- `work/axo-*`: application services, browser components, and shared models.
- `work/test-*.mjs`: automated checks. Browser checks expect the local server to be running; many use Microsoft Edge via Playwright.
- `outputs/axo-live-dashboard.html`: dashboard entry document.
- `outputs/assets` and `outputs/axo-brand-set`: application artwork.

The `work` directory name is retained from development. Runtime caches, generated card layouts, local ledgers, and research captures are excluded by `.gitignore` and are created as needed.

## Checks and build

```sh
pnpm run test:core
pnpm run test:browser
pnpm run test:holders
pnpm run test:utility
pnpm run test:rebounds
pnpm run test:rebound-browser
node work/test-launchpad-direct.mjs
node work/test-launchpad-pages.mjs
node work/build-solana-sdk.mjs
```

The last command rebuilds the committed browser bundle for the Solana wallet integration. Rebound checks use synthetic source observations and a mock planner; they verify identity, evidence gaps, confirmation, ownership, persistence, current-stream layouts and mobile rendering, not trading performance or live Luna behavior. Some additional tests are historical development diagnostics requiring local captures, or live-provider probes that may require credentials and consume provider resources; inspect a test before running it. The optional DOM harness installs separately with `pnpm --dir work/dom-test install --frozen-lockfile`.

## Coverage and current limits

The dashboard includes Solana, Base, BNB Chain, Robinhood, and Arc streams. Coverage differs by provider and chain; the UI exposes missing evidence and observation times.

Launchpad discovery includes eleven platform entries. Direct Pons, PAR, and Raydium LaunchLab feeds supplement existing GeckoTerminal samples. Argus needs a Bitquery credential. Some directory entries have published contracts but no connected indexer; Based.bid's platform-wide launch enumeration remains incomplete. New-launch and graduation lists are separate from measured activity screens.

AXO scores rank available research evidence; they are not probabilities of profit. Contract screening and available simulation results describe tested conditions. Portfolio daily P&L requires adequate balance and cash-flow history.

Wallet ownership and holder gating are enforced for protected AI endpoints. Version 0.2.0 adds signed-wallet private workspace persistence when the existing database is migrated, including Watchlist, Favorites, streams, alerts and editable opt-in memory. Anonymous browser records remain a separate fallback and migrate only by user choice. Explicit community research uses signed consent and aggregate privacy gates; shared root-directory publishing remains a separate reviewed capability.

MIT licensed; see [LICENSE](LICENSE).

## Wallet-gated administration

The exact EVM controller wallet is the only default admin; override with `AXO_ADMIN_WALLET`. Connect that account and select **Admin** to sign a short-lived, origin-bound, nonce-based message (no transaction authority). Admin actions require a session and CSRF token; logging out or changing accounts revokes the browser session. The admin API requires a matching `AXO_PUBLIC_ORIGIN`; configure the reverse proxy to allow `/api/admin/*` POST/GET and `/admin-ui.js` only after independently reviewing the host policy. This repository change does **not** modify Caddy or restart the service.

Managed settings and the separately stored shared OpenAI voice key are written atomically under `/var/lib/axo-streams` with mode 0600. Set directory ownership for the runtime user and restrict directory access. The key is checked through the OpenAI model-retrieval endpoint before activation (authentication/model availability, not a billed voice-session guarantee), is never returned, and is read at request time without a restart. If no managed key exists, `OPENAI_API_KEY` remains the process fallback. ChatGPT/Codex billing is separate from OpenAI API usage. Radio is retired; its old endpoints return 410 and no broadcast scheduler runs. Settings affect new standard voice sessions; Whale timer/quota semantics and shared capacity remain unchanged.

## Optional durable public research cache

The default remains the in-memory and existing JSON caches. PostgreSQL activates only when all three `AXO_STREAMS_DB_*` variables in `.env.example` are set. This client uses Unix sockets and peer authentication only; the isolated cluster must have database `axo_streams`, role `axostreams` (matching the OS runtime user), and socket directory `/run/axo-streams-postgres`. The application never provisions or starts a cluster itself. The separate configuration, peer-auth and service files in `db-deploy/` document the verified isolated deployment shape; review them against the target host before installation. Do not connect another product's database.

Operator setup (after independently provisioning and backing up the isolated cluster):

```sh
node db-deploy/db-maintenance.mjs migrate
node db-deploy/db-maintenance.mjs import
node db-deploy/db-maintenance.mjs retain
```

These commands require the same explicit socket settings and OS peer identity as the service. Migrations are numbered, checksummed and idempotent. The one-shot import accepts only the allowlisted public chain snapshot, live feed cache and historical discovery research JSON from `/var/lib/axo-streams`, records SHA-256 file hashes, skips unchanged files, and does not edit or delete JSON. Imported historical feed and research snapshots lack exact request/prompt hashes and are **not** returned as fresh cache hits. Neither the migration nor import happens automatically at startup. Roll back by unsetting the three settings and restarting only during an approved deployment; existing JSON rollback files remain intact. Database provisioning and service lifecycle remain explicit operator actions rather than application-side behavior.

Source cache checks memory, then fresh exact-request durable records, then upstream under the existing provider budgets; on upstream failure only bounded stale records can be delivered and are labeled `stale-postgres`. Reusable background chain/market/strategy and exact public creator research uses evidence/model/instruction/schema hashes; Ask Axo, voice, wallets, portfolios, admin and transactions are never durably cached. Exact project metadata is stored by chain/contract/pool and never merged by ticker. Maximum cache payload is 256 KB, freshness is bounded by per-call TTL and seven days, stale grace by one day. The process attempts retention every six hours; operators can also run the `retain` command. Source and AI rows expire at `stale_until`; unreferenced project rows older than 90 days are pruned. `db-deploy/backup.sh` plus the example service/timer creates a peer-authenticated custom-format dump daily, verifies its catalog, and retains seven days; provision its backup directory for the `axostreams` OS user before enabling it. If the database is absent, unready or unreachable, existing memory/JSON fallback stays active, and the coverage panel reports `unavailable` or `disabled` without connection details or fake hits. For CI, `node work/test-durable-store.mjs` uses deterministic fakes and requires no local Postgres.

### Anonymous stream continuity

Migrations `002_stream_memory.sql` and `005_unbounded_saved_streams.sql` add first-party anonymous workspaces identified only by the SHA-256 digest of a random Secure/HttpOnly/SameSite=Lax cookie token. Saved stream definitions use optimistic revisions and deletion tombstones; there is no fixed shortcut-count cap, while request and database JSON byte bounds still apply. The workspace also retains exact chain/token/pool observations with timestamps and counts. No wallet, IP address, user agent, account state, or ticker-based identity is stored. Project history is retained for at most 180 days; any matching public project-cache rows are protected from pruning while referenced. Migration `003_personal_intelligence.sql` removes the initial history-to-public-project foreign key so anonymous browser observations remain private instead of writing browser-supplied metrics into authoritative public project records. The same-origin `/api/stream-memory` endpoint accepts bounded normalized shortcut and public project observations; unavailable PostgreSQL fails closed while browser localStorage continues as the offline fallback. Apply numbered migrations only through the documented operator maintenance procedure after backup; this implementation task does not run migrations or restart services. Test with `npm run test:stream-memory` and `npm run test:durable`.

## Personal intelligence release 0.2.0

See [the OpenClaw deployment handoff](docs/OPENCLAW_HANDOFF.md) for the complete nine-item implementation map, migrations 003/004, private accounting source contract, verification and rollback. Project dossiers, private signals, sourced category connections, community research and quality views are connected to the application. The subtle logo-adjacent build tooltip and `/api/release` identify the server startup revision, including unpublished/changed-asset states.

Run `pnpm run test:personal-intelligence`, `pnpm run test:stream-memory` and `pnpm run test:durable` for deterministic checks. With the local server running, `pnpm run test:release-routes` checks all dashboard scripts and unsigned private access without model calls or transactions. Use `pnpm run build:release` after checking out the intended clean revision and before restarting the application. Existing operator queue budgets and provider choices remain unchanged. Real database migration, signed-device acceptance and private ledger coverage require verification on the deployment; unavailable account history never becomes a zero balance or profit claim.
