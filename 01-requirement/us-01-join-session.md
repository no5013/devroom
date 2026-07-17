# US-01: Join Session Anonymously

**As a** participant,
**I want to** join a chat session with a generated cool name and avatar,
**So that** I can participate anonymously without revealing my real identity.

## Acceptance Criteria

- [x] A participant can join a session via a shareable link or session code
- [x] On joining, the system auto-generates a unique display name (e.g. `SilentPanda42`, `CryptoFox99`) — no manual name entry required
- [x] Each participant receives a unique GitHub-style pixel avatar (identicon or similar) based on their generated name or a random seed
- [x] Two participants in the same session cannot have the same name
- [x] The participant sees their own name and avatar before entering the chat room
- [x] Joining requires no account registration or login
- [x] If a participant disconnects and rejoins via the same link/session within the same browser session, they retain their previous name and avatar
