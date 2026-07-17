# Plan: US-01 — Join Session Anonymously

> Ref: [US-01](../01-requirement/us-01-join-session.md)

---

## Implementation Tasks

- [x] **IMPL-01-1** Name generator utility — adjective + animal + number pattern (e.g. `SilentPanda42`); output must be deterministic given the same seed so reconnects can reproduce the same name
- [x] **IMPL-01-2** Avatar library integration — use `dicebear` (identicon/pixel-art style) or `jdenticon`; avatar rendered from the same seed as the name
- [x] **IMPL-01-3** Join page UI — display generated name + avatar preview ("This is you") with a single "Enter Room" CTA; no text inputs for name
- [x] **IMPL-01-4** Session join API endpoint — `POST /api/sessions/:code/join` validates the code exists, checks name uniqueness within the session, returns `{ participantId, name, avatarSeed, token }`
- [x] **IMPL-01-5** Uniqueness enforcement — server keeps an in-memory set of active names per session; on collision, regenerate with a different seed until unique (max 10 retries)
- [x] **IMPL-01-6** Identity persistence — store `{ participantId, name, avatarSeed, token }` in `sessionStorage` so a page refresh or reconnect reuses the same identity without hitting join again
- [x] **IMPL-01-7** Join via shareable URL — parse `?code=XXXXXX` from the URL and pre-fill the session code so participants land directly on the preview screen

---

## QA Tasks

- [x] **QA-01-1** Concurrent joins — open 2 browser tabs simultaneously, both joining the same session; verify they receive different names
- [x] **QA-01-2** Avatar determinism — join twice with the same `avatarSeed`; verify the rendered avatar is pixel-identical both times
- [x] **QA-01-3** Reconnect identity — join, note name/avatar, refresh the page; verify the same name and avatar are restored without re-joining
- [x] **QA-01-4** Shareable URL — open `/join?code=XXXXXX` directly; verify the join flow starts with the code pre-filled and requires no extra steps
- [x] **QA-01-5** No-login check — clear all cookies and localStorage, open a fresh private window, join a session; verify no auth prompt appears
- [x] **QA-01-6** Invalid session code — submit a non-existent code; verify an error message is shown and no crash occurs
