# OpenClaw release 0.3.14 — evidence-weighted paper opportunities

Built 2026-10-16. Extends 0.3.13. Paper only: no live orders, wallet signing, new credential, paid provider, dependency or database migration. Preserve existing private configuration, protected coordination keys, source caches, wallet access and journals.

## What users get

Paper Trader now has a **Paper opportunity map**: a five-chain by three-category coverage matrix, chain/category filters, project logos, exact project screening links, dated entry blockers and the proposed allocation. The score is **evidence conviction**, not a calibrated probability of profit. Inspecting the card only reads the existing status response; it does not execute a trade, initiate model work or duplicate market requests.

The universe is Solana, Base, BNB, Robinhood and Arc. Current exact-contract top-100 listings with circulating market cap at least $1B qualify for the blue-chip category. A source-reported token/project genesis older than seven days qualifies for swing. A source-reported exact pool at most seven days old qualifies for degen; pool age does not prove the token launch date. Missing age/listing evidence stays unclassified. Native, stable and wrapped chain assets remain excluded. Current risk checks and execution evidence remain separate requirements.

Fresh chain, launchpad and retained Discovery records now feed the same paper/research universe and exact-project lookup. The newest exact-pool snapshot wins atomically; an incomplete newer snapshot cannot revive older market values. Separately dated exact-token listing/genesis facts may accompany it. Conflicting genesis dates clear the age classification. Equal-time integrity, curve and provider-conflict evidence cannot disappear through the sanitized Discovery cache. A retained position excludes the token from new entries across all its pools.

Research allocation rotates through chain/category cells before allocating extra work to one cell. Existing held positions retain priority. The existing bounded blue-chip provider collector refreshes every five minutes while autonomous paper is enabled, matching the entry-market freshness window and reusing source caches. Its first-eight-coin/eight-pool lookup bound remains; this is not whole-market coverage.

## New paper policy: `paper-strategy-v5`

1. Rank candidates that have current exact-pool market data, core risk screening, observed buy/sell simulation, and genuine closed-hour technical evidence. Relative evidence strength includes depth, current extension, volatility, RSI balance and closed-bar volume acceleration. Observed venue activity contributes at most five points. Popularity never bypasses risk or execution gates.
2. Derive a stop distance from the larger of configured stop percentage and twice hourly ATR percentage. Stops wider than 25% block a new entry. Initial maximum modeled stop risk defaults to 50bps of account equity (operator range 5–100bps), then receives bounded evidence, category and prospective-cohort multipliers. This is a loss-budget heuristic, not Kelly sizing or expected profit.
3. Clamp notional against cash reserve, existing 10% position ceiling, 1% pool participation, gross exposure, chain exposure and category exposure (15% degen; 30% swing/blue chip). Unknown-category legacy exposure consumes each prospective category budget conservatively. A zero-capacity candidate cannot prevent a feasible candidate on another chain from being considered.
4. Include both fees, adverse slippage and observed taxes in entry-to-stop and entry-to-first-target arithmetic. Integer fee ceilings and sale-proceeds floors are checked explicitly. The first target must cover modeled costs. Gap risk, failed sales, gas, MEV, order-size price impact and future route availability remain unmodeled; the planned stop loss is not a guaranteed loss cap.
5. Freeze the entry's category, selected strategy, conviction, sizing, source dates, policy fingerprint and execution assumptions into the accepted journal fill. New plans anchor stop/target signals to the observed market entry price; effective tax/slippage fill cost stays in accounting. Existing plans retain their original semantics and are never rewritten on reconfiguration. Subsequent exit fees/slippage use that entry plan; exit taxes still require current evidence.
6. Keep stop/trailing/staged exits and add immutable maximum holding horizons: 24h degen, 120h swing and 336h blue chip. Time limits are current-observation signals, not exchange orders. Failed or missing exit evidence leaves an unresolved position. Stops/monitoring remain first in the cycle, including when research is busy or entry limits halt trading. Full portfolios may exit a deteriorating position before reconsidering a new opportunity later.

New configurations allow a maximum market-cap ceiling up to $1T, so the old $100M validator ceiling no longer makes blue-chip entries impossible. **Existing enabled runs preserve their chosen ceiling**, commonly $25M. Installing this release does not silently widen it. The configured operator can review and explicitly change that ceiling through Configure autonomous paper if blue-chip participation is intended. Other hard risk limits remain intact. Paused runs are not armed; startup upgrades an existing enabled run only under the existing explicit `AXO_PAPER_ENGINE=strategies` policy.

## Bounded prospective adaptation

Completed outcomes are grouped by immutable configuration × chain × category × selected strategy. Partial profit-taking counts once at final closure; cumulative modeled extra cost of 50bps on each fill is tracked through partial exits and replay. Older trades without the new metadata/stress record remain unclassified/unknown.

Each cohort uses at most its latest 20 completed outcomes known at decision time. A predeclared checkpoint requires at least 12 full round trips, seven days between observed entry/exit dates, and five distinct tokens. Before that, the multiplier is 0.5 of category/evidence baseline. Nonpositive recent net results reduce it to 0.25; unknown/nonpositive cost-stressed returns retain 0.5. Positive modeled and cost-stressed outcomes may restore 1.0, but unresolved losing/unpriced positions or failed exits cap restoration, and a pending exit limits it to 0.25. A failed exit needs a later completed outcome, not just elapsed time. Repeated scans cannot manufacture samples.

