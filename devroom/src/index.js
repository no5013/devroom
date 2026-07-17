'use strict';

const express = require('express');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const store = require('./sessionStore');

const app = express();
const sessionsRouter = require('./routes/sessions');
const pollsRouter = require('./routes/polls');

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/api/sessions', sessionsRouter);
app.use('/api/sessions/:sessionId/polls', pollsRouter);
app.use('/api/avatar', require('./routes/avatar'));

// Serve join.html for /join route
app.get('/join', (req, res) => res.sendFile(path.join(__dirname, '../public/join.html')));

// Serve highlight.js and canvas-confetti from node_modules
app.get('/lib/highlight.min.css', (req, res) =>
  res.sendFile(require.resolve('highlight.js/styles/github-dark.min.css')));
app.get('/lib/confetti.js', (req, res) =>
  res.sendFile(require.resolve('canvas-confetti/dist/confetti.browser.js')));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
sessionsRouter.setIo(io);
pollsRouter.setIo(io);

io.on('connection', (socket) => {
  // ── chat:join ──────────────────────────────────────────────────────────
  socket.on('chat:join', ({ sessionCode, participantId, token }) => {
    const session = store.getSessionByCode(sessionCode);
    if (!session) { socket.disconnect(); return; }
    const participant = store.getParticipant(session.sessionId, participantId);
    if (!participant || participant.token !== token) { socket.disconnect(); return; }

    socket.join(sessionCode);
    socket.data = {
      sessionCode, participantId,
      name: participant.name,
      avatarSeed: participant.avatarSeed,
      role: participant.role
    };

    // Send full current presence list to the joining socket
    const presenceList = [];
    for (const [id, p] of session.participants.entries()) {
      presenceList.push({ participantId: id, name: p.name, avatarSeed: p.avatarSeed, role: p.role });
    }
    socket.emit('presence:list', presenceList);

    // Send session info to the joining socket
    socket.emit('session:info', {
      sessionName: session.name,
      sessionId: session.sessionId,
      instructorToken: participant.role === 'instructor' ? session.instructorToken : undefined,
    });

    // Broadcast join to everyone in the room
    io.to(sessionCode).emit('presence:join', {
      participantId,
      name: participant.name,
      avatarSeed: participant.avatarSeed,
      role: participant.role
    });
  });

  // ── chat:send ──────────────────────────────────────────────────────────
  socket.on('chat:send', ({ text }) => {
    const { sessionCode, name, avatarSeed, role } = socket.data || {};
    if (!sessionCode || !text || !text.trim()) return;
    const message = {
      id: uuidv4(),
      authorName: name,
      avatarSeed: String(avatarSeed),
      role: role || 'participant',
      text: text.trim(),
      timestamp: Date.now()
    };
    io.to(sessionCode).emit('chat:message', message);
  });

  // ── disconnect ─────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { sessionCode, participantId } = socket.data || {};
    if (!sessionCode) return;
    io.to(sessionCode).emit('presence:leave', { participantId });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`devroom listening on http://localhost:${PORT}`));
module.exports = app; // supertest uses app directly
