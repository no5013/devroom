# Plan: US-07 — Create Poll via `/poll` Chat Command

> Ref: [US-07](../01-requirement/us-07-poll-chat-command.md)

---

## Implementation Tasks

- [x] **IMPL-07-1** Command interceptor in `public/js/room.js` — in the `sendMessage()` function, before emitting `chat:send`, check if `inputEl.value.trimStart().startsWith('/poll')`; if so, route to `handlePollCommand(text)` instead and return early
- [x] **IMPL-07-2** `parsePollCommand(text)` utility — splits on `|`, trims each segment; first segment is the question, rest are options; returns `{ question, options }` or `null` for bare `/poll`
- [x] **IMPL-07-3** Client-side validation in `handlePollCommand(text)` — rejects with `showChatError()` if: question empty, < 2 options, > 6 options, any option > 30 chars; shows usage hint for bare `/poll`
- [x] **IMPL-07-4** `showChatError(msg)` helper — appends a transient red system message to `#messages` (auto-removes after 4 s); used for all `/poll` error feedback
- [x] **IMPL-07-5** Poll creation fetch in `handlePollCommand` — calls `POST /api/sessions/${window._sessionId}/polls?token=${window._instructorToken}` with `{ question, options }`; on 409 response, shows "A poll is already active — close it first with /poll close"; on other errors shows the server error message
- [x] **IMPL-07-6** `/poll close` branch in `handlePollCommand` — detects text `/poll close` (case-insensitive), calls `PATCH /api/sessions/${window._sessionId}/polls/${currentPollId}?token=${window._instructorToken}` with `{ status: 'closed' }`; shows "No active poll to close" if `currentPollId` is null
- [x] **IMPL-07-7** Permission guard — `handlePollCommand` returns early with no action if `identity.role !== 'instructor'`; non-instructors never see the `/poll` path execute
- [x] **IMPL-07-8** On success, clear `inputEl.value` and reset its height; the poll creation triggers the existing `poll:started` socket broadcast which already renders the poll UI

---

## QA Tasks

- [x] **QA-07-1** Valid command — instructor sends `/poll Ready? | Yes | No | Maybe`; verify poll is created (check via `GET /api/sessions/:id/polls?token=X`), input is cleared
- [x] **QA-07-2** Bare `/poll` — instructor sends just `/poll`; verify a usage hint message appears in chat and no poll is created
- [x] **QA-07-3** Missing question — instructor sends `/poll | Yes | No`; verify an error message is shown
- [x] **QA-07-4** Only 1 option — instructor sends `/poll Ready? | Yes`; verify an error about needing 2+ options
- [x] **QA-07-5** Option > 30 chars — instructor sends an option with 31 characters; verify rejection error shown
- [x] **QA-07-6** Already active poll — while one poll is active, instructor sends another `/poll`; verify the "already active" error and original poll is unaffected
- [x] **QA-07-7** `/poll close` with active poll — verify the active poll closes (check `poll:closed` event fires on participant page)
- [x] **QA-07-8** `/poll close` with no active poll — verify "No active poll to close" error appears
- [x] **QA-07-9** Participant tries `/poll` — verify no poll is created and no error message is shown (silently ignored)