This heuristic cannot exceed the configured baseline, increase risk ceilings, change strategy code, enable live execution, or claim statistical proof. Open outcomes, missing marks and failed exits are visible beside closed results. Correlated tokens and selective closures can still bias results. No backtested returns, synthetic test wins or advertised competitor performance are presented as Axo profitability. New evidence must accumulate in the prospective journal.

## Current coverage limits

- The installed exact-pool simulation adapter supports Base and BNB within this five-chain universe. **Solana, Robinhood and Arc remain blocked for new paper entries by missing supported simulation evidence.** They are scanned and shown as coverage gaps; GoPlus flags, an aggregator quote or a public screenshot are not relabeled as a successful buy/sell simulation. Legacy Ethereum positions retain quote/exit continuity but Ethereum is not added to the new five-chain opportunity selection.
- Sixty genuine closed hourly bars remain mandatory. The first 60 hours of a new pool cannot qualify under this policy. No fabricated warmup or undocumented first-minute strategy was added.
- Many tokens do not expose a trustworthy token-genesis date or exact ranked contract mapping. Unknown classification is a coverage limitation, not evidence that a token is poor or safe.
- Paper results do not prove daily profitability or live scalability. No user-size execution, gas/MEV or real-wallet acceptance is established by this release.

## Research basis

We used documented engineering practices, not claims that example bots are profitable:

- [QuantConnect Algorithm Framework](https://www.quantconnect.com/docs/v2/writing-algorithms/algorithm-framework/overview): separate universe selection, signals, portfolio targets, risk and execution. This informed category coverage and independent sizing/validation boundaries.
- [Hummingbot PositionExecutor](https://hummingbot.org/strategies/v2-strategies/executors/positionexecutor/): stop, profit and time barriers informed the new fixed holding horizons. Axo evaluates paper signals; it does not use Hummingbot execution or imply equivalent fills.
- [Freqtrade backtesting assumptions](https://www.freqtrade.io/en/stable/backtesting/#assumptions-made-by-backtesting), [lookahead analysis](https://www.freqtrade.io/en/stable/lookahead-analysis/) and [protections](https://www.freqtrade.io/en/stable/plugins/#protections): preserve closed-time evidence, costs, unresolved outcomes and loss controls; forward observations matter because simulated fills make assumptions.
- [Walk-forward optimization](https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/walk-forward-optimization) and [Bailey/López de Prado's original deflated-Sharpe paper](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf): repeated selection of attractive past results can overfit. We implemented bounded prospective exposure feedback, not an unrestricted optimizer or a fabricated Sharpe significance calculation.

## Tests and audit corrections

`npm run test:paper-opportunities` covers category boundaries, all 15 cells, exact source identity and clocks, atomic quote merging, fair research, evidence-score sizing, volatility, cost rejection, all exposure capacities, cent rounding, same-token alternate-pool rejection, feasible second-chain selection, frozen entry plans, time exits, full-portfolio rotation, pause during pending research, cohort evaluation, missing/future/overflow evidence and unresolved-outcome guards. All fixtures are synthetic; no real paper journal or funds are reset by the tests.

`npm run test:paper-opportunity-browser` covers matrix selection, filters, project logos, unknown versus zero, dated gaps, exact navigation across reordered status data, existing reading holds, retained filters and dark/light desktop/390px/320px layouts. Existing strategy, paper accounting/replay, risk, research, project-data, volume, Watchlist and route checks remain required.

Independent review corrected tax-inflated false stops, mutable exit-cost assumptions, full-capacity rotation starvation, rounded small-position losses, category-cache revocation, sanitized-cache risk-marker loss, double-rotated research scheduling, missing waiting counts and legacy unclassified exposure. The identified actionable findings were fixed and rechecked. This is a completed bounded improvement round, not a claim that no further improvements can ever be found.

## Installation and acceptance

1. Pull the published main revision without overwriting newer OpenClaw work. Preserve the append-only `axo-paper-ledger.jsonl`, private records and all existing protected configuration. No migration or journal reset.
2. Run `node work/build-release.mjs` on the clean checkout and restart normally. Preserve the existing enable/pause state. Verify `/api/release` reports **0.3.14**, the installed commit and clean state. All 93 script routes, including `/paper-opportunities.js`, must load.
3. Verify `/api/paper/status` reports `mode: paper-only`, `realFunds: false`, `walletConnected: false`, verified ledger integrity, 15 coverage cells and explicit execution coverage. Existing enabled strategy runs should show `paper-strategy-v5`; paused/legacy runs remain governed by existing operator controls.
4. Review the operator's current market-cap/risk settings. Existing ceilings below $1B still exclude blue chips. Do not override configured limits or claim five-chain entry coverage merely to obtain trades.
5. Inspect an accepted new paper fill: opportunity metadata and immutable stop/time/fee assumptions must be in its plan. Restart and verify position quantity, proceeds, remaining tranches, high water, cohort results and risk state survive. Do not reset history to make performance look better.
6. Verify missing data yields waiting/blocked reasons, no entry or fake fill. Verify open-position monitoring remains active with no browser or available Luna slot. Observe actual provider availability separately from synthetic regression success.
7. Confirm matrix/filter interaction and exact project links on desktop/mobile. Monitor prospective closed/open/loss/failed-exit/cost-stress results before drawing conclusions. Return installed revision and acceptance evidence through signed coordination; message receipt alone is not deployment.

Rollback requires operator review: pause paper first and retain the journal. A pre-v5 binary does not enforce the new category/time/adaptation policy and may reject a newly widened market-cap configuration. Prefer a forward fix; if reverting, keep the paper engine paused until existing positions/configuration are reviewed for compatibility. Never delete the journal or claim the old binary preserves all new behavior.
