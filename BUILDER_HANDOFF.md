# AXO Streams — Builder AI Handoff

Updated: 2026-10-14
Current additive release tasks: see [OpenClaw 0.3.5 continuous intelligence and risk-first handoff](docs/OPENCLAW_RELEASE_0.3.5.md), extending the [0.3.0 release](docs/OPENCLAW_RELEASE_0.3.0.md). Preserve this handoff's existing wallet/Hatchery requirements. The new progression table is migration 006; live shared-knowledge and coordination authentication remain operator setup tasks.
Repository: `supah-based/AXODynamicDashboard`
Production: `https://streams.axo.vision`
Verified baseline commit: `931a802d6bed162a5311da56625e306380c24bcc`

> Pull `origin/main` before changing code. The baseline above records this handoff’s verified starting point; it is not permission to overwrite newer commits.

## What changed in the current baseline

### Reown is the only displayed wallet connector

- `work/axo-reown-entry.js` initializes Reown AppKit with the existing server-supplied project identifier.
- The wallet UI no longer presents competing injected-provider or Solana connection buttons.
- The main wallet button is the single entry point for wallet connection and holder access.
- Compatible browser wallets, QR and mobile WalletConnect use the same Reown flow.
- Reown account management, account switching, reconnect recovery and explicit disconnect remain available.

Relevant commits:

- `12b7fdf` — hardened Reown reconnect lifecycle.
- `234fd8b` — made Reown the sole displayed connector and added explicit connect-then-sign behavior.
- `931a802` — removed the duplicate Holder Access button and merged wallet/access management into one control and panel.

### Wallet connection and AXO tier assignment are one process

The user flow is now:

1. Select the main wallet button.
2. Connect through Reown.
3. Approve the SIWE ownership signature.
4. The server performs a fresh exact AXO balance read on Robinhood Chain.
5. The server applies the matching tier and allowances.
6. The main wallet button displays the applied tier and opens the combined **Wallet & AXO access** panel.

A connected but unverified wallet uses the same main button to finish verification. A verified wallet uses it to view tier, balance, allowances, account management, recheck, disconnect and access-only sign-out.

### Fresh holder verification

`work/axo-holder-auth.mjs` remains the authority for access. A successful new signature now bypasses any still-valid one-minute balance cache and forces a fresh holdings read before returning the tier.

The server must continue to verify all of the following before applying access:

- wallet address matches the signed SIWE session;
- exact Robinhood Chain ID `4663` holdings evidence;
- exact current AXO token from `work/axo-identity.mjs`;
- 18 decimals;
- exact raw integer balance;
- fresh block observation within the existing evidence window;
- server-classified tier and server-enforced daily limits.

Never trust a client-supplied balance, tier, feature flag or allowance.

Current inclusive tier thresholds:

- Public: below `1,000,000 AXO`
- Normal holder: `1,000,000 AXO`
- Improved: `2,500,000 AXO`
- Top: `5,000,000 AXO`
- Whale: `10,000,000 AXO`

Relevant commit: `969a5b2`.

### Signature and session boundaries that must remain

- Never request an account or signature on page load.
- Never auto-sign merely because Reown restores a persisted wallet session.
- A user-initiated connection may continue into the ownership signature and fresh AXO check.
- The signature proves ownership only; it cannot approve spending or token transfers.
- Preserve one-use challenges, origin/domain binding, expiry, signature verification, HttpOnly/SameSite session cookies and Secure cookies on HTTPS.
- Wallet account changes or disconnects must invalidate mismatched holder access.
- Protected APIs must continue to use the signed server session and server-side tier checks.

### Hatchery project bridge

The Streams Hatchery view now reads the authoritative public `intel.projects` queue, displays current/accepting projects and qualified-review progress, and provides exact project handoffs into Hatchery. Project references may use exact address, CAIP reference or explorer URL. Streams does not duplicate Hatchery wallet, Pet, XP, chain-resolution or Crew-vote authority.

Relevant commit: `3f27f8f`.

## Key files

- `work/axo-reown-entry.js` — Reown AppKit creation and subscriptions.
- `work/axo-reown.bundle.js` — generated browser bundle; rebuild with `npm run build:reown` only when the entry changes.
- `work/axo-wallet.js` — single wallet entry, Reown lifecycle and wallet management.
- `work/axo-holder-access-ui.js` — unified wallet/access UI and connect→sign behavior.
- `work/axo-holder-auth.mjs` — SIWE sessions, fresh holdings verification, tier authority and limits.
- `work/axo-access.mjs` — exact tier thresholds and public access policy.
- `work/axo-tier-limits.mjs` — daily server-enforced limits.
- `work/axo-public-hatchery.js` — Streams/Hatchery project presentation and handoff.
- `work/test-reown-wallet.mjs` — wallet configuration validation.
- `work/test-wallet-lifecycle.mjs` — reconnect, disconnect and mobile wallet UI lifecycle.
- `work/test-reown-holder-flow.mjs` — one-control connect→sign→fresh-check→tier regression.
- `work/test-holder-auth.mjs` — SIWE, fresh cache bypass, exact tier and access enforcement.
- `work/test-holder-browser.mjs` — broader holder UI behavior.

## Required checks for wallet or holder changes

Use the installed browser channel when Playwright’s default Edge binary is unavailable:

```sh
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY \
  -u https_proxy -u http_proxy -u all_proxy \
  node work/test-holder-auth.mjs

AXO_BROWSER_CHANNEL=chrome \
  env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY \
  -u https_proxy -u http_proxy -u all_proxy \
  npm run test:reown-wallet
```

Also run:

```sh
git diff --check
node --check work/axo-wallet.js
node --check work/axo-holder-access-ui.js
node --check work/axo-holder-auth.mjs
```

When changing `work/axo-reown-entry.js`:

```sh
npm run build:reown
npm run test:reown-wallet
```

## Deployment notes

- `/wallet.js` and `/holder-access.js` are served from source with `no-store`; browser UI-only changes do not require a process restart.
- Server authentication changes require restarting only `axo-streams` and verifying `/api/dashboard` after startup.
- Do not restart `axo-streams-codex` for wallet/UI work.
- Preserve `/var/lib/axo-streams`, the isolated PostgreSQL state and private runtime files.
- Never place Reown identifiers, API credentials, wallet secrets or authentication cookies in this handoff.

## Safe Git integration

Before integrating Builder AI work:

1. Require a clean working tree or explicitly preserve local work.
2. Fetch `origin/main` and inspect commits added since this handoff baseline.
3. Merge or rebase only when the histories and intended changes are understood.
4. Never force-push.
5. Re-run the focused tests for every touched subsystem.
6. Verify the live service only after local checks pass.
7. Push normally, fetch again, and prove local HEAD, `origin/main`, and `git ls-remote origin refs/heads/main` are identical.

## Acceptance checklist

A wallet/access upgrade is incomplete if any of these regress:

- more than one displayed connect/holder-access entry;
- a non-Reown connector appears in the connection UI;
- page load or passive session restoration requests a signature;
- connection completes without the explicit ownership signature needed for gated access;
- a new signed connection can reuse a stale cached AXO balance;
- the client can choose its own tier or allowance;
- account switching preserves access for the previous wallet;
- missing, stale, wrong-chain or wrong-token holdings evidence grants access;
- public browsing becomes wallet-gated;
- transaction approval is implied by the sign-in signature;
- unrelated services or durable state are restarted/reset.
