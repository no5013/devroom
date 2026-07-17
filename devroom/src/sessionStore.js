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
    activeNames: new Set()
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
 * addParticipant(sessionId, participantId, name, token)
 */
function addParticipant(sessionId, participantId, name, token) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  session.participants.set(participantId, { participantId, name, token });
  session.activeNames.add(name);
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

module.exports = {
  createSession,
  getSessionByCode,
  addParticipant,
  getActiveNames,
  hasSession
};
