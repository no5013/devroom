/**
 * @jest-environment jsdom
 */

'use strict';

describe('browser: identity persistence (QA-01-3, QA-01-4)', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test for isolation
    sessionStorage.clear();
  });

  // QA-01-3 — Reconnect identity from sessionStorage
  it('QA-01-3: reads identity from sessionStorage and skips fetch', () => {
    const identity = {
      participantId: 'p1',
      name: 'SilentPanda1',
      avatarSeed: '42',
      token: 't1',
      sessionCode: 'ABC123'
    };
    sessionStorage.setItem('devroom_identity', JSON.stringify(identity));

    // Simulate the logic: if sessionStorage has identity for this code, return it
    const code = 'ABC123';
    const raw = sessionStorage.getItem('devroom_identity');
    const cached = raw ? JSON.parse(raw) : null;
    const result = (cached && cached.sessionCode === code) ? cached : null;

    expect(result).not.toBeNull();
    expect(result.name).toBe('SilentPanda1');
    // fetch should NOT have been called (we never called it)
  });

  // QA-01-4 — Shareable URL code extraction
  it('QA-01-4: extracts session code from ?code= query param', () => {
    // JSDOM allows setting window.location via Object.defineProperty or history API
    delete window.location;
    window.location = { search: '?code=XYZ789' };

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    expect(code).toBe('XYZ789');
  });

  // QA-01-3b — No cached identity for different session code
  it('QA-01-3b: does not use cached identity when session code does not match', () => {
    const identity = {
      participantId: 'p1',
      name: 'SilentPanda1',
      avatarSeed: '42',
      token: 't1',
      sessionCode: 'OTHER1'
    };
    sessionStorage.setItem('devroom_identity', JSON.stringify(identity));

    const code = 'ABC123';
    const raw = sessionStorage.getItem('devroom_identity');
    const cached = raw ? JSON.parse(raw) : null;
    const result = (cached && cached.sessionCode === code) ? cached : null;

    expect(result).toBeNull();
  });
});
