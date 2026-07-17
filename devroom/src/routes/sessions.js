'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const store = require('../sessionStore');
const { generateUniqueName } = require('../nameGenerator');

// io instance injected by src/index.js after Socket.io is created
let io;
router.setIo = function (ioInstance) { io = ioInstance; };

/**
 * POST /api/sessions
 * Body: { name }
 * Creates a session and returns join URLs.
 */
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Session name is required' });
  }

  const { sessionId, code, instructorToken } = store.createSession(name.trim());

  return res.status(201).json({
    sessionId,
    code,
    participantUrl: `/join?code=${code}`,
    instructorUrl: `/join?code=${code}&role=instructor&token=${instructorToken}`
  });
});

/**
 * POST /api/sessions/:code/join
 * Assigns a unique anonymous identity to a new participant.
 */
router.post('/:code/join', (req, res) => {
  const { code } = req.params;
  const session = store.getSessionByCode(code);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const randomStartSeed = Math.floor(Math.random() * 1000);
  let nameResult;
  try {
    nameResult = generateUniqueName(session.activeNames, randomStartSeed);
  } catch (err) {
    return res.status(409).json({ error: 'Could not assign unique name' });
  }

  const { name, seed } = nameResult;
  const participantId = uuidv4();
  const token = uuidv4();
  const avatarSeed = String(seed);

  // Determine role: instructor if valid instructor token provided
  const { role: roleParam, token: queryToken } = req.query;
  const role = (roleParam === 'instructor' && queryToken === session.instructorToken)
    ? 'instructor'
    : 'participant';

  store.addParticipant(session.sessionId, participantId, { name, avatarSeed, token, role });

  return res.status(200).json({
    participantId,
    name,
    avatarSeed,
    token,
    role,
    sessionName: session.name
  });
});

/**
 * GET /api/sessions/qr?url=<encoded-url>  →  returns PNG QR code
 */
router.get('/qr', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const png = await QRCode.toBuffer(url, { width: 150 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: 'QR generation failed' });
  }
});

/**
 * DELETE /api/sessions/:sessionId?token=<instructorToken>
 * Ends a session and broadcasts session:ended to all participants.
 */
router.delete('/:sessionId', (req, res) => {
  const session = store.sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Not found' });
  if (req.query.token !== session.instructorToken) return res.status(403).json({ error: 'Forbidden' });
  store.endSession(req.params.sessionId);
  if (io) {
    io.to(session.code).emit('session:ended', { message: 'The session has ended.' });
  }
  res.json({ ok: true });
});

module.exports = router;
