# Plan: US-06 — View Live Poll Results

> Ref: [US-06](../01-requirement/us-06-live-poll-results.md)

---

## Implementation Tasks

- [ ] **IMPL-06-1** Results panel in instructor view — always-visible panel alongside or beneath the active poll controls; subscribes to `poll:results` socket events and re-renders on each update
- [ ] **IMPL-06-2** Bar chart component — for each option: label, animated progress bar (CSS `width` transition 150 ms), raw count, and percentage of total votes; recalculates percentages on every `poll:results` event
- [ ] **IMPL-06-3** Total voters counter — server tracks a `Set` of `participantId`s that have voted at least once per poll; broadcasts `voterCount` in the `poll:results` payload; rendered as "N participants responded" in the results panel
- [ ] **IMPL-06-4** "Show results to room" toggle — instructor button that emits `poll:results-visibility` socket event `{ visible: true|false }`; participant view renders or hides results panel accordingly; default is hidden
- [ ] **IMPL-06-5** Snapshot on close — when instructor closes poll, server captures final `results` and `voterCount` and stores them in the poll history record; results panel switches to "Final results" heading with frozen values
- [ ] **IMPL-06-6** Poll history results — each entry in the instructor's past polls list renders the frozen bar chart snapshot using the same bar chart component in read-only mode
- [ ] **IMPL-06-7** Projector display mode — a CSS class `projector-mode` increases base font size to 1.5rem, uses high-contrast colours (dark background, white text, bright accent bars); toggled by a "Projector mode" button in the instructor view

---

## QA Tasks

- [ ] **QA-06-1** Real-time update — have 3 participants spam votes; verify bars in instructor results panel animate and update within 500 ms of each vote burst
- [ ] **QA-06-2** Show results to room — toggle "Show results to room" ON; verify the results bar chart appears in all participant views; toggle OFF and verify it disappears
- [ ] **QA-06-3** Voter count — 3 distinct participants vote; verify "3 participants responded" is shown; a 4th joins but does not vote; verify count stays at 3
- [ ] **QA-06-4** Freeze on close — instructor closes poll; verify the results panel stops updating and shows "Final results" heading; further simulated vote events do not change the displayed numbers
- [ ] **QA-06-5** History snapshot accuracy — close a poll, then reopen history; verify the bar chart values match the last live values seen before closing
- [ ] **QA-06-6** Projector mode — enable projector mode on a 1920×1080 display; verify all text is legible from approximately 3 m (simulate by standing back or scaling viewport down)
- [ ] **QA-06-7** Percentage calculation — one option has 75 votes, another 25; verify percentages displayed are 75% and 25% respectively
