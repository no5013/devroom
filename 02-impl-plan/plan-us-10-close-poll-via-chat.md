# Plan: US-10 — Close Poll via Chat Command or In-Card Button

> Ref: [US-10](../01-requirement/us-10-close-poll-via-chat.md)

---

## Already implemented (no changes needed)

- `/poll close` command in `handleSlashCommand()` (US-07) — calls PATCH, shows "No active poll" error
- `#close-poll-btn-card` in poll card, instructor-only (US-08)
- `poll:closed` handler moves frozen card to `#messages`, clears `#poll-card-area` (US-08)
- Frozen card badge already reads "📊 Poll — Final Results" (US-08)
- Participant permission guard for `/poll close` (US-07)
- After close, `createPollBtn.disabled = false` so new `/poll` works (US-08/09)

---

## Implementation Tasks

- [x] **IMPL-10-1** Add "Poll closed" label to frozen card — in `renderPollCard(poll, frozen=true)`, add a `<div class="poll-closed-label">Poll closed</div>` element after the options; add CSS: `color: #f85149; font-size: 0.8rem; margin-top: 0.5rem;`
- [x] **IMPL-10-2** Use `ev.finalResults` from `poll:closed` event for frozen totals — in the `poll:closed` handler, pass `ev.finalResults` (the server's authoritative final results) to the frozen card rendering rather than scraping totals from the active card's DOM; update `.poll-bar-fill` widths using `finalResults`

---

## QA Tasks

- [x] **QA-10-1** `/poll close` closes the active poll (card disappears from `#poll-card-area`)
- [x] **QA-10-2** "Close Poll" button in card closes the poll
- [x] **QA-10-3** Frozen card in `#messages` shows "Poll closed" label after close
- [x] **QA-10-4** Frozen card heading reads "Poll — Final Results"
- [x] **QA-10-5** Frozen card buttons are disabled
- [x] **QA-10-6** Final vote totals are visible in the frozen card
- [x] **QA-10-7** `/poll close` with no active poll shows error message
- [x] **QA-10-8** Participant using `/poll close` is silently ignored (no error, no close)
- [x] **QA-10-9** After close, instructor can immediately run `/poll New question? | A | B`
