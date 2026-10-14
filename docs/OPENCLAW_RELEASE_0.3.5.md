# AXO 0.3.5 — evidence first, continuous intelligence

Date: 2026-10-14. Extends 363a96f and the 0.3.0 handoff. Preserve all existing wallet, Hatchery, credits, database, radio-retirement and voice boundaries.

## User-visible outcome

- **Intelligence pulse:** a compact, logo-led chronological card adds first observations, changes in contract flags, material liquidity declines and rising rolling hourly volume. Earlier findings remain available instead of being replaced by the latest snapshot. Each entry has dated context, market cap, liquidity, volume and an exact-project screening action. It appears in Home, chain, Discovery, project and Changes streams.
- **Evidence-first suggestions:** the global ribbon and default project suggestions require current core GoPlus checks, with no positive flags. A single negative flag no longer counts as complete screening. Users can explicitly enable **Review unchecked**. Severe flags remain excluded from suggestions; saved/held projects and explicit research remain inspectable with warnings. A screen is not a declaration of safety.
- **Decision brief:** project cards separate contract-check state from entry timing and explain their existing activity/personal relevance. Entry timing uses already collected exact-pool setups, with no extra model calls.
- **Stable reading:** mouse hover locks only after three continuous seconds on the same card. Leaving resets the timer. Focus, text selection, deliberate touch and expanded inspection retain their prior behavior. Other cards continue updating around a held card.
- **Direct links:** DEXScreener uses the exact chain/pool, including `pool` references and 64-hex pool identifiers. Matcha uses `/swap/<chain>/<token>`; AXO `bsc` maps to Matcha `bnb`. Supports Ethereum, Base, BNB, Solana, Robinhood and Arc. Invalid identities produce unavailable text, never homepage links. These are navigation links; they do not execute a trade or guarantee a route.

## Shared collector and operating limits

`work/axo-intelligence-pulse.mjs` is one server collector, independent of an open browser and of Luna. It reads existing public chain/launchpad caches only. It does not add paid feeds, request user wallets, inspect private workspaces or execute orders.

Every five seconds it selects due screening work from a maximum of 120 fresh projects, retaining chain coverage and prioritizing young/active projects within each chain. GoPlus retains its shared maximum of 20 HTTP requests/minute and two concurrent requests. EVM batches contain at most eight exact contracts; Solana remains single-token requests. If an EVM response omits contracts, bounded single-token fallback checks run, and batching backs off for ten minutes. Missing results remain unknown. Available evidence caches for five minutes; unavailable single responses for thirty seconds. Timing is best effort within provider capacity, not an all-chain screening SLA.

On the live public GoPlus probe, a two-contract Base batch returned only one contract with HTTP 200/OK. The new fallback retrieved evidence for both. This is why a successful batch HTTP status cannot imply complete token coverage.

Core fields: EVM honeypot, cannot-sell-all and owner-change-balance; Solana non-transferable, mint and freeze authorities. Coverage and unknowns remain visible. Other positive flags also prevent default admission. Neither launchpad provenance nor a green check proves liquidity locks, future owner behavior, beneficial wallet ownership, executable depth or safe investment.

`$AXO_RUNTIME_DIR/axo-intelligence-pulse.json` stores public events and severe-flag quarantine. No new database migration is required. Existing PostgreSQL project/evidence authorities are unchanged. The rolling UI log is not a replacement for that database. Limits: 240 retained events, 120 delivered events, 500 discovery dedupe references, 1,000 severe identities, 4 MiB load limit. First observations do not repeat across ordinary restarts within retained history. Severe evidence survives cache eviction/provider failure until a newer exact response explicitly reports each prior severe field again. Corrupt or full quarantine storage blocks new screened admission pending operator review; do not delete it to make the dashboard look healthy.

Only material state changes publish additional SSE refreshes. There is no per-listener collector. Liquidity falls are observations of USD pool value, not proof of withdrawal/rug. Changes between overlapping rolling-volume snapshots are explicitly labelled and are not the candle-volume acceleration used by the technical engine.

## Trader audit fixes

1. Partial risk evidence can no longer pass the automatic paper-entry gate.
2. Cached technical setups consume the current shared risk record immediately. A newly reported severe flag cannot wait for the two-minute technical cache to expire; unavailable risk history cannot inherit an earlier pass.
3. Entry risk rules no longer block a protective simulated exit solely because a warning appeared. Exits still require a current, successful exact-pool sell simulation, valid taxes and a finite non-future setup timestamp; failed sellability creates no fictional fill.
4. All prior cost-aware accounting, stop/tranche state, operator authorization and no-model-required monitoring remain intact. Live-money automation remains disconnected. No profitability claim is made from synthetic checks.

