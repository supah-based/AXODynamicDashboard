# AXO Dynamic Dashboard

A local crypto research dashboard with configurable streams, project discovery, launchpad feeds, wallet portfolio views, and Ask Axo text and voice controls.

## Run locally

Requires Node.js 24 or newer and pnpm. Run commands from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Open http://127.0.0.1:43187/?view=compact-intel. The server binds to loopback and is intended for local use. First launch collects public data; missing or rate-limited sources are shown as unavailable.

Public market views work without private API keys. Optional services:

- **Ask Axo / Luna research:** a locally installed and signed-in Codex CLI available as `codex`, or configured with `AXO_CODEX_PATH`.
- **Live voice:** copy `.env.example` to `.env` and configure `OPENAI_API_KEY`. A personal voice key entered in Profile overrides the shared key for that browser session. Personal keys are held in server memory and must be entered again after a server restart. Both shared and personal voice keys require verified holder access.
- **Argus launch events:** configure `AXO_BITQUERY_ACCESS_TOKEN` for the optional Bitquery source.

Credentials belong in the local `.env` file or the process environment. Neither credentials nor local usage records are included in the repository.

## Holder access and tiers

Public streams remain open. Ask Axo text, planning and voice require an explicit Sign-In with Ethereum message and at least 1,000,000 AXO. Connecting an address alone grants no AI access. Signing in authorizes no transaction or token approval. Ownership verification currently supports standard EVM wallet message signatures; Solana and contract-wallet sign-in are not implemented.

The server reads the exact AXO token balance on Robinhood, independently of the wallet's browsing network. It classifies exact integer token units, caches verified balances for up to one minute, and refuses missing, stale or mismatched evidence. Authentication uses an HttpOnly, SameSite cookie lasting two hours, with Secure cookies on the HTTPS origin. Sign-out and wallet changes clear browser access; active voice rechecks server access every minute and also checks after startup.

| Tier | Minimum AXO | Backend AI requests/day | Voice minutes/day | Additional available utilities |
| --- | ---: | ---: | ---: | --- |
| Public | 0 | 0 | 0 | Browse public streams; existing browser-local tools |
| Normal holder | 1,000,000 | 20 | 5 | Ask Axo and voice; conversational Watchlist, Favorites and local alert controls |
| Improved | 2,500,000 | 60 | 15 | Custom research cards, comparisons, saved research streams and tracked-project actions |
| Top | 5,000,000 | 120 | 30 | Larger daily service allowance |
| Whale | 10,000,000 | 240 | Unlimited | No Axo voice session timer or voice-start quota; shared capacity still applies |

These are initial service limits, separate from credit pricing and reward eligibility. Requests include planning attempts, so one question may consume multiple requests. Limits apply per verified wallet across browsers and reset at UTC midnight. Standard voice also respects operator settings (default three-minute sessions and ten shared starts per rolling 24 hours) and the remaining wallet allowance. Unused reserved seconds are returned after successful hangup. Whale holders have no application voice timer or daily voice quota, but provider limits, shared capacity (currently one live session) and current wallet verification still apply. Daily usage survives restarts in the ignored `private/holder-usage.json` under `AXO_RUNTIME_DIR` (default `work`); authentication sessions and personal voice keys do not. Keep that directory persistent and private on the VPS. Planned portfolio monitoring, recurring briefings, priority scheduling and shared launchpad publishing remain labeled unavailable.

For the VPS reverse proxy, set `AXO_PUBLIC_ORIGIN` to the exact public HTTPS origin (default `https://streams.axo.vision`), preserve a supported Host header, and proxy to loopback. Requests from unrelated origins are rejected. This implementation uses one Node process and a local usage ledger; sharing quotas between multiple server processes or replicas requires a shared datastore. Existing browser workspaces and AXO Postgres account linking remain separate from wallet authentication.

## AXO education and current rewards

One prominent, dismissible AXO education card appears near the start of eligible streams, after up to three data cards, and refreshes every 15 minutes while the dashboard is visible. It rotates between tier utility, the exact AXO buy destination and current rewards. Cards replace each other rather than accumulating; dismissal and reload preserve the cooldown. It does not become a project-page anchor or interrupt portfolio views.

