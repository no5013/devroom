# Plan: US-02 — Real-Time Chat with Cool Effects

> Ref: [US-02](../01-requirement/us-02-realtime-chat.md)

---

## Implementation Tasks

- [ ] **IMPL-02-1** WebSocket setup — integrate Socket.io (or native WS) on both server and client; establish a per-session room on connect using the participant token
- [ ] **IMPL-02-2** Message data model — `{ id, authorName, avatarSeed, role: 'participant'|'instructor', text, timestamp }`; server validates and broadcasts to room on `chat:send`
- [ ] **IMPL-02-3** Message list component — render avatar + name + text + timestamp per message; scroll container with `overflow-y: auto`
- [ ] **IMPL-02-4** Code block rendering — parse triple-backtick fences in message text; render as `<pre><code>` with a syntax-highlight library (e.g. `highlight.js` or `shiki`); fall back to plain monospace if language unknown
- [ ] **IMPL-02-5** Message enter animation — CSS keyframe `slideInUp` (or Framer Motion `initial/animate`); plays once per new message appended to the list
- [ ] **IMPL-02-6** Auto-scroll logic — scroll to bottom on new message if the user is already near the bottom (within 80px); otherwise show a floating "↓ New messages" button that scrolls on click
- [ ] **IMPL-02-7** Send controls — Enter key sends (no newline); Shift+Enter inserts newline; Send button triggers same action; disable send while disconnected
- [ ] **IMPL-02-8** Fun effect — detect 🎉 in outgoing message text; trigger a confetti burst (e.g. `canvas-confetti`) visible to the sender; floating emoji particles on the receiver side
- [ ] **IMPL-02-9** Participant list — sidebar or collapsible header panel; updated via `presence:join` / `presence:leave` socket events; shows avatar + name for each connected participant
- [ ] **IMPL-02-10** Instructor message style — server tags messages with `role: 'instructor'`; client renders a coloured left border, badge label "Instructor", and distinct background tint

---

## QA Tasks

- [ ] **QA-02-1** Latency — send a message from tab A; measure time until it appears in tab B; target < 200 ms on localhost
- [ ] **QA-02-2** Code block — send ` ```js\nconsole.log('hi')\n``` `; verify monospace font and syntax colour applied, no raw backticks visible
- [ ] **QA-02-3** Auto-scroll — scroll up 500px, receive a new message; verify "↓ New messages" button appears; click it and verify scroll jumps to bottom
- [ ] **QA-02-4** Shift+Enter newline — press Shift+Enter in the input; verify a line break is inserted and the message is not sent
- [ ] **QA-02-5** Confetti trigger — send a message containing 🎉; verify the confetti animation fires for the sender and emoji particles appear for others
- [ ] **QA-02-6** Instructor badge — join as instructor and send a message; verify the badge and highlight are present; verify a participant message has no badge
- [ ] **QA-02-7** Participant list updates — open 3 tabs, join all three; close one tab; verify that participant disappears from the list in the remaining tabs within 3 s
