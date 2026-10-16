# OpenClaw release 0.3.13 — interactive trading activity

Built: 2026-10-16. Extends 0.3.12. No database migration, dependency, credential, new provider, paid API, model-call path or live-money execution change.

## User outcome

Home and chain Trading activity now share a linked **Trading volume explorer**. Select a chain to inspect its filtered, current core-screened project sample with logos, exact project navigation, pool liquidity and one-hour price movement. Switch to Daily history to inspect seven completed UTC days. Home's action card has **Compare chain activity**, which reveals the explorer and focuses its heading below the fixed Radar. The focused Home card budget, pins and other sections remain available.

The explorer compares rolling 24-hour USD trading volume or its absolute change from the preceding window, with a centered zero line for positive/negative changes. Change mode orders by absolute change. A Completed day mode uses the exact preceding UTC calendar day and the exact day before it, never an older or incomplete replacement day. Shares use only current reported chains; share changes use the same cohort and require every included chain's prior baseline. Missing sources and dates remain visible. A stale large value cannot dominate the bars or denominator.

Project **Volume & transactions** cards now compare disjoint recent intervals: 0–5m, 5–60m, 1–6h and 6–24h. Select USD/minute, USD totals or trade events/minute, and focus/select a band for its measurement and duration. Recent volume pace compares 5m against the preceding 55m. These bands are arithmetic differences between nested totals in one exact-pool snapshot; they are not candle bars. Original overlapping rolling totals remain available in a collapsed detail section; existing window controls, buy/sell counts, genuine closed-hour history and exact source links are preserved.

## Measurement and interpretation

- **Volume is turnover, not net capital inflow.** Share growth is not evidence that capital migrated from another chain. No source-to-destination bridge dataset is connected, so this release does not draw a Sankey diagram or invent transfers. TVL and stablecoin supply remain separate measurements. These distinctions follow [DefiLlama's data definitions](https://defillama.com/data-definitions).
- Chain totals describe the provider's wider DEX coverage, including native/stable trading. Suggested projects retain existing stable/native exclusions and must have current core contract checks for this shortlist. Core checks are not a guarantee of safety. Token volume is the most liquid sampled pool, not all pools combined. Largest-token concentration is only within that filtered sample; it is not a share of the chain total or whole-market coverage.
- Exact-pool rolling fields follow the [DEX Screener pair response](https://docs.dexscreener.com/api/reference). Unequal-duration rolling totals must not be added together or treated as successive candles. Event counts are not USD buying pressure or unique traders.
- The views reuse cached sources and normal refresh. No chart-specific HTTP or Luna calls are added. The newest valid existing dashboard/chain-cache source wins; an invalid future clock or older cache cannot replace valid evidence. A dated parent chain response cannot make its nested source current.
- The current source window is at most 15 minutes for chain aggregates, matching the existing aggregate freshness policy. Pool comparisons retain the existing provider-specific 3-minute/15-minute observation limits. Fetch time is labelled as fetch time; provider rolling-window end times are not established. Dated history may remain inspectable with its original date while excluded from current rankings.
- Missing, zero, future-dated, conflicting and overflow values are distinct. Missing calendar days remain gaps. Zero baselines do not create infinite growth/pace. Invalid nested totals suppress comparisons rather than manufacturing positive signals.

## Audit corrections

1. Readable chart hierarchy: the selected chain's Projects and Daily history are separate tabs, rather than stacking every panel. At most three project rows are previewed, with sample count and an existing chain-stream link. The larger sample still determines its stated concentration.
2. Exact calendar geometry: seven fixed completed UTC days preserve missing-date gaps and observed zero values. Conflicting duplicate daily buckets are withheld. Focused/selected days retain their readout across renders.
3. Data-source continuity: use a newer valid cached chain source when the dashboard snapshot is older, without mutating either input or initiating another fetch. Same-time live evidence can recover a stale cache; older/future sources cannot displace current evidence.
4. A decreasing buy or sell count could previously hide behind increasing combined transactions. Shared integrity checks now reject that per-side contradiction across nested windows. This propagates through existing Discovery, Radar, observation-history, intelligence-pulse and new paper-entry gates. Independent exit-route observations and existing position exits remain independent. No paper strategy weights, position plans, journals or execution policy were changed.
5. Home discoverability: Compare chain activity explicitly reveals the explorer, focuses its heading and reserves existing overlay space. Legacy chart/trade browser fixtures now reveal charts independently of Home's intentional focused-card budget; chain fixtures use internally consistent windows and explicit synthetic core checks rather than depending on live risk-provider availability.

## Verification

`npm run test:volume-lens` covers current-only denominators, same-cohort share changes, valid source-cache selection, matching UTC dates, missing/zero/conflicting/overflow values, disjoint interval arithmetic and per-minute rates, exact-pool/token deduplication, Home entry/focus, chain selection, period/metric/detail controls, logo samples, exact project clicks, keyboard inspection, retained view state, stale/inconsistent suppression and dark/light layouts at 1440/390/320px. Browser data is synthetic and is not evidence of provider uptime or trading returns.

Regression verification covers shared evidence-integrity gates, technical-strategy/entry and independent exit evidence, immutable cached research, venue metrics, chart geometry and swap-response handling, three-second reading holds, global Radar continuity and modes, Watchlist/project navigation, Discovery controls, independent public-page loading, private ownership gates and the dashboard's 92 script routes. Screenshots are local verification artifacts, not release assets. No real-wallet transaction, model call or paid provider is required by the fixtures.

## OpenClaw installation and acceptance

1. Pull the published main revision, preserving any newer OpenClaw changes, protected keys, private configuration, user workspaces, source caches and paper journals.
2. Run `node work/build-release.mjs` on a clean checkout and restart normally. No migration or environment change. Preserve the existing paper engine's enable/pause state and position plans.
3. Verify `/api/release` reports **0.3.13**, the installed commit and clean state. Verify `/volume-lens-model.js` and `/volume-lens.js` return JavaScript; all 92 dashboard script routes must load.
4. On Home, select Compare chain activity; verify the explorer is revealed and focus stays below the Radar. Compare Volume/Change and Rolling 24h/Completed day. Inspect current coverage, gaps, source dates and selected daily values. A source outage should stay a labelled gap, not a zero-valued replacement or invented flow.
5. Open each available chain's Trading activity view. Confirm the chain cache can supply a more recent valid source, selected chain context is correct, project samples honor current core screening, and logos/project links open exact tokens/pools. Wider chain totals must remain separate from the filtered project sample.
6. Open a project activity card, compare all three interval modes and inspect a band. Check that the derived 5m/prior-55m pace is unavailable when source evidence is dated, inconsistent or has a zero prior baseline. Inspect original rolling totals and actual closed-hour history separately. Verify phone/desktop keyboard/touch use and retained reading holds.
7. Check existing Profile, Portfolio, Credits, wallet and Ask Axo controls. Return the applied revision and acceptance checks through signed coordination. Receipt of an update message does not establish installation. Provider reachability, private shared-knowledge access and real-wallet acceptance remain live deployment checks.

Rollback: restore the previous code revision, rebuild metadata and restart. No schema rollback. Preserve source evidence, private records and paper journals. This round implements and rechecks the identified high-impact improvements; it does not certify every device, eliminate all possible future improvements, establish token safety or prove trading profitability.
