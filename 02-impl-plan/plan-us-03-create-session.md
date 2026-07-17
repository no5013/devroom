# Plan: US-03 — Create and Manage a Session

> Ref: [US-03](../01-requirement/us-03-create-session.md)

---

## Implementation Tasks

- [x] **IMPL-03-1** Landing / create-session page — single form: session name input + "Create Session" button; no login required
- [x] **IMPL-03-2** Session creation API — `POST /api/sessions` accepts `{ name }`; generates a 6-char alphanumeric session `code`, a `sessionId` (UUID), and a `instructorToken` (secret UUID); returns `{ sessionId, code, participantUrl, instructorUrl }`
- [x] **IMPL-03-3** Short session code generator — collision-safe: check existing codes in the store before confirming; regenerate on collision
- [x] **IMPL-03-4** Confirmation screen — after creation, display the `participantUrl` (with copy button + QR code) and the `instructorUrl` separately labelled "Your private moderator link — don't share this"
- [x] **IMPL-03-5** Instructor dashboard layout — separate route (e.g. `/room/:code?token=…`); renders moderator controls panel (end session, create poll, participant count) alongside the chat view
- [x] **IMPL-03-6** Role middleware — any request/socket connection carrying a valid `instructorToken` for the session is tagged `role: instructor`; all others are `role: participant`
- [x] **IMPL-03-7** End session — `DELETE /api/sessions/:id` (instructor token required); broadcasts `session:ended` socket event to all clients in the room; clients show a "Session has ended" modal and disable all inputs
- [x] **IMPL-03-8** Session state store — in-memory store (Map or Redis) holding `{ name, code, messages[], polls[], participants{} }`; state lives for the duration of the process (no DB required for MVP)

---

## QA Tasks

- [x] **QA-03-1** Session creation — submit a session name; verify `participantUrl` and `instructorUrl` are returned and differ only by the token query param
- [x] **QA-03-2** Role separation — open `participantUrl`; verify no moderator controls (End Session, Create Poll buttons) are visible
- [x] **QA-03-3** Instructor access — open `instructorUrl`; verify moderator controls are visible and functional
- [x] **QA-03-4** End session — click "End Session" as instructor; verify all participant tabs immediately show the "Session has ended" overlay and inputs are disabled
- [x] **QA-03-5** Instructor reconnect — close the instructor tab, reopen `instructorUrl`; verify moderator controls are restored (token validated again)
- [x] **QA-03-6** Session name in header — verify the session name set at creation is displayed in the room header for both roles
- [x] **QA-03-7** No-login creation — clear all cookies, open the create page in a private window, create a session; verify it succeeds with no auth prompt
