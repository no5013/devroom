# US-08: Poll Renders as Inline Chat Bubble

**As a** participant,
**I want to** see the active poll appear directly inside the chat stream as a special message card,
**So that** I can't miss it and don't have to interact with any sidebar or overlay.

## Acceptance Criteria

- [ ] When a poll is created (via `/poll` command), a distinct poll card is inserted into the chat message list for all connected clients within 1 s
- [ ] The card is visually distinct from normal chat messages — e.g. coloured border, "Poll" label, different background tint
- [ ] The card displays the question text prominently at the top
- [ ] Each answer option is rendered as a large, tappable button (min height 80 px) inside the card
- [ ] The poll card is pinned / sticky at the bottom of the chat scroll area while the poll is active, so latecomers see it immediately on joining
- [ ] The card does NOT have a dismiss or close button for participants — only the instructor sees a "Close Poll" button inside the card
- [ ] The card is not a floating overlay; it scrolls with the chat history so the conversation above it remains accessible
- [ ] Participants who join mid-poll (via `presence:join` after `poll:started`) receive the active poll card without needing to refresh
- [ ] The existing `#instructor-panel` sidebar poll drawer (`#create-poll-btn`, `#poll-drawer`, `#poll-history`) is removed from the UI
