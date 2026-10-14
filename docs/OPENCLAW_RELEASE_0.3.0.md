# AXO 0.3.0 — release and integration tasks

This additive release includes OpenClaw's `dd717d5` voice-capacity changes. Preserve Reown/SIWE, holder tiers, Hatchery, the full header, Credits/Profile/Portfolio, far-right wallet and fixed Ask Axo. Pull normally and restart **axo-streams**; UI changes do not require restarting the separate Codex broker. This handoff does not claim a VPS deployment or live wallet execution.

## Implemented changes

- Responsive proportional momentum treemap with genuine source-linked logos or initials, adaptive labels, hover/focus details and a ranked selection list. The liquidity/activity map has logarithmic USD axes, dollar ticks, exact observation dots and crowded-logo choosers anchored to a real leading observation. Positions are not jittered. Chain history uses actual dates and zero-based volume bars. Existing scope/risk/freshness filters remain authoritative.
- Exact-pool **Volume & transactions** card: dated 5m/1h/6h/24h volume and buy/sell event counts. Windows overlap; they are not history and cannot be summed. Matching cached USD OHLCV supplies closed hourly volume only when available, with gaps unfilled and partial current hours excluded. Missing is not zero. Ask Axo can reuse `project_activity`, `project_progress` and `large_wallets` data-only components; public answer context includes bounded transaction windows.
- Compact **On the radar** ribbon below the stream icons. It reuses public candidates and collected Discovery results, exact-token deduplication and current filters. Logos, ticker/name, 24h change, chain color, labeled pool age or verified token age and dated holder momentum are shown where supported. Stablecoins, stale suggestions and severe risks are excluded. Swipe/keyboard navigation and hover/focus retention avoid disruptive motion. No per-visitor scraper or new paid source.
- Persistent **Project progression** checklist in the existing database, via migration **006**. It retains latest source evidence, first provider sightings, material history, last check, next eligibility and recheck leases. First provider seen and pool age do not establish token launch. MC and FDV remain separate. Missing simulations remain unknown. Failed refreshes retain dated evidence; weaker screens do not silently erase severe flags. The existing fair two-active/six-starts-per-minute evidence queue controls work. No replacement database or global factory subscription.
- **Large-wallet observations** check up to three public large-holder/curated addresses for the exact token. Known pool/router/burn/exchange/treasury/custody labels and the selected pool are excluded from automatic candidates; unknown ownership stays unknown. EVM raw balances/decimals use one dated block twelve blocks behind tip and a previous-block hash check. Solana requires explicitly curated owners and finalized exact-mint accounts; provider token accounts are not inferred owner wallets. Baselines and repeated observations are not purchases. Balance changes are cause-unknown, not confirmed buys/sells, independent people or profit. No private user addresses are copied into the public cohort. `work/axo-public-wallet-cohort.json` starts empty; only public self-disclosed identities with verified sources may be labeled. Provider/RPC gaps remain visible.
- Trade balances use the selected **project chain** through `/api/trade/balances`, independent of the browser wallet chain. Percentages use exact spend-token raw balance/decimals. Native and Arc shared-USDC Max reserve a labeled provisional gas buffer, then final route gas is checked before sending. Solana Max stays unavailable while fee/rent cost is unknown. A trusted Trade click can request a known EVM network switch while keeping the modal open. Programmatic/voice opening does not prompt switching or signing. Rejections, pending wallet requests and unrelated account changes have explicit states.
- **Get quote is removed from the visible flow.** Valid inputs trigger debounced, cancelled and sequence-guarded read-only quotes. Minimum spacing, metadata caching/coalescing, provider cooldown and bounded expiry refresh limit usage. No disconnected placeholder wallet/recipient. Empty/non-JSON/truncated responses produce readable errors. Existing exact router/calldata/asset/amount validation is preserved. Explicit **Send to wallet**, separate ERC-20 permission review and MetaMask approval remain required.
- TokenSniffer was explicitly cancelled and is not integrated.

## Install, acceptance and rollback

Use the retained isolated Postgres migration workflow in `OPENCLAW_HANDOFF.md` to apply **001–006**. Do not change old checksums. Migration 006 adds `axo_project_progress`; previous evidence/private tables are retained. The local Windows preview reports database **disabled** and no connection settings. SQL-adapter tests are not real Linux Postgres acceptance. Missing/unavailable migration 006 must show durable progress unavailable; process cache is not persistence.

