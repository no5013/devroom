# Plan: US-09 — Vote and See Live Results Inside the Chat Bubble

> Ref: [US-09](../01-requirement/us-09-vote-in-chat.md)

---

## Implementation Tasks

- [x] **IMPL-09-1** Enable vote buttons in `renderPollCard()` — remove `btn.disabled = true`; add bounce animation click handler that emits `poll:vote`, updates personal counter, and triggers CSS bounce class
- [x] **IMPL-09-2** Add percentage bar DOM to each option in `renderPollCard()` — `.poll-bar-track` + `.poll-bar-fill` (CSS transition `width 150ms`); hidden by default for participants; always visible for instructor
- [x] **IMPL-09-3** Add voter-count span to card header — `<span id="poll-voter-count">0 responded</span>` inside `.poll-card-header`
- [x] **IMPL-09-4** Add "Show results to room" toggle button to instructor card — `<button id="show-results-toggle">Show results: OFF</button>`; toggling emits `poll:results-visibility` socket event `{ visible: true|false }`
- [x] **IMPL-09-5** Update `socket.on('poll:results', ...)` — find vote buttons in `#poll-card-area`, update `[data-role="total"]` text and `.poll-bar-fill` width; update voter count span; for participants also update bars if results are visible
- [x] **IMPL-09-6** Handle `poll:results-visibility` on participant side — show/hide `.poll-bar-track` elements in the poll card based on the `visible` flag
- [x] **IMPL-09-7** Remove `#participant-results-panel`, `#results-panel`, `#show-results-btn` from `room.html` and their associated JS from `room.js`
- [x] **IMPL-09-8** CSS — add `.poll-bar-track` (bg `#21262d`, h 10px), `.poll-bar-fill` (bg `#3fb950`, transition width 150ms), `.poll-option-bars` wrapper; add `#show-results-toggle` button style

---

## QA Tasks

- [x] **QA-09-1** 100 clicks register as exactly 100 server-side votes (via GET /polls after spamming)
- [x] **QA-09-2** Bounce animation fires on each click (inject `animationstart` counter)
- [x] **QA-09-3** Personal counter "You: N" updates on every click
- [x] **QA-09-4** Aggregate "Total: N" updates in real time across two participant contexts
- [x] **QA-09-5** Percentage bar width changes after votes arrive (not 0%)
- [x] **QA-09-6** Voter count in card header increments correctly (3 distinct voters → "3 responded")
- [x] **QA-09-7** "Show results" toggle ON — bars appear on participant card; toggle OFF — bars hidden
- [x] **QA-09-8** Old `#results-panel` and `#show-results-btn` are absent from DOM
