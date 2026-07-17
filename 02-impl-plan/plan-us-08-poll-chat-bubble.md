# Plan: US-08 — Poll Renders as Inline Chat Bubble

> Ref: [US-08](../01-requirement/us-08-poll-chat-bubble.md)

---

## Implementation Tasks

- [x] **IMPL-08-1** Add `<div id="poll-card-area"></div>` to `room.html` between `#messages` and `#chat-form`; style it as `flex-shrink: 0` so it never collapses
- [x] **IMPL-08-2** Add `.poll-card` CSS — green left border (`4px solid #3fb950`), dark tinted background (`#0d1f12`), `border-radius: 6px`, `padding: 1rem`, `margin: 0.5rem 0`; add `.poll-card-header` flex row with "📊 Poll" badge; add `.poll-card-question` bold large text
- [x] **IMPL-08-3** `renderPollCard(poll)` in `room.js` — builds the card DOM: header with label + optional Close Poll button (hidden by default), question div, option buttons (`.poll-vote-btn`, min-height 80 px, disabled for now), returns the card element
- [x] **IMPL-08-4** Update `socket.on('poll:started', ...)` — instead of populating `#active-poll-overlay`, call `renderPollCard(poll)`, append to `#poll-card-area`, show Close Poll button only if `identity.role === 'instructor'`; hide the old `#active-poll-overlay` (set `display:none`) to preserve backwards-compat with old tests
- [x] **IMPL-08-5** Update `socket.on('poll:closed', ...)` — clone the card from `#poll-card-area` into `#messages` as a frozen historical entry (add `.poll-card-frozen` class, disable all buttons, change header badge to "📊 Poll — Final Results"); then clear `#poll-card-area`
- [x] **IMPL-08-6** Server: in `src/index.js`, after the `socket.emit('presence:list', ...)` line, also emit `poll:active` if there is a currently active poll for the session — `socket.emit('poll:active', activePoll)` — so late joiners get the card without a page refresh
- [x] **IMPL-08-7** Client: add `socket.on('poll:active', function(poll) { /* same as poll:started */ })` — re-uses `renderPollCard` so late joiners see the card immediately
- [x] **IMPL-08-8** Remove from `room.html` `#instructor-panel`: `#create-poll-btn`, `#poll-drawer`, `#add-option-btn`, all `.poll-option-row` markup, `#submit-poll-btn`, `#cancel-poll-btn`, `#poll-form-error`, `#poll-history`; also remove their associated JS event listeners from `room.js` (the poll creation is now done via `/poll` command from US-07)

---

## QA Tasks

- [x] **QA-08-1** Card appears in `#poll-card-area` within 1 s of instructor creating poll via `/poll` command
- [x] **QA-08-2** Card has `.poll-card` class and a visible border/tint distinct from normal messages
- [x] **QA-08-3** Card displays the question text in a prominent element
- [x] **QA-08-4** Each option button has `offsetHeight >= 80` px
- [x] **QA-08-5** Participant view: no Close Poll button visible in the card; instructor view: Close Poll button IS visible
- [x] **QA-08-6** Late joiner: connect a new participant AFTER the poll is created; assert they see the poll card in `#poll-card-area` without refreshing
- [x] **QA-08-7** Sidebar poll drawer (`#poll-drawer`) is no longer present or visible in the DOM
- [x] **QA-08-8** After poll closes, a frozen `.poll-card` appears in `#messages`; `#poll-card-area` is empty
- [x] **QA-08-9** Normal chat messages sent before the poll are still visible and scrollable above the card
