'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../sessionStore');
const { generateUniqueName } = require('../nameGenerator');

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

  store.addParticipant(session.sessionId, participantId, name, token);

  return res.status(200).json({
    participantId,
    name,
    avatarSeed: String(seed),
    token
  });
});

module.exports = router;
