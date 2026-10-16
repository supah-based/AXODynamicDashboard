# OpenClaw release 0.3.15 — five-chain paper execution checks

Built 2026-10-16; extends 0.3.14. Paper only. No live orders, wallet signing, new credentials, paid providers, dependencies or database migration. Keep the paper journal, private configuration and existing position plans.

## Requested changes

- The user explicitly authorized raising the existing paper market-cap ceiling to **$1 trillion** so blue-chip projects can participate. A single append-only `paper-policy-upgrade` event applies this change to existing strategy runs, including paused runs. It preserves every other setting, position, loss and enable/pause state. Its persisted marker prevents future restarts or resets from overriding a later manual reduction. New runs acknowledge the policy when created; historical records are never rewritten.
- `paper-strategy-v6` adds a separately identified **quote-checked paper model** for Solana, Robinhood and Arc. Base and BNB retain the existing exact-pool Honeypot.is simulation requirement. The public provider does not support the other three chains; this release does not pretend otherwise.

## Execution evidence and accounting

The new adapter uses LI.FI public same-chain quotes with a synthetic, non-user recipient and `skipSimulation=true`. It never signs, submits or retains a transaction payload. Quotes do not establish successful execution, wallet eligibility, actual token taxes, or execution through the pool supplying the analytical price. That distinction is present in the API, journal and opportunity view.

An entry requires fresh exact-token buy and reverse-sell quotes: the reverse quote spends the first quote's minimum output. Validate network, token identities, decimals, exact amount, recipient, minimum output, slippage, included steps, fees and gas. The counter asset comes from the existing canonical registry: USDC on Solana/Arc and USDG on Robinhood, with a freshly observed near-dollar price rather than an assumed peg. Missing, stale, inconsistent, oversized, costly or unavailable routes block a fill. Existing contract screening, sixty genuine closed hourly bars, entry signals, market integrity and portfolio limits remain required.

Quoted entries have a **$100 paper notional ceiling**. Their conservative model charges a **2% adverse route cost per leg**, plus the existing configured fee/slippage. Both observed leg costs, including quoted gas and fees outside the minimum output, must fit within that model. Included fees are not counted twice. Rounded fee displays are cross-checked against raw token amounts when priced. Taxes remain explicitly unknown; the haircut is not labeled a measured tax.

After sizing, the engine requests fresh quotes for the actual paper amount, then rechecks current screening and entry eligibility before appending the fill. The deterministic fill validator independently verifies amount, age, cost model and the $100 cap. Market observations and portfolio marks are read again after the request: changed price/context invalidates the pending fill, and changed equity cannot reuse a quote for a different size. This applies to entries and exits, avoiding artificial profits from outdated prices. Pause/reset/reconfiguration during the request cannot produce a late fill. The accepted plan records the execution kind; v6 results remain separate from earlier configurations.

Exits use a fresh quote for the actual held amount being sold. They do not depend on a reverse buy quote or a cached candidate-entry setup. Appreciated positions may be sold above $100. Token amounts must fit the chain's integer bounds; fills that would change cent-level accounting through unsupported token precision are rejected. A sell cannot credit unquoted fractional units. Failed sales stay unresolved and visible. A quoted minimum is only a model input; future sellability, gas changes, MEV, account restrictions and actual transaction success are not guaranteed.

## Scheduling and interface

- Quotes expire after at most 30 seconds; source-cache stale fallbacks cannot authorize entries. Amount, side, market reference and token identity are part of the cache key.
- Requests are coalesced, concurrency bounded and rate limits respected. Failed route evidence remains visible for a short retry interval instead of immediately disappearing or repeatedly hitting the provider.
- Paper research can wait up to 30 seconds for a queued route-backed setup; interactive requests keep their short wait. This prevents the one-minute paper cadence from continually missing a short-lived quote. Existing position monitoring runs before new-candidate work. Market observations are refreshed after waits.
- All five chains now have a declared paper execution path in the opportunity map. Provider simulation and quote-model coverage are separately labeled; adapter support is not a claim that every token has a route or is safe.

## Research and verification

Primary references: [Honeypot supported chains](https://docs.honeypot.is/chains), [LI.FI quote API](https://docs.li.fi/li.fi-api/li.fi-api/requesting-a-quote), [GoPlus supported DEX coverage](https://docs.gopluslabs.io/reference/supported-dex). These establish service capabilities, not investment performance.

`npm run test:paper-five-chains` covers all three quote adapters, strict identity/amount/freshness/cost rejection, source failures and rate limits, independent policy validation, all five paper entry/exit paths, risk changes during requests, pause/reconfiguration races, exits independent of buy availability, and one-time policy migration using temporary hash-chained journals. Existing strategy, sizing, accounting, risk, research, evidence and desktop/mobile opportunity checks also pass. Synthetic tests do not prove live profitability or transaction execution.

Harmless public probes on 2026-10-16 returned both directions for Solana TRUMP (11:30 UTC; modeled observed costs 1.25% buy / 0.738% sell), Robinhood PONS (11:28 UTC; 0.64% / 0.915%) and Arc EURC (11:28 UTC; 0.85% / 0.686%). The Arc stablecoin sample establishes quote connectivity only; it is not eligible project selection or an exact-pool screening test. Solana ZEREBRO price disagreement and a subsequent provider 404 were rejected. These dated observations have expired and cannot authorize a later fill; they do not establish strategy readiness, profits or a real transaction.

## Deployment and acceptance

1. Pull published main without overwriting newer OpenClaw work. Preserve the entire append-only paper ledger and private runtime configuration. No reset or SQL migration.
2. Build release metadata from the clean checkout and restart the service. Retain the existing explicit `AXO_PAPER_ENGINE=strategies` startup policy. This applies the one-time ceiling migration and upgrades an already-enabled strategy run to v6. Paused runs stay paused.
3. Confirm `/api/release` reports 0.3.15 and the installed commit. Confirm `/api/paper/status` reports paper-only, no real funds, verified journal integrity, fifteen opportunity cells and five declared execution paths. Existing migrated strategy runs should have `maxMarketCap: 1000000000000`. Check the journal's policy event and preserved positions; do not overwrite later operator changes.
4. Confirm candidate rows distinguish quoted token routes from pool simulations. Test one real public quote per new chain without wallet or transaction submission; token routing is provider-dependent. Missing or too-expensive routes must remain blocked.
5. Inspect prospective entries: actual-size proof, execution kind, modeled costs and original exit plan must be retained. Test restart continuity using existing acceptance procedures. Confirm failed exits remain open, and no missing response produces a fill.
6. Return installed revision and acceptance evidence through signed coordination. Message receipt alone does not establish deployment.

Rollback: pause paper first and retain the journal. Older versions cannot interpret the new quote evidence or policy marker correctly and may lack compatible limits. Prefer a forward fix; keep the engine paused until position/configuration compatibility is reviewed. Never erase outcomes to improve displayed performance.
