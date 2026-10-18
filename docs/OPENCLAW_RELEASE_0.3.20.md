# AXO 0.3.20 — current reward selection from the exact pool

Release prepared for GitHub publication, 2026-10-18. Extends 0.3.19. No migration, new dependency, account, key, contract write, trade or controller configuration change. Live deployment remains AXO's operator task.

## Current selection repaired

The native public catalog still reports a failed Based.bid fetch and an unavailable/stale selection. Dashboard recovery now reads the actual AXO pool configuration through Robinhood's public RPC when a current native catalog is missing. A fresh live read returned AAPL (`0xaf3d76f1834a1d425780943c99ea8a608f8a93f9`), weight 10000 bps (100%), all-at-once distribution. This is independent current on-chain evidence, not the earlier catalog fixture or the six historically registered tracker assets.

The reader verifies chain 4663, the exact position-manager pool key and its hash against the configured AXO pool, the project token's side, the expected hook and its runtime code hash, the pinned compact-full ABI, a recent block and connected reward swap paths whose weights sum to 10000. Configuration, runtime and symbol reads use the same block. Unknown or changed deployments, stale/future blocks, malformed RPC results, disconnected routes or invalid weights leave selection unverified. Only view calls are available. No wallet or signer is involved. The ABI is pinned from Based.bid's published client; it is not downloaded or executed dynamically.

One shared observation serves callers for fifteen minutes, with in-flight deduplication and bounded failure retries. Dependent batches use request-body-aware caches; a token-supply batch must never be reused as a reward-configuration batch merely because it uses the same RPC URL. A fresh head is fetched when a new on-chain observation is needed, rather than reusing an old head against a pruned public RPC. The original catalog outage remains visible in source evidence alongside the recovered contract selection. Healthy current native catalog data still takes precedence.

The holder reward card shows the recovered selection and its weight, on-chain block and distribution mode. Lifetime tracker accounting and unverified holder payments remain separate.

## OpenClaw transport — AXO operator owns repair

At **2026-10-18T12:07:49.073Z**, this ordinary unsigned diagnostic request returned **HTTP 502 Bad Gateway**:

`GET https://claw.supah.ai/api/coordination/v1/results?correlationId=transport-check`

This is the public result route for the existing `axo-builder-coordination` service, documented as a loopback listener on `127.0.0.1:3457` behind the public proxy. The OpenClaw control website itself remained reachable. A functioning result route should reject an unsigned request with 401; this 502 is a transport/upstream failure, not proof that the Builder identity was rejected. Builder cannot determine whether its cause is the service, its launcher, or proxy routing without VPS access.

The owner confirmed there is no VPS/SSH configuration available to Builder and assigned server repair to AXO separately. Builder did not use, copy, expose or rotate the protected signing key, request/copy `openclaw.json`, send a signed message, change the VPS, or claim restored communication/deployment. The owner subsequently authorized committing and pushing 0.3.20 with this handoff so AXO can deploy it. That publication does not restore the messaging service or authorize use of the signing key. After AXO restores the route, a newly authorized signed ping and matching polled reply can verify the channel; receipt of an update is still distinct from an installed release.

## Validation and AXO deployment request

Focused tests cover exact-pool selection, current block/runtime/layout validation, weights and routes, coalescing/freshness, wrong-chain and malformed evidence, outage recovery and independent RPC cache keys. The reward-card browser checks cover on-chain provenance and mode, all six historical assets, exact amounts, keyboard refresh, stale/outage handling, dismissal races and light/dark desktop/390/320 layouts. All 96 dashboard script routes and private-request gates pass. Shared queue/cache and public-header regressions pass. A live local ecosystem read independently returned the selection and exact block evidence.

AXO: install the published 0.3.20 commit containing this document using the existing deployment process:

1. Fetch `origin/main`, record the full release SHA, and integrate it without overwriting newer integration commits. Preserve existing private configuration, tracker/controller state, enrollment, database and paper journal. There are no new migrations or dependencies in this update.
2. Run `node work/build-release.mjs` in the installed checkout and restart only `axo-streams`. Do not restart the authenticator, change reward contracts/controller settings, or reset coordination enrollment as part of this application release.
3. Check `/api/release` for version `0.3.20` and the exact installed commit. Check `/api/axo-ecosystem`: while the native catalog remains unavailable, `rewards.selectionSource` should be `ROBINHOOD_EXACT_POOL_CONTRACT`, with dated block evidence and the current selected contract/weight and distribution mode. At Builder validation the contract selected AAPL at 100%, all at once; do not hardcode that observation if the actual on-chain selection has since changed.
4. Inspect the holder reward card on desktop and phone. Current selection, weight, block and mode should display independently from historical tracker totals and unverified holder payments. Repeat within fifteen minutes to confirm shared reuse rather than a new per-visitor RPC read.
5. Report the installed full SHA and acceptance results to the owner. The separate coordination HTTP 502 repair remains with AXO; GitHub publication is not proof of service recovery or deployment.

The native AXO website's separate catalog reader still needs its own server-side repair; the dashboard fallback does not change that deployment. If the hook runtime changes, inspect its actual ABI before updating the pinned deployment; never loosen identity checks to force a result.

Rollback is application-only; it does not reverse native distributions or change reward choices.
