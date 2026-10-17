# OpenClaw release 0.3.17 — inline Hatchery heat calls

Prepared 2026-10-18. Extends 0.3.16. No new SQL migration, dependency, API key or environment secret. Keep migration 007 and all earlier records, workspaces, Pet/XP authorities, private configuration and paper journals.

## User behavior

The Hatchery current-project queue now contains an inline 0–10 cold-to-hot heat bar instead of **Corroborate in Hatchery**. The same bar is available in the existing community-contract detail view. Aggregate community heat and fidelity remain separate from the user's own heat call; neither establishes safety. Choosing a score is an explicit submission, never a default or an action on hover.

After the existing Reown ownership verification, **Connect Hatchery** requests a separate native `axo.pet` ownership signature. It cannot spend funds. This connection uses the user's existing Pet and passport. It does not create another Pet, award synthetic XP or bypass current AXO corroboration. The native Hatchery API remains the authority for passport, task/window availability, duplicate votes, receipts and XP. New/unhatched users can connect but cannot vote until their native setup is complete. The Pet/passport link remains only for onboarding; heat calls are submitted inline.

## Integration and privacy

`axo-hatchery-heat.mjs` implements a bounded first-party adapter to the fixed HTTPS `https://axo.pet` API. It obtains the native wallet challenge and checks its exact domain, URI, chain 4663, statement, address, nonce and expiry before returning it. It independently verifies the returned signature before forwarding it to native wallet verification. A caller cannot supply a task ID, wallet identity, native cookie, arbitrary upstream URL or verdict/confidence payload. The adapter chooses the current task from a fresh authenticated Hatchery read and derives verdict/confidence using Hatchery's 0–10 mapping.

Native cookies stay in server memory, scoped to the signed Streams session and its wallet. They never enter browser storage, public ecosystem snapshots, the community research database, logs or Git. Native session address is checked before reading private Hatchery state. Same-origin JSON POSTs and the existing signed Streams session are required; no new holder-tier minimum is imposed by the adapter. Native Hatchery enforces its own eligibility. Sessions expire with the signed Streams session, and a restart requires explicit reconnection. No signature or vote is requested on page load or passive wallet restoration.

Writes are serialized per session. Completed native votes cannot be resubmitted. Timeouts, empty responses and invalid receipts leave an unconfirmed outcome locked against blind retry; **Check receipt** performs a read. XP feedback comes only from a returned native receipt with a matching heat score and valid epoch/XP fields. Switching wallets clears private heat state immediately and ignores late browser responses. A native connection can succeed for an empty wallet without implying Pet/passport eligibility.

## Deployment and acceptance

1. Pull this published main revision, preserving newer OpenClaw integration work and runtime state. If 0.3.16 is not installed yet, apply its migration 007 using the established migration runner.
2. Rebuild release metadata and restart `axo-streams` normally. Confirm `/api/release` reports 0.3.17 and the installed commit. Keep the existing Reown, signed holder sessions and `AXO_PAPER_ENGINE=strategies` settings.
3. Confirm `/api/hatchery-heat` returns 401 without signed ownership. The adapter must have outbound HTTPS access to `axo.pet`; never disable TLS verification. It does not need direct access to the native Hatchery database or a shared administrator credential.
4. With an approved eligible test wallet, open Hatchery, connect Hatchery explicitly, and make a heat call on an open exact Robinhood project. Confirm the native receipt, epoch, awarded XP, already-completed state and native dashboard agree. This eligible live-vote acceptance remains an operator task: Builder did not cast a real community vote merely to test the UI.
5. Check passport/current-AXO gates, closed tasks, a second attempted call, wallet switching, reload and phone layouts. A server restart should request reconnection rather than fabricate an authenticated native session. Do not treat a native access outage or a pending receipt as a saved call.
6. Return installed revision and acceptance results through coordination. Publishing this code or receiving its notice does not prove installation.

## Verification

`npm run test:hatchery-heat` covers the backend contract and desktop/390/320 light/dark browser interaction. Server fixtures exercise domain/address/chain/signature/session isolation, passport/canonical/task/window gates, serialization, exact receipts, duplicates, incomplete/ambiguous responses and unhatched state. Browser fixtures exercise explicit sign-in, keyboard voting, selected heat feedback, private account clearing and late-response rejection. Existing Hatchery ratings, ecosystem/community UI, holder-auth and dashboard-route regressions accompany the release.

A live end-to-end adapter sign-in used a temporary empty wallet, verified the genuine native challenge/session/cookie flow and confirmed the unhatched state. No Pet, heat vote, XP or transaction was created. Eligible live voting is intentionally not claimed as verified by that check.

Rollback: revert application code and restart, preserving all databases and journals. Native heat receipts already accepted by Hatchery remain in its existing ledger; they are not application-local records to delete or reissue.