## Audit and verification

The review found and corrected incomplete-check admission, browser-dependent screening, negative-cache delay, partial batch responses, cached-risk lag, warning-blocked paper exits, repeated snapshot alerts, restart discovery duplication and immediate passing-card capture. Checks exercise adverse data and failures, not only successful rendering.

Run with Node 24+ and installed dependencies:

```sh
npm run test:pulse
AXO_BROWSER_CHANNEL=chrome npm run test:pulse-browser
AXO_BROWSER_CHANNEL=chrome npm run test:reading-layout
AXO_BROWSER_CHANNEL=chrome npm run test:public-ribbon
AXO_BROWSER_CHANNEL=chrome npm run test:strategies-browser
node work/test-trading-strategies.mjs
node work/test-axo-score.mjs
node work/test-risk-chart-browser.mjs
node work/test-release.mjs
git diff --check
```

Browser fixtures cover both themes, 1440/390/320 widths, exact project links, additive history, shared risk hydration, immediate severe exclusion, pointer dwell/reset, focus/touch/selection, unchanged ribbon navigation and paper/private-position controls. They do not connect a wallet, approve funds or establish profitable live execution. Screenshots under `outputs/axo-pulse-*-fixture.png` are labelled synthetic fixtures and are not live performance evidence.

## Installation, acceptance and rollback

1. Pull the final published main commit; preserve concurrent OpenClaw changes, durable runtime and existing PostgreSQL state. Never force-push or reset user data.
2. Install the existing lockfile dependencies if needed and run `npm run build:release` from a clean checkout so the subtle header version identifies the deployed commit.
3. Restart **only `axo-streams`**. Do not restart `axo-streams-codex`, the coordination service or unrelated systems. Do not add a second collector/cron process.
4. Verify `/api/dashboard` includes `intelligence` with `scope: public-ecosystem`, a current `lastCycleAt`, screening counts, bounded public items/events, and the shared ribbon. Confirm `/pulse.css`, `/pulse-ui.js` and `/project-links.js` return successful asset responses rather than HTML/errors. Collector starting/partial/unknown states must remain visible.
5. Verify default suggestions omit unknown/flagged evidence, Review unchecked is explicit, Watchlist/Portfolio still retain known tokens, and severe flags survive a provider outage. Check private fields are absent from the public pulse.
6. Hover for less than three seconds: no reading halo/lock. Stay on the same card for three seconds: thin lime hold cue. Move away: release and pending layout reconciliation. Verify both touch and keyboard access.
7. Inspect a real project’s DEXScreener pool link and Matcha swap destination without approving a transaction. Matcha’s selected buy token/chain must match the card. Missing liquidity is not a successful quote.
8. Leave the paper engine’s existing operator-controlled state intact. Confirm new entries require current shared screening and protective exits continue evaluating independently. Do not arm live execution.
9. Record installed commit and acceptance results in the signed coordination result. Message acceptance means durable receipt only, not installation.

Rollback: deploy the preceding reviewed commit and rebuild release metadata; restart only `axo-streams`. Preserve pulse quarantine/events and all existing ledger/private/database files. Older code ignoring the new pulse file is preferable to erasing evidence. Restore the preceding admission behavior only with operator awareness that it admits unknown risk states.

## Product/competitive design review

DEXScreener already combines fast market tables and attention/trending information; Nansen combines token intelligence, wallet flows and agent-facing tools. AXO should compete through a coherent **observation → evidence → action** loop and its Hatchery/community context, rather than claiming more coverage, safer tokens or guaranteed alpha. This release makes attention separate from risk and timing, reduces rereading through a dated log, and keeps agent work inspectable. Existing community weighting remains capped and cannot override risk evidence. Paid wallet-label feeds and unverified influencer identities have not been added.

Primary references checked for this review:

- [DEXScreener trending methodology](https://docs.dexscreener.com/trending)
- [Nansen Token God Mode API](https://docs.nansen.ai/api/token-god-mode)
- [Nansen agent/data integration overview](https://nansen.ai/api)
- [GoPlus token security response definitions](https://docs.gopluslabs.io/reference/response-details)
- [GoPlus official multiple-address API specification](https://github.com/GoPlusLabs/OpenAPI/blob/main/SecurityAPI.md)
- [W3C accessible status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [Matcha direct swap route, Base USDC](https://matcha.xyz/swap/base/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913), verified in the actual rendered app; equivalent Solana, BNB, Robinhood AXO and Arc routes were also inspected without wallet connection.
