# US-10: Close Poll via Chat Command or In-Card Button

**As an** instructor,
**I want to** close the active poll by typing `/poll close` or clicking "Close Poll" inside the chat card,
**So that** I can end voting without leaving the chat or digging through a sidebar.

## Acceptance Criteria

- [x] Instructor types `/poll close` in the chat input to close the active poll; the command works even if the poll card has scrolled out of view
- [x] Alternatively, a "Close Poll" button is visible inside the poll card for the instructor only; clicking it closes the poll
- [x] On close, all vote buttons in the card are disabled and greyed out; a "Poll closed" label appears inside the card
- [x] The final vote totals and percentages are frozen in place inside the card — they do not change after closing
- [x] The card heading changes from "Poll" to "Poll — Final Results"
- [x] Closed polls remain in the chat history as read-only cards so participants can scroll back and see results
- [x] Typing `/poll close` when no poll is active shows an inline error: `No active poll to close`
- [x] Only `role: instructor` can use `/poll close`; participant attempts are ignored or return a permission error
- [x] After a poll is closed, the instructor can immediately start a new poll with another `/poll` command
