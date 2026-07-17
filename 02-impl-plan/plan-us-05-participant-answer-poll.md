# Plan: US-05 — Participant Spams the Answer Button

> Ref: [US-05](../01-requirement/us-05-participant-answer-poll.md)

---

## Implementation Tasks

- [ ] **IMPL-05-1** Poll overlay component — on `poll:started` event, render one large button per option; buttons are fullscreen-friendly (min height 80px, large font); no vote cap enforced on the client
- [ ] **IMPL-05-2** Click-to-vote — each button click emits `poll:vote` socket event `{ pollId, optionId }`; no debounce or throttle — every click is an individual event
- [ ] **IMPL-05-3** Button click animation — CSS keyframe: scale-down + scale-up ("bounce") on each click; implemented as a class toggled per click so rapid clicks each trigger the animation
- [ ] **IMPL-05-4** Personal click counter — maintain per-option click count in component state; display "You: N" beneath each button, updating on every click; persists for the lifetime of the poll
- [ ] **IMPL-05-5** Option switch — clicking a different option emits votes for the new option from that point forward; previous option's personal count remains visible as a historical record
- [ ] **IMPL-05-6** Server vote aggregation — server increments `results[optionId]` on each `poll:vote` event; broadcasts updated `poll:results` payload `{ pollId, totals: { optionId: count } }` to all room members after each increment (or batched at ~50 ms intervals to reduce noise)
- [ ] **IMPL-05-7** Live total display — participant view shows aggregate total per option below the button (e.g. "Total: 247"); updated in real time from `poll:results` events
- [ ] **IMPL-05-8** Poll closed state — on `poll:closed` event, disable all buttons, apply a greyed-out style, and display a "Poll closed" label; personal counts remain visible

---

## QA Tasks

- [ ] **QA-05-1** Spam volume — click a button 100 times quickly; verify the server-side total increments by exactly 100 (check via instructor results view)
- [ ] **QA-05-2** Animation per click — click rapidly; verify the bounce animation triggers visually on each individual click (not once per N clicks)
- [ ] **QA-05-3** Personal counter — click option A 10 times, then option B 5 times; verify option A shows "You: 10" and option B shows "You: 5"
- [ ] **QA-05-4** Option switch totals — verify the aggregate totals on other participants' screens correctly split between option A and option B votes
- [ ] **QA-05-5** Poll closed disablement — instructor closes poll; verify buttons on participant view become non-clickable immediately and "Poll closed" label appears
- [ ] **QA-05-6** No vote after close — attempt to click a button after poll is closed; verify no `poll:vote` event is emitted (check network tab)
- [ ] **QA-05-7** Mobile tap target — open on a 375px-wide viewport; verify each button is at least 80px tall and responds to tap without mis-firing adjacent buttons
