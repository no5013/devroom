# Plan: US-04 — Instructor Creates a Poll Question

> Ref: [US-04](../01-requirement/us-04-instructor-create-poll.md)

---

## Implementation Tasks

- [x] **IMPL-04-1** "Create Poll" button in instructor dashboard — visible only when `role === instructor` and no poll is currently active
- [x] **IMPL-04-2** Poll creation panel/drawer UI — question text input + dynamic list of option inputs; "Add option" button (max 6); "Remove" button per option (min 2 must remain)
- [x] **IMPL-04-3** Client-side validation — question must not be empty; at least 2 options required; each option label ≤ 30 characters; show inline error messages before submit
- [x] **IMPL-04-4** Poll creation API — `POST /api/sessions/:id/polls` (instructor token required); creates poll object `{ id, question, options: [{ id, label }], status: 'active', results: {} }`; rejects with 409 if a poll is already active
- [x] **IMPL-04-5** Broadcast on creation — server emits `poll:started` socket event with the full poll payload to all clients in the room immediately after creation
- [x] **IMPL-04-6** Active poll overlay on participant view — `poll:started` event renders a fixed/sticky banner with the question and answer buttons; sits above the chat; cannot be dismissed by the participant
- [x] **IMPL-04-7** Close poll — "Close Poll" button in instructor dashboard; calls `PATCH /api/sessions/:id/polls/:pollId` with `{ status: 'closed' }`; broadcasts `poll:closed` event
- [x] **IMPL-04-8** Single active poll guard — "Create Poll" button is hidden/disabled while a poll is active; server also enforces the 409 rejection as a safety net
- [x] **IMPL-04-9** Poll history list — instructor view shows a collapsible "Past Polls" section; populated by `GET /api/sessions/:id/polls`; each entry shows question, options, and final vote totals

---

## QA Tasks

- [x] **QA-04-1** Minimum options — submit poll form with only 1 option; verify an inline error blocks submission
- [x] **QA-04-2** Option label length — type 31 characters in an option field; verify the input rejects the extra character or shows an error
- [x] **QA-04-3** Poll broadcast — post a poll as instructor; verify it appears as an overlay on all participant tabs within 1 s
- [x] **QA-04-4** Double-poll guard — while a poll is active, attempt to create another poll (via the API directly); verify a 409 error is returned and the first poll is unaffected
- [x] **QA-04-5** Close poll — click "Close Poll"; verify participant overlay disappears and buttons become disabled on all participant tabs
- [x] **QA-04-6** Poll history — run and close 2 polls; open the history list; verify both appear with their final vote totals
- [x] **QA-04-7** Participant cannot dismiss poll — on participant view, verify there is no close/dismiss button on the active poll overlay
