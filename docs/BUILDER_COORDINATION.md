# AXO Builder ↔ OpenClaw coordination v1

This is a bounded, signed message channel—not a remote shell, tool bridge, or general agent-control API. Builder requests are data only. OpenClaw automatically answers only `ping` and `status-question`, using fixed informational text; `update` and `result` are stored for a local operator to review. No request text is executed or forwarded to shell, SQL, tools, wallet, or model.

## Enrollment: Builder owner

1. Generate one Ed25519 key pair in the Builder agent's own secret-managed workspace. Keep its private PEM outside Git, prompts, logs, and shared files, with filesystem mode `0600`. Do not use OpenClaw's key or reuse any bearer/API token. Never print the private key. Generate and retain a public PEM separately.
2. Read `docs/coordination-enrollment-challenge.json` from this repository. Create a response JSON with exactly `version: 1`, its `challengeId`, `publicKeyPem`, and a Base64 Ed25519 signature over the UTF-8 bytes:

   ```text
   axo-coordination-enroll-v1\n<challengeId>\n<audience>\n<challenge>
   ```

   The challenge string is the exact value in the committed challenge JSON. The public key must be Ed25519 SPKI PEM. The signed response contains public material only; never include the private key or other credentials.
3. Commit only the public PEM and signed response JSON (or a response JSON that contains the public PEM) to the Builder's reviewed repository. Tell the OpenClaw owner the commit hash; do not send key material through chat. OpenClaw stops **only** `axo-builder-coordination`, locally verifies/enrolls with `node work/axo-coordination-cli.mjs enroll <response.json>` as the `axostreams` runtime user, then restarts that service. Enrollment state is local, mode `0600`, and never committed. The challenge is one-use.
4. OpenClaw will return the enrolled key fingerprint to Builder through a reviewed non-secret instruction/update. Configure the Builder private-key file path only in its protected runtime configuration as `AXO_COORDINATION_PRIVATE_KEY_FILE`; file mode must be `0600`. The local-only endpoint is `http://127.0.0.1:3457/api/coordination/v1/messages`, accessible only to a Builder process on this host. Remote Builder access is **not enabled**; a separately authorized AXO-native x402 USDC-on-Base transport is required before any external exposure.

The Builder may create the challenge response with `node work/axo-coordination-cli.mjs make-enrollment-response <response-file>` after the private key file has been mounted and `AXO_COORDINATION_PRIVATE_KEY_FILE` has been set through the Builder host's protected runtime configuration. Do not supply the private key, or its secret contents, as a command argument. The generated response file contains only public key plus signature. Review the file before committing. After enrollment, `node work/axo-coordination-cli.mjs sign-request <envelope.json>` submits a signed request and `node work/axo-coordination-cli.mjs poll <correlation-id>` retrieves its response; both read the protected key file and never print its contents.

## Signed transport

Each HTTP request is signed directly with the enrolled Ed25519 private key. The public key ID is lowercase SHA-256 of the DER-encoded SPKI public key. Sign the UTF-8 string below with Ed25519, then Base64-encode the 64-byte signature:

```text
axo-coordination-v1\naxo-builder-coordination-local-v1\n<METHOD>\n<exact-path-and-query>\n<timestamp-ms>\n<unique-nonce>\n<lowercase-hex-sha256-of-raw-body>
```

Send these headers: `x-axo-key-id`, `x-axo-timestamp` (UTC Unix milliseconds), `x-axo-nonce` (fresh random 16–80 character URL-safe value), and `x-axo-signature`. POST JSON with `Content-Type: application/json`. Requests more than five minutes from server time, reused nonces, unknown/revoked keys, invalid signatures, bodies over 8 KiB, and unknown routes fail closed. The endpoint is loopback-only; never expose it through Caddy, a tunnel, or an external proxy without the separately required x402 payment gate. No bearer token is used.

### Message schema

Only these exact envelope/message fields are accepted; additional fields fail closed:

```json
{"protocol":"axo-coordination-v1","message":{"version":1,"id":"builder-msg-001","correlationId":"release-2026-10-14","sender":"axo-builder","destination":"openclaw","at":1791999000000,"kind":"ping","text":"Harmless connectivity test.","context":{}}}
```

`kind` is one of `ping`, `status-question`, `update`, or `result`. `context` may contain only `commit`, `schemaVersion`, `publicProject`, `capability`, or `status`. `publicProject` is an exact `{chain,address,pool?}` identity; use it instead of putting contract addresses in free text. Never send wallet/account/portfolio/holdings, transaction data, credentials, user details, private prompts, arbitrary tool requests, scripts, or SQL.

A successful POST returns an acknowledgment with the same message `id`, `sender: "openclaw"`, `status: "accepted"`, and server timestamp. It means durably accepted, not action completed. Duplicate message IDs are idempotently acknowledged. A new nonce is still required on every retry.

Poll `GET /api/coordination/v1/results?correlationId=<id>` with the same signature-header scheme and an empty-body digest. The only automatic results are fixed `ping`/`status-question` replies. Results are informational and contain request/correlation IDs, sender, timestamp, and text. No public challenge/enrollment route exists.

## OpenClaw operator CLI

Run only on the OpenClaw host, with ordinary filesystem permissions:

- `node work/axo-coordination-cli.mjs status` — counts only.
- `node work/axo-coordination-cli.mjs inbox` — inspect validated, stored Builder messages.
- `node work/axo-coordination-cli.mjs process [message-id]` — while the service is stopped, record messages; emits fixed responses only for ping/status-question. The running service already processes those two types automatically every five seconds.
- `node work/axo-coordination-cli.mjs result [correlation-id]` — inspect locally stored responses.
- `node work/axo-coordination-cli.mjs enroll <signed-response.json>` — while the service is stopped, verify the committed challenge response and enroll its public key.
- `node work/axo-coordination-cli.mjs revoke <key-id>` — stop the service first, revoke the enrolled key, then restart. No requests are accepted during the stop/revocation window.

State is under `/var/lib/axo-builder-coordination`, directory mode `0700`, journal mode `0600`, atomic replacement. The service is installed as `axo-builder-coordination`, runs its Node process as `axostreams`, and listens on `127.0.0.1:3457`; only `/healthz`, `POST /api/coordination/v1/messages`, and signed `GET /api/coordination/v1/results` exist. Do not route this service through `claw.supah.ai` or another public domain; it is a private local counterpart. No public proxy or Gateway configuration was changed.
