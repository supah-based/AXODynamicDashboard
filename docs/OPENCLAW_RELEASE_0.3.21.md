# AXO 0.3.21 — conversational streams and Realtime voice

Prepared October 29, 2026. Extends 0.3.20. No new dependency or database migration. Preserve deployed environment, wallet authentication, tier policy, private workspaces, source history, Hatchery, paper journals and provider credentials.

## Dashboard actions

Typed and spoken planning receive the same bounded catalog of builtin and saved streams, including their normalized definitions and current filters. Exact named navigation resolves without a model call; duplicate names with different definitions require clarification. The server authorizes navigation as an Ask action and stream creation as the existing customCards feature. Unknown model-selected IDs are rejected. Opening a saved Base stream no longer becomes a generic Base-chain navigation command.

Creation supports native stream sources as well as filtered Discovery and comparisons. The selected type, requested title, supported data-bound cards and explicit ranges are retained in the saved shortcut. Available components and metrics are still bounded by the card library; unknown measurements remain unknown. A model may propose one extra card with a question. Accepting the question plans a separate card action; declining changes nothing. Manual navigation and new speech cancel stale work. Navigation applied by the successful action itself does not cancel its receipt.

## Voice transport

New voice sessions default to `gpt-realtime-2`, using the server-owned multipart `/v1/realtime/calls` WebRTC flow, Verse, low reasoning effort and explicit dashboard function tools. No provider key enters the browser. Completed tool calls dispatch to the same checked planner/evidence paths as text. Argument deltas and cancelled/incomplete responses never execute. Tools return receipts before Axo speaks about the result. Duplicate response/call IDs do not repeat actions.

`AXO_VOICE_MODEL=gpt-realtime-2.1-mini` selects the documented smaller model. `AXO_VOICE_MODEL=gpt-live-1` explicitly retains the previous Live protocol. Model selection is read when the server constructs the AI service, after `.env` has loaded. Invalid names fail startup; provider errors never silently spend a different key or switch models. Existing shared-key/personal-key selection, owner-bound cleanup, holder checks, time allowances, operator capacity and periodic revocation checks remain in force. Sessions created before restart should be stopped normally first.

The live guidance field sends a normal Realtime user message. A freshly pasted exact address is also passed to the backend as a priority project hint for the next request. The mute button, audio waveform and temporary activity pills remain. A selected project reports its application receipt through the correct voice protocol.

## Validation

- Fixture transport tests: multipart SDP/model/Verse, personal/shared credentials, foreign-owner refusal, hangup, access revocation and refunds; malformed call identities and provider errors fail closed.
- Planner tests: exact builtin/saved navigation, authorization, unknown IDs, native news creation, filters and optional enrichment.
- Chrome with production HTML/assets and fixture APIs: voice tools create/save/open streams, ranges, accept/decline enrichment, duplicate/cancelled/late response suppression, native news, typed guidance, and 320/390/1440 widths. No wallet signatures, trades or real market data in this test.
- Existing AI, holder-auth, holder-voice, Whale, voice-isolation, unbounded voice, stream-contract and rebound-intent checks pass.
- Real provider verification: both model IDs are available to the existing API project. Bounded synthetic-silence WebRTC tests connected, received an audio track, completed a dashboard-tool round trip with a synthetic receipt and completed the reply. This verifies transport/tool integration, not microphone recognition quality or live market accuracy.
- One real Luna request produced a valid Base Discovery plan with market-cap maximum $3m and score range 65–90, plus an optional enrichment question. Only synthetic public scope was supplied.

## Deployment request

AXO operator: review and install the published commit containing this document through the normal deployment process. Preserve runtime state and existing secrets. Stop active voice normally, restart the app, and check `/api/release` for version `0.3.21` and the installed commit. Check `/api/ai/status` for `liveModel: gpt-realtime-2`, `voiceProtocol: realtime`, `voiceName: verse` (unless the operator explicitly chose mini/legacy).

Verify a signed holder can say “open my [saved stream name]”, create a named filtered stream, reopen it after reload, accept/decline one suggested card, interrupt an in-flight request, paste a contract into Guide Axo, and stop the call. Public browsing remains available; AI/custom-card tier gates remain. Inspect missing-source notices rather than interpreting unknown values as zero.

Official protocol/model references: [Realtime WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations), [Realtime 2](https://developers.openai.com/api/docs/models/gpt-realtime-2), [Realtime 2.1 mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini).

The signed coordination route accepts an informational update for operator review. Acceptance alone does not confirm deployment. Return the applied commit and acceptance result through the coordination protocol.
