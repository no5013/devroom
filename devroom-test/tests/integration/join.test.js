'use strict';

const request = require('supertest');
const app = require('../../../devroom/src/index');

describe('integration: join session', () => {
  let sessionCode;

  // Before each test, create a fresh session for isolation
  beforeEach(async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ name: 'TestRoom' });
    expect(res.status).toBe(201);
    sessionCode = res.body.code;
  });

  // QA-01-1 — Concurrent joins get different names
  it('QA-01-1: concurrent joins get different names', async () => {
    const [res1, res2] = await Promise.all([
      request(app).post(`/api/sessions/${sessionCode}/join`),
      request(app).post(`/api/sessions/${sessionCode}/join`)
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.name).not.toBe(res2.body.name);
  });

  // QA-01-2 — Avatar determinism
  it('QA-01-2: avatar endpoint is deterministic — same seed returns identical SVG', async () => {
    const [res1, res2] = await Promise.all([
      request(app).get('/api/avatar/seed123'),
      request(app).get('/api/avatar/seed123')
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.text).toBe(res2.text);
    expect(res1.headers['content-type']).toMatch(/image\/svg\+xml/);
  });

  // QA-01-5 — No auth required
  it('QA-01-5: join requires no auth — returns participantId, name, avatarSeed, token', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionCode}/join`);
    // No Authorization header, no cookies

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('participantId');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('avatarSeed');
    expect(res.body).toHaveProperty('token');
  });

  // QA-01-6 — Invalid session code returns 404
  it('QA-01-6: joining a non-existent session code returns 404 with an error message', async () => {
    const res = await request(app)
      .post('/api/sessions/ZZZZZZ/join');

    expect(res.status).toBe(404);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  // Bonus — Join returns correct shape
  it('Bonus: join response body matches expected shape', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionCode}/join`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      participantId: expect.any(String),
      name: expect.any(String),
      avatarSeed: expect.any(String),
      token: expect.any(String)
    });
  });
});