Each variant has a cinematic 3:1 AXO-and-Pets header tailored to its subject: utility access, finding the exact token, or selecting a reward basket. The illustrations are brand metaphors; current values and verified destinations remain in the card body. Header space is reserved before images load, and the ratio stays the same on mobile. Artwork and generation prompts are versioned with the application.

Decorative masonry fillers use a separate set of twenty cinematic action scenes: gem discoveries, cave expeditions, scam investigations and adventures across varied landscapes. They fill only existing gaps, disappear when the gap closes, and never move research cards. Visible gaps use distinct images, and versioned image URLs refresh replaced artwork in existing browsers. The original slot filenames remain stable; scene names and prompts live in `work/axo-brand-manifest.json`.

The rewards variant refreshes once per minute while the page is visible, using the ecosystem adapter's exact-token official configuration, Based.bid observations and reward relay feeds. It shows the current selected basket separately from lifetime tracker distributions, retains exact per-asset token amounts, and dates observations. Fee values come from current verified configuration and explicitly identify the buy trade denominator; no fixed 5% or 3% assumption is made. These feeds do not establish holder-paid totals, so confirmed holder payments remain unverified. Stale or missing values are shown as unavailable, and no reward or price gain is promised.

## Project layout

- `work/axo-server.mjs`: server entry point and API routing.
- `work/axo-*`: application services, browser components, and shared models.
- `work/test-*.mjs`: automated checks. Browser checks expect the local server to be running; many use Microsoft Edge via Playwright.
- `outputs/axo-live-dashboard.html`: dashboard entry document.
- `outputs/assets` and `outputs/axo-brand-set`: application artwork.

The `work` directory name is retained from development. Runtime caches, generated card layouts, local ledgers, and research captures are excluded by `.gitignore` and are created as needed.

## Checks and build

```sh
pnpm run test:core
pnpm run test:browser
pnpm run test:holders
pnpm run test:utility
node work/test-launchpad-direct.mjs
node work/test-launchpad-pages.mjs
node work/build-solana-sdk.mjs
```

The last command rebuilds the committed browser bundle for the Solana wallet integration. Some additional tests are historical development diagnostics requiring local captures, or live-provider probes that may require credentials and consume provider resources; inspect a test before running it. The optional DOM harness installs separately with `pnpm --dir work/dom-test install --frozen-lockfile`.

## Coverage and current limits

The dashboard includes Solana, Base, BNB Chain, Robinhood, and Arc streams. Coverage differs by provider and chain; the UI exposes missing evidence and observation times.

Launchpad discovery includes eleven platform entries. Direct Pons, PAR, and Raydium LaunchLab feeds supplement existing GeckoTerminal samples. Argus needs a Bitquery credential. Some directory entries have published contracts but no connected indexer; Based.bid's platform-wide launch enumeration remains incomplete. New-launch and graduation lists are separate from measured activity screens.

AXO scores rank available research evidence; they are not probabilities of profit. Contract screening and available simulation results describe tested conditions. Portfolio daily P&L requires adequate balance and cash-flow history.

Wallet ownership and holder gating are now enforced for the protected AI endpoints. Other browser-session workspaces remain local prototypes. Shared ecosystem publishing and account linking still need their own ownership, validation and authorization flow; holding a Whale tier does not yet publish changes for everyone.

MIT licensed; see [LICENSE](LICENSE).

## Wallet-gated administration

The exact EVM controller wallet is the only default admin; override with `AXO_ADMIN_WALLET`. Connect that account and select **Admin** to sign a short-lived, origin-bound, nonce-based message (no transaction authority). Admin actions require a session and CSRF token; logging out or changing accounts revokes the browser session. The admin API requires a matching `AXO_PUBLIC_ORIGIN`; configure the reverse proxy to allow `/api/admin/*` POST/GET and `/admin-ui.js` only after independently reviewing the host policy. This repository change does **not** modify Caddy or restart the service.

Managed settings and the separately stored shared OpenAI voice key are written atomically under `/var/lib/axo-streams` with mode 0600. Set directory ownership for the runtime user and restrict directory access. The key is checked through the OpenAI model-retrieval endpoint before activation (authentication/model availability, not a billed voice-session guarantee), is never returned, and is read at request time without a restart. If no managed key exists, `OPENAI_API_KEY` remains the process fallback. ChatGPT/Codex billing is separate from OpenAI API usage. Settings affect new standard voice sessions and radio; Whale timer/quota semantics and shared capacity remain unchanged.
