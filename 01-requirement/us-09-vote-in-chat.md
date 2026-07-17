# US-09: Vote and See Live Results Inside the Chat Bubble

**As a** participant,
**I want to** spam vote buttons and watch counts update inside the same chat card,
**So that** the entire poll interaction happens in the chat without switching context.

## Acceptance Criteria

- [ ] Each option button inside the poll card is clickable with no vote cap — every click counts as one vote
- [ ] Clicking a button emits a `poll:vote` socket event; the button plays a bounce animation on each click
- [ ] A personal counter "You: N" updates beneath each button with every click
- [ ] The server broadcasts `poll:results` after each vote; the aggregate "Total: N" beneath each button updates in real time for all clients
- [ ] A percentage bar (CSS width transition, 150 ms) renders below each option and animates as votes arrive
- [ ] The voter count "N participants responded" is shown inside the card header and increments when a new unique voter first votes
- [ ] Instructor sees the same card and vote counts in real time; no separate results panel is required
- [ ] The instructor's card additionally shows a "Show results to room" toggle — when ON, the percentage bars are visible to participants; when OFF, participants see only the buttons (not the totals)
- [ ] The old `#participant-results-panel`, `#results-panel`, and `#show-results-btn` sidebar elements are removed
