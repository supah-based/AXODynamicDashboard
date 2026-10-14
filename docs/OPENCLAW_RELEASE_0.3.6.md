# AXO 0.3.6 — focused decisions and measurable paper strategies

Date: 2026-10-14. Additive to published `e9a3eb283deda28adc90044cf6b46c4dfe480537` (0.3.5). Preserve all newer OpenClaw commits, database state, Reown/SIWE, AXO tiers, credits, private-user isolation, Radio retirement and Ask Axo voice.

## Outcome and boundaries

This release implements the next five development priorities: a focused personal Home view, shared priority research, portfolio-level paper limits, configuration-specific paper evaluation, and a bounded public project-data bridge. It is an implementation and audit checkpoint, not proof of a profitable strategy. No real-money autonomous execution, automatic signatures, live-wallet trade, additional paid provider or private database connection was added.

1. **Your next actions:** Home groups the latest public finding per project and gives risk/liquidity changes and configured paper setups priority. The browser's own Watchlist raises personal relevance. Project logos, market cap, liquidity, hourly volume, evidence age, current checks and an exact-project action remain visible. The rest of Home is progressively disclosed. Pins, deliberate manual ordering and requested cards are retained. This personal ranking never changes the shared public ribbon or uploads private interest.
2. **Shared priority research:** one server queue collects exact-pool technical/risk/simulation evidence for held positions, interactive requests, signals and broader discovery, in that order. Duplicate requests share work. At most two collections run concurrently and six start per minute; provider-specific caches and rate limits remain separate. Higher-priority work can displace unstarted lower-priority work from a full queue. Same-priority chains alternate; a warm top candidate no longer starves the next candidate on its chain. Queued work expires after three minutes, cache size is 120, capacity 64. A slow request returns a clear queued state after 1.2 seconds instead of hanging. This numerical-data queue does not alter the user's separate Luna ceiling of 1,000 calls/hour or its two concurrent jobs.
3. **Portfolio paper limits:** defaults are 3% daily marked loss, 10% drawdown since the risk baseline, 40% total exposure and 25% per-chain exposure. These are experimental, operator-editable controls, not investment recommendations. The daily baseline is the first complete fresh mark of a UTC day, not an invented midnight valuation. A daily halt latches for that UTC day; a drawdown halt survives days/restarts until deliberate operator re-arm. Unknown equity blocks entries. Protective exits still evaluate and require established fresh sellability. Fees reduce the equity denominator in prospective allocation checks. Per-chain concentration is a proxy, not measured correlation.
4. **Prospective strategy evidence:** each new strategy entry records its plan and configuration fingerprint atomically with the fill. Only a full round trip counts as a win/loss; cumulative partial-exit proceeds are included once at final closure. Settings changes create separate experiment groups; legacy/migrated entries remain unversioned. Thirty closed trades and seven observed days request review only. Profit factor remains unestablished when there are no observed losses. At most 32 groups/120 samples per group are retained in memory, with an explicit ungrouped closure count; the append-only source journal remains intact. Current controls, positions and outcomes come before expandable recent logs on the paper stream.
5. **Public shared knowledge fallback:** an optional Builder preview bridge reads only the existing `https://streams.axo.vision/api/project` exact-project API. It verifies schema v2, chain, token, pool and original observation date, and copies only whitelisted public market fields. It imports no safety pass, private memory, user records, credentials or database access. It has two concurrent / six-new-reads-per-minute limits, coalescing, 60 cache entries, two-minute positive and 30-second negative caching, strict no-redirect transport and bounded timeouts. HTTP 402/401/403 remain payment/access gaps; no payment or alternate authentication is attempted. This is a fallback when local exact-pool data is absent/stale, not a mirror of every live database record.

`GET /api/intelligence-runtime` exposes only public queue/bridge capabilities and explicitly reports paper-only execution and no authenticated database access. No new database migration or dependency is required. Paper risk events and experiment aggregates derive from the existing hash-linked journal at `$AXO_RUNTIME_DIR/axo-paper-ledger.jsonl`.

## Audit passes and corrections

The build/audit/fix/recheck passes resolved these material findings:

- Cached OHLCV used to receive a new request timestamp; it now preserves source `receivedAt` and reports `requestedAt` separately.
- Recent partial GoPlus responses could make pending coverage look complete. They remain pending, with a separate incomplete count; admission still requires complete core fields.
- An enabled legacy Luna journal could appear automatic while still requiring a page lease. An explicit operator startup policy can migrate an existing enabled run to background strategies without creating a new run, resuming a paused run or clearing history.
- A busy discovery queue could reject a new held-position check. Lower-priority unstarted work can now be displaced; active work and equal/higher priorities are retained.
- Repeated top-candidate selection could starve deeper projects on one chain. Warm/in-flight candidates are skipped for background breadth.
- Shared reads lacked independent concurrency/admission limits. They are bounded, including negative results and synchronous transport failure recovery.
- Strategy groups could be contaminated by legacy entries, and a restart between fill and plan events could lose entry settings. New fills now contain the immutable plan; legacy migration cannot relabel past entries.
- Entry risk halts could be confused with blocked protective monitoring. Journal integration tests verify a losing-position exit while entries are halted, followed by restart and operator-only re-arm without wiping losses.
- Long old pass logs obscured the new controls. Logs are expandable and current paper controls/outcomes have priority, while deliberate manual ordering stays available.
- The live route check still hardcoded version 0.3.0. It now compares running metadata with the requested package release and catches a required restart.
- Optional bridge misconfiguration or a blocked paper startup migration must not take the broader dashboard down. Those capabilities fail closed and expose their gap while the dashboard remains available.

