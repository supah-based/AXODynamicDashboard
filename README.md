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
- **Live voice:** copy `.env.example` to `.env` and configure `OPENAI_API_KEY`. A personal voice key entered in Profile overrides the shared key for that browser session. Personal keys are held in server memory and must be entered again after a server restart.
- **Argus launch events:** configure `AXO_BITQUERY_ACCESS_TOKEN` for the optional Bitquery source.

Credentials belong in the local `.env` file or the process environment. Neither credentials nor local usage records are included in the repository.

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
node work/test-launchpad-direct.mjs
node work/test-launchpad-pages.mjs
node work/build-solana-sdk.mjs
```

The last command rebuilds the committed browser bundle for the Solana wallet integration. Some additional tests are historical development diagnostics requiring local captures, or live-provider probes that may require credentials and consume provider resources; inspect a test before running it. The optional DOM harness installs separately with `pnpm --dir work/dom-test install --frozen-lockfile`.

## Coverage and current limits

The dashboard includes Solana, Base, BNB Chain, Robinhood, and Arc streams. Coverage differs by provider and chain; the UI exposes missing evidence and observation times.

Launchpad discovery includes eleven platform entries. Direct Pons, PAR, and Raydium LaunchLab feeds supplement existing GeckoTerminal samples. Argus needs a Bitquery credential. Some directory entries have published contracts but no connected indexer; Based.bid's platform-wide launch enumeration remains incomplete. New-launch and graduation lists are separate from measured activity screens.

AXO scores rank available research evidence; they are not probabilities of profit. Contract screening and available simulation results describe tested conditions. Portfolio daily P&L requires adequate balance and cash-flow history.

This is a local application, not a hardened public multi-user deployment. Browser-session isolation is not authenticated account or wallet ownership. Shared ecosystem editing and whale-tier permissions still require server-verified identity and authorization.

MIT licensed; see [LICENSE](LICENSE).
