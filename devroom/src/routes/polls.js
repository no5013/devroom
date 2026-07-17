'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const store = require('../sessionStore');

let io;
router.setIo = (i) => { io = i; };

// Middleware: validate instructorToken from x-instructor-token header or ?token= query
function requireInstructor(req, res, next) {
  const sessionId = req.params.sessionId;
  const session = store.sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const token = req.query.token || req.headers['x-instructor-token'];
  if (token !== session.instructorToken) return res.status(403).json({ error: 'Forbidden' });
  req.session = session;
  next();
}

// POST /api/sessions/:sessionId/polls  — create a poll
router.post('/', requireInstructor, (req, res) => {
  const { question, options } = req.body;
  // Validate
  if (!question || !question.trim()) return res.status(400).json({ error: 'Question required' });
  if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'At least 2 options required' });
  if (options.length > 6) return res.status(400).json({ error: 'Max 6 options' });
  for (const opt of options) {
    if (!opt || !opt.trim || !opt.trim()) return res.status(400).json({ error: 'Option label required' });
    if (opt.length > 30) return res.status(400).json({ error: 'Option label max 30 chars' });
  }
  // Guard: 409 if active poll exists
  const existing = store.getActivePoll(req.session.sessionId);
  if (existing) return res.status(409).json({ error: 'A poll is already active' });

  const poll = store.createPoll(req.session.sessionId, {
    question: question.trim(),
    options: options.map(label => ({ id: uuidv4(), label: label.trim() }))
  });

  // Broadcast to room
  io.to(req.session.code).emit('poll:started', poll);

  res.status(201).json(poll);
});

// PATCH /api/sessions/:sessionId/polls/:pollId  — close poll
router.patch('/:pollId', requireInstructor, (req, res) => {
  const { pollId } = req.params;
  const { status } = req.body;
  if (status !== 'closed') return res.status(400).json({ error: 'status must be closed' });
  const poll = store.getPolls(req.session.sessionId).find(p => p.id === pollId);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  store.closePoll(req.session.sessionId, pollId);
  io.to(req.session.code).emit('poll:closed', { pollId, finalResults: poll.results });
  res.json({ ok: true });
});

// GET /api/sessions/:sessionId/polls  — poll history
router.get('/', requireInstructor, (req, res) => {
  res.json(store.getPolls(req.session.sessionId));
});

module.exports = router;