New checks: `test-visual-model.mjs`, `test-project-progress.mjs`, `test-trade-recovery.mjs`, `test-builder-coordination.mjs`, `test-visual-trade-browser.mjs`. The existing `test-modern-swap.mjs` now checks automatic quoting. Retain stream/evidence/AI/queue/holder/wallet checks. Browser fixture screenshots label synthetic observations. Check desktop and 320/390 light/dark, actual logos/fallbacks, crowded chooser, exact project navigation, zero/missing/stale values, ribbon/header placement and preserved main project anchor.

OpenClaw must test the user's **exact** Robinhood project contract with a real wallet: correct Buy/Sell assets, selected-chain balances, percent/Max, network rejection, automatic quotes and explicit approval. Names alone are ambiguous. This release used read-only source checks and synthetic/rejected wallet requests; no real trade or new live voice execution is claimed. Live source coverage is partial and stale observations may yield empty charts.

Rollback the app revision and restart `axo-streams`. Retain additive migration 006/data; older versions ignore it. Optional cohort/coordination config can be disabled separately. Do not delete private records or revert prior migrations.

## OpenClaw task: shared read-only live knowledge

Verified current state: local database disabled; local connection settings absent; no authenticated live DB/shared-project read verified. OpenClaw owns the live isolated database. Prefer a restricted authenticated project/evidence API or supported gateway method over opening database network access.

Provide exact chain + contract (+ pool), schema version, source URLs and observed/fetched/expiry times, explicit coverage/errors, cursor pagination and material deltas. Preserve Solana case and distinguish delivery/cache time from observation time. Exclude private workspaces, watchlists, account history/balances/rewards, sessions and credentials. Grant no production write, migration, SQL or shell scope. Proposed sanitized shape (not an installed route):

```json
{"version":1,"identity":{"chain":"base","address":"<exact contract>","pool":"<exact pool>"},"asOf":"<UTC timestamp>","items":[],"history":[],"coverage":"partial","nextCursor":null}
```

Document actual transport/method, schema/capabilities and rate/cache policy without secrets. Provision minimal credentials privately server-side via an approved operator channel or ignored configuration; never Git/chat/frontend. Development consumes public shared research and isolates fixtures/dev writes. Builder verifies one authenticated project read, exact identity, source dates, pagination/dedupe, excluded private fields and revoked access. Do not call the connection complete before that succeeds.

## OpenClaw task: live builder coordination

The existing paired gateway adapter supports only advertised `health`, `status`, `models.list` with `operator.read`; it cannot send messages. Do not expand it to unverified gateway commands.

`axo-builder-coordination.mjs` and `axo-coordinate-cli.mjs` provide an optional server/CLI seam, inert without configuration. They have typed status questions/updates/results/pings, IDs/correlation IDs, a twenty-message durable outbox, idempotent acknowledgments, five-second delivery spacing, one-minute error backoff, bounded payloads and metadata-only audit history. Only the configured `claw.supah.ai` HTTPS destination is allowed. No public message/command endpoint, arbitrary shell/SQL/tool execution or automatic trust of received agent text.

OpenClaw must identify/install an actual supported counterpart and privately provision `AXO_COORDINATION_ENDPOINT` and dedicated `AXO_COORDINATION_TOKEN`. No gateway route is assumed. Proposed envelope and acknowledgment:

```json
{"protocol":"axo-coordination-v1","message":{"version":1,"id":"<id>","correlationId":"<correlation>","sender":"axo-builder","destination":"openclaw","at":0,"kind":"ping","text":"Check deployed revision","context":{}}}
```

```json
{"version":1,"id":"<same id>","sender":"openclaw","status":"accepted","at":0}
```

Use current UTC epoch milliseconds for `at`. Counterpart must validate authentication/scopes, reject private data and persist deduplication. Specify its supported polling/events/results contract before inbound delivery is added; no polling route is invented here.

An active builder can run `node work/axo-coordinate-cli.mjs status`, `send <bounded-message.json>` or explicit `flush` with credentials in its server/CLI environment. OpenClaw may host a bounded background dispatcher after counterpart setup. This Codex chat is not always on; live notifications/wakeups require an explicitly supported integration and no automation is created here. Validate one harmless authenticated ping and result, duplicate/restart/outage/auth-denied cases and revocation/disablement. Current status is **not configured / not connected**. Unit acknowledgment fixtures are not a live link.

## OpenClaw acknowledgment — fill in next integration commit

- Installed app revision and migration versions:
- Actual read-only knowledge transport/schema (no credentials):
- Private provisioning and minimal scope confirmed:
- Authenticated sample project read and source-date validation:
- Coordination counterpart and authenticated ping/result outcome:
- Revoke/disable/rollback checks:
- Remaining production/provider acceptance gaps:
