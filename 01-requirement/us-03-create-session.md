# US-03: Create and Manage a Session

**As an** instructor,
**I want to** create a new chat session and get a shareable link,
**So that** participants can join the right room for my training session.

## Acceptance Criteria

- [x] An instructor can create a new session with a session name (e.g. "Day 1 — Intro to Go")
- [x] After creation, the system provides a shareable URL and/or a short session code that participants can use to join
- [x] The instructor sees a separate view with moderator controls (post questions, see participant count)
- [x] The instructor can close/end the session, which gracefully notifies all participants that the session has ended
- [x] Session state (messages, poll results) persists for at least the duration of the active session
- [x] No login is required to create a session; the instructor receives a secret moderator link to manage the session
- [x] The instructor's messages and questions are marked as coming from the instructor role
