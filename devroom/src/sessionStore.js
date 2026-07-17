'use strict';

const sessions = new Map(); // keyed by sessionId
const sessionsByCode = new Map(); // keyed by code -> sessionId

/**
 * Generate a 6-char uppercase alphanumeric session code.
 */
function generateCode() {
  return Math.random().toString(36).toUpperCase().slice(2, 8);
}

/**
 * createSession(name)
 * Returns { sessionId, code, instructorToken }
 */
function createSession(name) {
  const { v4: uuidv4 } = require('uuid');
  const sessionId = uuidv4();
  const instructorToken = uuidv4();
  let code;
  // Ensure code uniqueness
  do {
    code = generateCode();
  } while (sessionsByCode.has(code));

  const session = {
    sessionId,
    name,
    code,
    instructorToken,
    participants: new Map(), // participantId -> { participantId, name, token }
    activeNames: new Set(),
    polls: []
  };

  sessions.set(sessionId, session);
  sessionsByCode.set(code, sessionId);

  return { sessionId, code, instructorToken };
}

/**
 * getSessionByCode(code)
 * Returns session object or undefined.
 */
function getSessionByCode(code) {
  const sessionId = sessionsByCode.get(code);
  if (!sessionId) return undefined;
  return sessions.get(sessionId);
}

/**
 * addParticipant(sessionId, participantId, { name, avatarSeed, token, role })
 */
function addParticipant(sessionId, participantId, { name, avatarSeed, token, role }) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.participants.set(participantId, { participantId, name, avatarSeed, token, role });
  session.activeNames.add(name);
}

/**
 * getParticipant(sessionId, participantId)
 * Returns the participant object or undefined.
 */
function getParticipant(sessionId, participantId) {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  return session.participants.get(participantId);
}

/**
 * getActiveNames(sessionId)
 * Returns Set of name strings.
 */
function getActiveNames(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return new Set();
  return session.activeNames;
}

/**
 * hasSession(code)
 * Returns boolean.
 */
function hasSession(code) {
  return sessionsByCode.has(code);
}

/**
 * endSession(sessionId)
 * Marks the session as ended.
 */
function endSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) session.ended = true;
}

/**
 * isEnded(code)
 * Returns boolean — true if the session has been ended.
 */
function isEnded(code) {
  const sessionId = sessionsByCode.get(code);
  if (!sessionId) return false;
  const session = sessions.get(sessionId);
  return !!(session && session.ended);
}

/**
 * createPoll(sessionId, { question, options })
 * options is array of { id: uuid, label: string }
 * Returns the new poll object.
 */
function createPoll(sessionId, { question, options }) {
  const { v4: uuidv4 } = require('uuid');
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (!session.polls) session.polls = [];
  const poll = {
    id: uuidv4(),
    question,
    options,
    status: 'active',
    results: {},
    voters: new Set(),
    createdAt: Date.now()
  };
  session.polls.push(poll);
  return poll;
}

/**
 * getActivePoll(sessionId)
 * Returns first poll where status === 'active', or null.
 */
function getActivePoll(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.polls) return null;
  return session.polls.find(function(p) { return p.status === 'active'; }) || null;
}

/**
 * closePoll(sessionId, pollId)
 * Sets poll.status = 'closed' and records poll.closedAt.
 */
function closePoll(sessionId, pollId) {
  const session = sessions.get(sessionId);
  if (!session || !session.polls) return;
  const poll = session.polls.find(function(p) { return p.id === pollId; });
  if (poll) {
    poll.finalResults = { ...poll.results };
    poll.finalVoterCount = poll.voters.size;
    poll.status = 'closed';
    poll.closedAt = Date.now();
  }
}

/**
 * getPolls(sessionId)
 * Returns session.polls array (all, sorted by createdAt).
 */
function getPolls(sessionId) {
  const session = sessions.get(sessionId);
  if (!session || !session.polls) return [];
  return session.polls.slice().sort(function(a, b) { return a.createdAt - b.createdAt; });
}

module.exports = {
  sessions,
  createSession,
  getSessionByCode,
  addParticipant,
  getParticipant,
  getActiveNames,
  hasSession,
  endSession,
  isEnded,
  createPoll,
  getActivePoll,
  closePoll,
  getPolls
};
