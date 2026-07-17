# US-07: Create Poll via `/poll` Chat Command

**As an** instructor,
**I want to** type `/poll "Question?" Option1 | Option2 | Option3` directly in the chat input,
**So that** I can create a poll instantly without leaving the chat or opening any side panel.

## Acceptance Criteria

- [x] Instructor types `/poll` followed by a question and pipe-separated options — e.g. `/poll Is everyone ready? | Yes | No | Need more time`
- [x] The first segment before the first `|` is treated as the question text; each subsequent segment is an answer option
- [x] At least 2 options are required; the command is rejected with an inline error message if fewer are provided
- [x] At most 6 options are allowed; extras beyond 6 are silently truncated or rejected with an error message
- [x] Each option label is capped at 30 characters; options that exceed this are rejected with an inline error message
- [x] The question text is required and non-empty; an empty question is rejected with an inline error
- [x] If a poll is already active in the session, the command is rejected with an inline error: `A poll is already active — close it first with /poll close`
- [x] Only participants with `role: instructor` can use `/poll`; participant attempts are silently ignored or shown a permission error
- [x] Typing `/poll` with no further text shows usage hint: `Usage: /poll Question? | Option1 | Option2 [| ...]`
- [x] On success the input field is cleared and the poll message is immediately visible in the chat
