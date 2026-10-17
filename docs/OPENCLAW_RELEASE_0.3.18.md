# OpenClaw release 0.3.18 — trading volume recovery

Prepared 2026-10-18. Extends 0.3.17. No migration, new dependency, credential or paid service. Preserve all earlier databases, native Hatchery authorities, private configuration and paper journals.

## Problem and fix

The Trading volume explorer's five chain feeds were showing dated reports. The global DefiLlama DEX catalog had grown to approximately 2.25 MB, exceeding the shared fetcher's 2 MB limit. `loadDex` awaited that catalog first; its size rejection entered the provider-wide failure cooldown, preventing the subsequent chain reads from refreshing.

The exact global catalog endpoint, with both large chart exports disabled, now has a bounded 4 MB JSON allowance. Other source URLs, chart exports and text responses retain the 2 MB cap. Both declared and streamed response sizes are checked. A local size rejection has endpoint backoff without imposing a provider-wide outage; real HTTP 429 limits still apply across the provider. Existing cache coalescing, source timestamps and TLS validation remain in place.

The five chain reads start independently of the optional catalog and verify the returned chain identity before accepting an aggregate. The explorer retains a still-current successful report while it refreshes, with its original fetch time. Previously stale/partial evidence and reports older than the freshness window remain excluded. Loading, unavailable and missing completed-day states have explicit messages instead of appearing as an unexplained empty chart.

## Deployment and acceptance

1. Pull the published main revision while preserving newer OpenClaw integration changes and runtime state. Keep all prior migration requirements; this release adds no SQL.
2. Rebuild release metadata and restart `axo-streams`. Confirm `/api/release` reports 0.3.18 and the installed commit. Restarting also clears the old in-memory failure cooldown. Do not delete durable data or the last-good cache.
3. Inspect `/api/dashboard` and coverage after the normal refresh. The `dex-solana`, `dex-base`, `dex-bsc`, `dex-robinhood` and `dex-arc` sources should each refresh independently when the provider supplies them. A real provider outage must still show unavailable/dated coverage rather than fabricated volume.
4. Open Trading volume explorer. Check Rolling 24h, Completed day, Change, chain selection, Daily history and exact project navigation on desktop and phone widths. Trading turnover is still not net capital flow; project samples remain separate from chain totals and keep the existing risk gates.
5. Return the installed revision and acceptance results through coordination. Message receipt is not installation.

Rollback: revert application code and restart while preserving databases and journals. An older release will again reject an oversized catalog, so prefer a forward fix if source payloads change.

## Verification

Source-recovery tests exercise a catalog above the former 2 MB cap, cached reuse, exact URL/type allowances, both response-size checks, cancellation, isolated endpoint rejection, retained 429 cooldown, all five independent reads and wrong-chain rejection. Model/browser tests cover current/dated denominators, retained values during refresh, explicit outage messages, UTC day gaps, negative changes, exact project navigation, keyboard interaction and light/dark desktop/390/320 layouts. Existing shared-cache, temporal-evidence and paper-entry evidence regressions pass.

A real fetch through the corrected shared cache loaded the global catalog and Base aggregate without a cooldown. After restarting the local preview, all five chain feeds returned current data. A real browser check rendered five share segments and five chain rows, switched to Completed day, and displayed seven daily history buckets without script errors. These checks establish source/UI recovery in Builder's preview, not live VPS installation or investment performance.
