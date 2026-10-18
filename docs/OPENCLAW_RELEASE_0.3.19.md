# OpenClaw release 0.3.19 — reward basket recovery

Prepared 2026-10-18. Extends 0.3.18. No migration, new dependency, API key or fee service. Preserve native reward contracts, selector/controller state, existing private configuration and all earlier database and paper-journal requirements.

## Dashboard repair

The holder reward education card was receiving no reward data. The ecosystem adapter recognized only the old `HTTP 403` error string, whereas the shared fetcher now emits `Public source HTTP 403`, or a cached retry error. Its existing ordinary public Rewards-page reader was therefore never used by this path.

The shared fetcher now preserves HTTP classification in cached failures. The ecosystem adapter records that classification, recognizes both legacy error formats, and invokes its existing bounded unauthenticated public-page read only for the relevant 403 responses. Browser failures remain unavailable sources, not failed whole snapshots. Captures with future/expired fetch times or a mismatched token are rejected. HTTP 429 does not trigger a browser retry. No cookies, headers, wallet credentials, login or gated machine endpoint are copied or bypassed. The reader uses the existing Windows browser default and bundled Chromium by default on other platforms.

The card no longer depends on unrelated access-policy metadata. It adds explicit partial/outage feedback, a manual refresh control with keyboard focus preservation, and expansion for all historical distributed assets. Its public freshness window matches the existing fifteen-minute AXO snapshot policy; original observation dates remain visible. A stale or dated selector cannot become a current basket, and tracker registrations/distributions never substitute for selected reward assets. Personal payments remain unverified; no claim, selector update, trade or fund movement is dispatched.

## Outstanding upstream repair — OpenClaw operator

Builder's ordinary public page read confirmed that `https://www.axo.vision/api/rewards/catalog` was returning `status: STALE`, `error: fetch failed`, an empty selected-asset list and unknown distribution mode. The overview's embedded catalog showed the same failure. The overview still returned the six registered tracker assets and accounting, holding threshold, eligible-holder count and hook/reward fees. Those are useful separate facts, not evidence of the current basket.

**Repair the native AXO site's Based.bid catalog read in its owning deployment.** Check the upstream request/route, DNS/TLS/egress, timeouts and cache behavior as the existing runtime user. Verify the current exact Robinhood AXO token and current selected reward contracts against the native catalog/contract authority. Do not copy an old fixture's AAPL selection, infer the basket from the six tracker registrations, manually overwrite reward state, change controller execution policy, or relabel a failed cached response as live. Builder has not changed or deployed that separate website backend.

Acceptance for the upstream repair: the native catalog returns a genuinely live, dated exact-token selection and supported distribution configuration; the dashboard's normalized catalog becomes available and the card's Current selection matches it. Until then the card deliberately displays **Not currently verified** and explains the source gap.

## Deployment and verification

1. Pull the published main revision without overwriting newer integration changes. Rebuild release metadata, restart `axo-streams` and confirm version 0.3.19 and the installed commit. No new SQL is needed.
2. Preserve the public-page browser runtime already used by the public AXO header. Linux uses Playwright's installed Chromium unless `AXO_BROWSER_CHANNEL` is explicitly set. Missing browser support must remain a source gap; do not weaken native access controls or TLS verification.
3. Check `/api/axo-ecosystem`: public-page-delivered status/overview/catalog should retain their individual state and observation dates. Check the holder reward card on desktop and phone: exact token amounts, all six historical assets, fees, explicit selection gap, refresh and dismiss behavior.
4. Complete the separate native selector repair above and verify recovery in the dashboard. Preserve the distinction between selected assets, registered tracker assets, lifetime accounting and verified holder payments.
5. Return installed revision and acceptance results through coordination. Message receipt is not deployment or proof that the native selector is repaired.

`npm run test:reward-basket` covers structured/legacy/cached 403 recovery, read coalescing, token/time validation, failed captures, rate-limit preservation, current versus historical data, and card interaction across light/dark desktop/390/320 layouts. Existing ecosystem normalization, public-header, shared queue/cache and volume-source regressions also pass. The ecosystem fixture test now distinguishes its dated catalog from a current selection. A live preview read and phone rendering recovered all six tracker totals, threshold and fees, while correctly leaving current selection unknown.

The older broad `test-holder-browser.mjs` stops before its reward section on pre-existing holder-panel copy/header-label expectations. It is not counted as a passing regression for this release. The focused reward browser suite independently covers reward rendering, policy-service independence, precision, six-asset expansion, keyboard refresh, outage/recovery and dismissal races; production wallet/auth UI is unchanged.

Rollback: revert application code and restart while preserving all state. This does not reverse or alter native distributions, and it will reintroduce the broken source fallback. Prefer a forward correction for any upstream schema change.