No further material correctness finding remained in the checked paths after the final focused rerun. This does not mean there are no possible improvements, nor that synthetic tests establish safety or profitability.

## Verification

Run with the repository's Node >=24 and installed lockfile dependencies:

```text
npm run test:decision-system
npm run test:strategies
node work/test-intelligence-pulse.mjs
node work/test-personal-intelligence.mjs
node work/test-release.mjs
```

Browser checks (set `AXO_BROWSER_CHANNEL=chrome` if required): `test-trading-browser.mjs`, `test-pulse-browser.mjs`, `test-reading-layout-browser.mjs`, `test-global-ribbon-browser.mjs`. Coverage includes the new Home navigation/disclosure, editable risk controls, confirmed re-arm, strategy evidence, private position ownership, ten streams in both themes at 1440/390/320 widths, three-second hover dwell, updates around a reserved card and one stable ribbon across streams. Fixtures never sign a wallet or place a real trade. The 10,253-event ledger replay preserves bounded display windows and all-run totals.

Local real-data observations: the public bridge read AXO's exact live pool with its source date; the preview then reported `verified_public_read`. The existing enabled journal upgraded to background `strategies`, retained verified integrity and still reported zero fills/no completed round trips at this checkpoint. No profit was invented. Provider gaps and rate limits remain visible.

## OpenClaw installation and acceptance

1. Pull the published main revision normally; preserve newer concurrent changes. Back up the runtime journal/private data using existing operator procedures. Do not reset the live database, journal, pulse quarantine or user workspaces.
2. Build release metadata from the clean checkout with `npm run build:release`; install lockfile dependencies only if needed. There are no new packages or database migrations in 0.3.6.
3. The optional `AXO_PAPER_ENGINE=strategies` startup policy upgrades **only an existing enabled legacy paper run**. Decide deliberately whether to set it. If a run is paused, use the verified configured operator wallet's existing Start flow when ready; the startup option does not resume it. Existing strategy positions retain their entry plans. A blocked/corrupt journal stays blocked; never delete it to make startup pass.
4. `AXO_SHARED_KNOWLEDGE_ORIGIN=https://streams.axo.vision` is optional on the Builder preview. Leave it unset on that live origin itself to avoid requesting its own API. Private shared knowledge/SQL access remains a separate provisioned service task; do not put database credentials or private payloads in the public bridge or coordination channel.
5. Restart **only `axo-streams`**. Preserve the Codex authenticator, coordination service and other VPS processes. Do not add duplicate workers/cron jobs.
6. Check `/api/release` reports 0.3.6 and the installed commit, every referenced script (including `/action-desk.js`) returns JavaScript, `/api/intelligence-runtime` returns bounded queue status, and `/api/paper/status` reports the actual selected engine, risk marks, evaluation and verified ledger. A paused engine must remain paused.
7. Confirm Home's action list updates from dated evidence, Watchlist relevance remains private, Show all restores context, reading locks still require three seconds of hover, and stream changes preserve the shared ribbon. Verify contract gaps remain pending and default admission does not equate checks with safety.
8. Inspect configured paper risk limits and daily outcomes. Any risk re-arm must require the configured verified operator, an explicit confirmation and fresh complete positive virtual equity; the journal and prior losses must remain. Do not arm real-money automation.
9. Leave the engine collecting genuine prospective observations. Do not lower evidence gates just to produce fills. Current automatic entry coverage requires valid closed hourly history and an established exact-pool provider buy/sell simulation; unsupported routes/chains remain research-only. Review gas, MEV, executable depth, tax changes and independent forward performance before considering a separate live-execution project.
10. Return the installed commit and acceptance results through the existing signed coordination protocol. Message receipt is not installation. Requests for broader shared knowledge should receive a reviewed public capability/schema response; private records, SQL, credentials, wallet details and arbitrary commands must not cross this channel.

Rollback: first pause the shared paper engine with the verified configured operator and remove the optional startup-migration flag. Deploy the preceding reviewed version, rebuild metadata and restart only `axo-streams`. Older versions do not enforce these new portfolio halts, so keep the paper engine paused until reviewed. Preserve all journal events and database/private/pulse state; do not roll back by deleting evidence.

## Remaining evidence and integration work

- Live private database/shared user-memory access is still not provisioned for Builder. Only the bounded public fallback has been verified here.
- No new completed forward strategy history exists yet; daily profit and scalable positive expectancy remain unestablished. Stops are observed signals, not guaranteed stop-price execution.
- Real-wallet acceptance and live deployment remain OpenClaw/operator tasks. This release never signs or transfers funds.
- Existing no-Alchemy policy remains. Moralis is deferred until at least $250/month platform revenue; no paid data source or TokenSniffer integration was added.
