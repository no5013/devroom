'use strict';

const store = require('../../../devroom/src/sessionStore');

describe('sessionStore', () => {
  // Test 1: createSession returns { sessionId, code, instructorToken } — all non-empty strings
  it('createSession returns { sessionId, code, instructorToken } as non-empty strings', () => {
    const result = store.createSession('Test');
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('code');
    expect(result).toHaveProperty('instructorToken');
    expect(typeof result.sessionId).toBe('string');
    expect(typeof result.code).toBe('string');
    expect(typeof result.instructorToken).toBe('string');
    expect(result.sessionId.length).toBeGreaterThan(0);
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.instructorToken.length).toBeGreaterThan(0);
  });

  // Test 2: code is 6 characters matching /^[A-Z0-9]{6}$/
  it('code returned by createSession is 6 characters matching /^[A-Z0-9]{6}$/', () => {
    const { code } = store.createSession('TestSession');
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  // Test 3: getSessionByCode returns the session with the correct sessionId
  it('getSessionByCode(code) after createSession returns an object with the same sessionId', () => {
    const { sessionId, code } = store.createSession('LookupTest');
    const session = store.getSessionByCode(code);
    expect(session).toBeDefined();
    expect(session.sessionId).toBe(sessionId);
  });

  // Test 4: getSessionByCode on a non-existent code returns undefined
  it('getSessionByCode on a non-existent code returns undefined', () => {
    const result = store.getSessionByCode('XXXXXX');
    expect(result).toBeUndefined();
  });

  // Test 5: hasSession returns true after creation, false for unknown code
  it('hasSession returns true after creation and false for unknown code', () => {
    const { code } = store.createSession('HasSessionTest');
    expect(store.hasSession(code)).toBe(true);
    expect(store.hasSession('UNKNOWN')).toBe(false);
  });

  // Test 6: getActiveNames returns an empty Set for a newly created session
  it('getActiveNames returns an empty Set for a newly created session', () => {
    const { sessionId } = store.createSession('EmptyNames');
    const names = store.getActiveNames(sessionId);
    expect(names).toBeInstanceOf(Set);
    expect(names.size).toBe(0);
  });

  // Test 7: After addParticipant, getActiveNames contains the participant name
  it('getActiveNames contains the name after addParticipant', () => {
    const { sessionId } = store.createSession('ParticipantTest');
    store.addParticipant(sessionId, 'p1', 'SilentPanda1', 'tok1');
    const names = store.getActiveNames(sessionId);
    expect(names.has('SilentPanda1')).toBe(true);
  });

  // Test 8: Two addParticipant calls with different names both appear in getActiveNames
  it('two addParticipant calls with different names both appear in getActiveNames', () => {
    const { sessionId } = store.createSession('MultiParticipant');
    store.addParticipant(sessionId, 'p1', 'SilentPanda1', 'tok1');
    store.addParticipant(sessionId, 'p2', 'CryptoFox2', 'tok2');
    const names = store.getActiveNames(sessionId);
    expect(names.has('SilentPanda1')).toBe(true);
    expect(names.has('CryptoFox2')).toBe(true);
  });
});
